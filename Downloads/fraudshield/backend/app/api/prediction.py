from fastapi import APIRouter, HTTPException

from app.schemas import TransactionIn, PredictionOut
from app.services import prediction_service
from app.services.model_service import ModelNotLoadedError

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict", response_model=PredictionOut)
def predict(transaction: TransactionIn) -> PredictionOut:
    try:
        result = prediction_service.predict_single(transaction.model_dump())
    except ModelNotLoadedError as exc:
        raise HTTPException(status_code=503, detail="Inference service unavailable: model not loaded.") from exc
    except Exception as exc:  # noqa: BLE001 - never leak internals/stack traces to the client
        raise HTTPException(status_code=400, detail="Could not score transaction. Check input values.") from exc
    return PredictionOut(**result)
