"""
Central configuration for the FraudShield inference service.

Everything here is overridable via environment variables so the same code runs
unchanged in local development, Docker, and whatever platform ultimately hosts it.
"""
import os
from pathlib import Path


class Settings:
    # --- Paths -----------------------------------------------------------
    APP_DIR: Path = Path(__file__).resolve().parent
    BACKEND_DIR: Path = APP_DIR.parent
    MODELS_DIR: Path = Path(os.environ.get("FRAUDSHIELD_MODELS_DIR", BACKEND_DIR / "models"))

    PREPROCESSOR_PATH: Path = MODELS_DIR / "preprocessor.pkl"
    MODEL_METADATA_PATH: Path = MODELS_DIR / "model_metadata.json"
    FEATURE_NAMES_PATH: Path = MODELS_DIR / "feature_names.json"
    SAMPLE_TRANSACTIONS_PATH: Path = MODELS_DIR / "sample_transactions.csv"
    SAMPLE_PREDICTIONS_PATH: Path = MODELS_DIR / "sample_predictions.csv"

    # --- CORS --------------------------------------------------------------
    ALLOWED_ORIGINS: list[str] = [
        o.strip()
        for o in os.environ.get(
            "FRAUDSHIELD_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if o.strip()
    ]

    # --- Batch limits --------------------------------------------------------
    MAX_BATCH_ROWS: int = int(os.environ.get("FRAUDSHIELD_MAX_BATCH_ROWS", "5000"))
    MAX_UPLOAD_BYTES: int = int(os.environ.get("FRAUDSHIELD_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10 MB

    # --- Explainability ------------------------------------------------------
    SHAP_ENABLED: bool = os.environ.get("FRAUDSHIELD_SHAP_ENABLED", "true").lower() == "true"

    # --- Misc ----------------------------------------------------------------
    API_TITLE: str = "FraudShield Inference API"
    API_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.environ.get("FRAUDSHIELD_ENV", "development")


settings = Settings()

REQUIRED_COLUMNS = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]
