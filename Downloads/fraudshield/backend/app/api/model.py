from fastapi import APIRouter, HTTPException

from app.config import settings, REQUIRED_COLUMNS
from app.schemas import ModelInfoOut, ConfigOut
from app.services.model_service import model_service
from app.services.explanation_service import shap_available

router = APIRouter(prefix="/api", tags=["model"])


@router.get("/model", response_model=ModelInfoOut)
def get_model_info() -> ModelInfoOut:
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="Model metadata unavailable: model not loaded.")
    m = model_service.metadata
    return ModelInfoOut(
        project_name=m["project_name"],
        project_version=m["project_version"],
        model_name=m["model_name"],
        model_type=m["model_type"],
        training_date=m["training_date"],
        feature_names=m["feature_names"],
        optimal_threshold=m["optimal_threshold"],
        cost_fn=m["cost_fn"],
        cost_fp=m["cost_fp"],
        random_state=m["random_state"],
        preprocessing_description=m["preprocessing_description"],
        training_description=m["training_description"],
        final_metrics=m["final_metrics"],
        limitations=m["limitations"],
    )


@router.get("/metrics")
def get_metrics() -> dict:
    """Raw final_metrics block from model_metadata.json, plus the full model_comparison
    table if it was bundled with the artifacts, so the frontend Analytics page can render
    a real cross-model comparison rather than a single-model snapshot."""
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="Metrics unavailable: model not loaded.")
    payload = {"selected_model_metrics": model_service.metadata["final_metrics"]}

    comparison_path = settings.MODELS_DIR / "results" / "model_comparison.csv"
    if comparison_path.exists():
        import pandas as pd
        payload["model_comparison"] = pd.read_csv(comparison_path).to_dict(orient="records")

    threshold_path = settings.MODELS_DIR / "results" / "threshold_results.csv"
    if threshold_path.exists():
        import pandas as pd
        df = pd.read_csv(threshold_path)
        selected_model_name = model_service.metadata["model_name"]
        subset = df[df["model"] == selected_model_name] if "model" in df.columns else df
        payload["threshold_curve"] = subset.to_dict(orient="records")

    return payload


@router.get("/config", response_model=ConfigOut)
def get_config() -> ConfigOut:
    return ConfigOut(
        required_columns=REQUIRED_COLUMNS,
        max_batch_rows=settings.MAX_BATCH_ROWS,
        max_upload_bytes=settings.MAX_UPLOAD_BYTES,
        shap_enabled=shap_available(),
        environment=settings.ENVIRONMENT,
    )


@router.get("/samples")
def get_samples() -> dict:
    """Serves REAL sample transactions/predictions bundled with the artifacts (not fabricated),
    so the frontend's 'Try Legitimate Example' / 'Try Fraud Example' buttons use genuine data."""
    import pandas as pd

    if not settings.SAMPLE_TRANSACTIONS_PATH.exists() or not settings.SAMPLE_PREDICTIONS_PATH.exists():
        raise HTTPException(status_code=404, detail="Sample transaction files were not bundled with this deployment.")

    tx = pd.read_csv(settings.SAMPLE_TRANSACTIONS_PATH)
    preds = pd.read_csv(settings.SAMPLE_PREDICTIONS_PATH)

    legit_idx = preds.index[preds["Prediction"] == 0]
    fraud_idx = preds.index[preds["Prediction"] == 1]

    def row_to_dict(idx):
        if len(idx) == 0:
            return None
        return tx.iloc[idx[0]][REQUIRED_COLUMNS].to_dict()

    return {
        "legitimate_example": row_to_dict(legit_idx),
        "fraud_example": row_to_dict(fraud_idx),
    }
