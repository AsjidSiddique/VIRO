from fastapi import APIRouter, HTTPException

from app.schemas import TransactionIn, ExplanationOut
from app.services import explanation_service
from app.services.model_service import ModelNotLoadedError

router = APIRouter(prefix="/api", tags=["explainability"])


@router.post("/explain", response_model=ExplanationOut)
def explain(transaction: TransactionIn) -> ExplanationOut:
    if not explanation_service.shap_available():
        raise HTTPException(
            status_code=503,
            detail="SHAP explainability is not available for the currently loaded model.",
        )
    try:
        result = explanation_service.explain(transaction.model_dump())
    except ModelNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Could not generate explanation for this transaction.") from exc
    return ExplanationOut(**result)
