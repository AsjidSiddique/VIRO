"""
Pydantic request/response schemas.

TransactionIn deliberately enumerates every one of the 30 required fields (Time, V1-V28,
Amount) as required floats, rather than accepting an arbitrary dict, so malformed or
incomplete input is rejected by FastAPI's own validation layer before it ever reaches the
model — no silent NaNs, no partially-filled feature vectors.
"""
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class TransactionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    Time: float = Field(..., description="Seconds elapsed since the first transaction in the reference dataset")
    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float
    Amount: float = Field(..., ge=0, description="Transaction amount (same currency unit as training data)")


class PredictionOut(BaseModel):
    prediction: int
    label: Literal["Fraud", "Legitimate"]
    fraud_probability: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    threshold_used: float


class FeatureContribution(BaseModel):
    feature: str
    contribution: float


class ExplanationOut(BaseModel):
    prediction: PredictionOut
    top_increasing_risk: list[FeatureContribution]
    top_decreasing_risk: list[FeatureContribution]
    disclaimer: str = (
        "SHAP values describe this model's behavior for this transaction. They do not "
        "establish that any feature causally caused fraud, and V1-V28 are anonymized "
        "PCA-derived features with no disclosed real-world meaning."
    )


class BatchRowResult(BaseModel):
    row_index: int
    prediction: int
    label: Literal["Fraud", "Legitimate"]
    fraud_probability: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]


class BatchPredictionOut(BaseModel):
    row_count: int
    fraud_count: int
    legitimate_count: int
    threshold_used: float
    results: list[BatchRowResult]


class ModelInfoOut(BaseModel):
    project_name: str
    project_version: str
    model_name: str
    model_type: str
    training_date: str
    feature_names: list[str]
    optimal_threshold: float
    cost_fn: float
    cost_fp: float
    random_state: int
    preprocessing_description: str
    training_description: str
    final_metrics: dict
    limitations: list[str]


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_name: str | None = None
    optimal_threshold: float | None = None
    sklearn_version: str | None = None
    detail: str | None = None


class ConfigOut(BaseModel):
    required_columns: list[str]
    max_batch_rows: int
    max_upload_bytes: int
    shap_enabled: bool
    environment: str
