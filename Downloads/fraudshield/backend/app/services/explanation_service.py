"""
Thin orchestration layer over ModelService's SHAP explanation for a single transaction.
"""
from app.services.model_service import model_service


def explain(transaction: dict, top_n: int = 5) -> dict:
    return model_service.explain_transaction(transaction, top_n=top_n)


def shap_available() -> bool:
    return model_service.shap_explainer is not None
