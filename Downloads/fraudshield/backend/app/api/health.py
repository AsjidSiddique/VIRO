import sklearn
from fastapi import APIRouter

from app.schemas import HealthOut
from app.services.model_service import model_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    if model_service.is_loaded:
        return HealthOut(
            status="ok",
            model_loaded=True,
            model_name=model_service.metadata["model_name"],
            optimal_threshold=model_service.metadata["optimal_threshold"],
            sklearn_version=sklearn.__version__,
        )
    return HealthOut(
        status="degraded",
        model_loaded=False,
        sklearn_version=sklearn.__version__,
        detail=model_service.load_error or "Model artifacts not loaded.",
    )
