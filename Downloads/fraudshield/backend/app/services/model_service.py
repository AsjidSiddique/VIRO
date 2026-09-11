"""
Model service.

Loads the REAL trained FraudShield artifacts (preprocessor.pkl, random_forest.pkl,
model_metadata.json, feature_names.json) exactly once at process startup and holds them
in memory for the lifetime of the app. Nothing in this module retrains, refits, or
modifies the preprocessing pipeline or threshold — it only loads and applies them.

IMPORTANT COMPATIBILITY NOTE:
The uploaded artifacts were pickled under scikit-learn 1.6.1 (see the InconsistentVersionWarning
raised when unpickling under newer sklearn releases — specifically preprocessor.pkl fails to
load at all under sklearn 1.8.0 because of an internal ColumnTransformer change). requirements.txt
pins scikit-learn==1.6.1 for exactly this reason. Do not upgrade scikit-learn in this service
without re-validating that the pickled artifacts still load.
"""
import json
import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import sklearn

from app.config import settings, REQUIRED_COLUMNS

logger = logging.getLogger("fraudshield.model_service")


class ModelNotLoadedError(RuntimeError):
    pass


class ModelService:
    """Singleton-style holder for the loaded model, preprocessor, and metadata."""

    def __init__(self) -> None:
        self.model = None
        self.preprocessor = None
        self.metadata: Optional[dict] = None
        self.feature_names: Optional[list[str]] = None
        self.shap_explainer = None
        self._load_error: Optional[str] = None

    # ------------------------------------------------------------------ #
    # Loading
    # ------------------------------------------------------------------ #
    def load(self) -> None:
        try:
            self._verify_artifacts_exist()

            with open(settings.MODEL_METADATA_PATH) as f:
                self.metadata = json.load(f)
            with open(settings.FEATURE_NAMES_PATH) as f:
                self.feature_names = json.load(f)
            with open(settings.PREPROCESSOR_PATH, "rb") as f:
                self.preprocessor = pickle.load(f)

            model_filename = Path(self.metadata["model_file"]).name
            model_path = settings.MODELS_DIR / model_filename
            if not model_path.exists():
                raise FileNotFoundError(f"Model file referenced by metadata not found: {model_path}")
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)

            if settings.SHAP_ENABLED:
                self._init_shap_explainer()

            logger.info(
                "FraudShield model loaded: %s | threshold=%s | sklearn=%s",
                self.metadata["model_name"], self.metadata["optimal_threshold"], sklearn.__version__,
            )
        except Exception as exc:  # noqa: BLE001 - we want to capture and surface any load failure
            self._load_error = str(exc)
            logger.exception("Failed to load FraudShield model artifacts")

    def _init_shap_explainer(self) -> None:
        try:
            import shap  # imported lazily so the service can still run with SHAP disabled/unavailable

            model_class = type(self.model).__name__
            if model_class == "LogisticRegression":
                # LinearExplainer needs a background dataset; skip for simplicity if not RF/tree model.
                self.shap_explainer = None
                logger.warning("SHAP LinearExplainer background data not bundled; explanations disabled for LR.")
            else:
                self.shap_explainer = shap.TreeExplainer(self.model)
        except Exception:  # noqa: BLE001
            logger.exception("Could not initialize SHAP explainer; explainability endpoint will be unavailable.")
            self.shap_explainer = None

    def _verify_artifacts_exist(self) -> None:
        missing = [
            str(p)
            for p in [settings.PREPROCESSOR_PATH, settings.MODEL_METADATA_PATH, settings.FEATURE_NAMES_PATH]
            if not p.exists()
        ]
        if missing:
            raise FileNotFoundError(f"Missing required artifact(s): {missing}")

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.preprocessor is not None and self.metadata is not None

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    # ------------------------------------------------------------------ #
    # Inference
    # ------------------------------------------------------------------ #
    def _require_loaded(self) -> None:
        if not self.is_loaded:
            raise ModelNotLoadedError(
                self._load_error or "Model artifacts are not loaded. Check server startup logs."
            )

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        self._require_loaded()
        return self.preprocessor.transform(df[REQUIRED_COLUMNS])

    def predict_proba(self, X_processed: np.ndarray) -> np.ndarray:
        self._require_loaded()
        return self.model.predict_proba(X_processed)[:, 1]

    def risk_level(self, prob: float) -> str:
        threshold = self.metadata["optimal_threshold"]
        if prob >= max(threshold, 0.75):
            return "HIGH"
        elif prob >= threshold:
            return "MEDIUM"
        return "LOW"

    def predict_transaction(self, transaction: dict) -> dict:
        self._require_loaded()
        tx_df = pd.DataFrame([transaction])[REQUIRED_COLUMNS]
        X_proc = self.transform(tx_df)
        prob = float(self.predict_proba(X_proc)[0])
        threshold = self.metadata["optimal_threshold"]
        prediction = int(prob >= threshold)
        return {
            "prediction": prediction,
            "label": "Fraud" if prediction == 1 else "Legitimate",
            "fraud_probability": round(prob, 6),
            "risk_level": self.risk_level(prob),
            "threshold_used": threshold,
        }

    def predict_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        self._require_loaded()
        X_proc = self.transform(df)
        probs = self.predict_proba(X_proc)
        threshold = self.metadata["optimal_threshold"]
        out = df.copy()
        out["Prediction"] = (probs >= threshold).astype(int)
        out["Fraud_Probability"] = np.round(probs, 6)
        out["Risk_Level"] = [self.risk_level(p) for p in probs]
        return out

    def explain_transaction(self, transaction: dict, top_n: int = 5) -> dict:
        self._require_loaded()
        if self.shap_explainer is None:
            raise ModelNotLoadedError("SHAP explainability is not available for the loaded model.")

        tx_df = pd.DataFrame([transaction])[REQUIRED_COLUMNS]
        X_proc = self.transform(tx_df)

        base_prediction = self.predict_transaction(transaction)

        raw_shap = self.shap_explainer.shap_values(X_proc)
        if isinstance(raw_shap, list):
            row_shap = raw_shap[1][0]
        elif isinstance(raw_shap, np.ndarray) and raw_shap.ndim == 3:
            row_shap = raw_shap[0, :, 1]
        else:
            row_shap = raw_shap[0]

        contrib = pd.Series(row_shap, index=self.feature_names).sort_values()
        top_increasing = [
            {"feature": f, "contribution": float(v)} for f, v in contrib.tail(top_n)[::-1].items()
        ]
        top_decreasing = [
            {"feature": f, "contribution": float(v)} for f, v in contrib.head(top_n).items()
        ]
        return {
            "prediction": base_prediction,
            "top_increasing_risk": top_increasing,
            "top_decreasing_risk": top_decreasing,
        }


# Module-level singleton used across the app (loaded once at startup — see main.py lifespan)
model_service = ModelService()
