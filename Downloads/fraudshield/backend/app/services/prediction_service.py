"""
Thin orchestration layer over ModelService for single-transaction and batch prediction.
Kept separate from ModelService so API routers depend on a stable, narrow interface rather
than the full model-loading internals.
"""
from app.services.model_service import model_service


def predict_single(transaction: dict) -> dict:
    return model_service.predict_transaction(transaction)


def predict_batch(df):
    return model_service.predict_dataframe(df)
