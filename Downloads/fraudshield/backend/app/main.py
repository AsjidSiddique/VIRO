import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.services.model_service import model_service
from app.api import health, prediction, batch, explainability, model as model_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("fraudshield.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the trained artifacts exactly ONCE at startup — never per-request, never retrained.
    logger.info("Loading FraudShield model artifacts from %s", settings.MODELS_DIR)
    model_service.load()
    if not model_service.is_loaded:
        logger.error("Model failed to load: %s", model_service.load_error)
    yield
    logger.info("Shutting down FraudShield inference service.")


app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak stack traces or filesystem paths to the client.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


app.include_router(health.router)
app.include_router(prediction.router)
app.include_router(batch.router)
app.include_router(explainability.router)
app.include_router(model_router.router)


@app.get("/")
def root():
    return {
        "service": settings.API_TITLE,
        "version": settings.API_VERSION,
        "docs": "/docs",
        "health": "/health",
    }
