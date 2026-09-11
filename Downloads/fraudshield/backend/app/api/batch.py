from fastapi import APIRouter, HTTPException, UploadFile, File

from app.schemas import BatchPredictionOut, BatchRowResult
from app.services import prediction_service
from app.services.model_service import model_service, ModelNotLoadedError
from app.services.validation_service import validate_csv_bytes, BatchValidationError

router = APIRouter(prefix="/api", tags=["batch"])


@router.post("/predict/batch", response_model=BatchPredictionOut)
async def predict_batch(file: UploadFile = File(...)) -> BatchPredictionOut:
    raw = await file.read()

    try:
        df = validate_csv_bytes(raw)
    except BatchValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        scored = prediction_service.predict_batch(df)
    except ModelNotLoadedError as exc:
        raise HTTPException(status_code=503, detail="Inference service unavailable: model not loaded.") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Could not score one or more rows in the uploaded CSV.") from exc

    results = [
        BatchRowResult(
            row_index=int(i),
            prediction=int(row["Prediction"]),
            label="Fraud" if row["Prediction"] == 1 else "Legitimate",
            fraud_probability=float(row["Fraud_Probability"]),
            risk_level=row["Risk_Level"],
        )
        for i, row in scored.reset_index(drop=True).iterrows()
    ]
    fraud_count = sum(1 for r in results if r.prediction == 1)

    return BatchPredictionOut(
        row_count=len(results),
        fraud_count=fraud_count,
        legitimate_count=len(results) - fraud_count,
        threshold_used=model_service.metadata["optimal_threshold"],
        results=results,
    )
