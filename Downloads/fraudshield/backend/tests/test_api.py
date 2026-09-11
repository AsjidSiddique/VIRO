"""
Backend API tests. Run with: pytest tests/ -v

These exercise the REAL loaded model/preprocessor — nothing here is mocked, so a passing
suite means the actual artifacts load and respond correctly through the HTTP layer.
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

# TestClient must be used as a context manager so FastAPI's lifespan (which loads the
# real model artifacts at startup) actually runs — otherwise every request 503s.
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

VALID_TRANSACTION = {
    "Time": 36421.0, "V1": 0.987338132059133, "V2": -0.675308272594103,
    "V3": -1.04618009824165, "V4": -0.395149273077695, "V5": 1.65821916095088,
    "V6": 3.50802188555838, "V7": -0.582692315159673, "V8": 0.838639060809902,
    "V9": 0.150577056516634, "V10": -0.0797336322657531, "V11": -0.123460265128938,
    "V12": 0.0358341422963031, "V13": 0.130920909189354, "V14": 0.286569901640909,
    "V15": 1.36566254625684, "V16": 0.760398843549821, "V17": -0.970782434990631,
    "V18": 0.355525853296915, "V19": 0.0076584607026416, "V20": 0.354624933161745,
    "V21": 0.0519245071435661, "V22": -0.326814696504261, "V23": -0.17847402803007,
    "V24": 1.0417348752098, "V25": 0.438378008289818, "V26": 0.345097396035386,
    "V27": -0.0436253390438819, "V28": 0.0409352082619376, "Amount": 164.21,
}


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["model_loaded"] is True
    assert body["model_name"] == "Random Forest"
    assert body["status"] == "ok"


def test_model_loading(client):
    resp = client.get("/api/model")
    assert resp.status_code == 200
    body = resp.json()
    assert body["model_name"] == "Random Forest"
    assert 0.0 < body["optimal_threshold"] < 1.0
    assert len(body["feature_names"]) == 30


def test_valid_transaction_prediction(client):
    resp = client.post("/api/predict", json=VALID_TRANSACTION)
    assert resp.status_code == 200
    body = resp.json()
    assert body["prediction"] in (0, 1)
    assert body["label"] in ("Fraud", "Legitimate")
    assert 0.0 <= body["fraud_probability"] <= 1.0
    assert body["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert body["threshold_used"] == pytest.approx(0.44, abs=0.05)


def test_invalid_transaction_missing_field(client):
    incomplete = dict(VALID_TRANSACTION)
    del incomplete["V14"]
    resp = client.post("/api/predict", json=incomplete)
    assert resp.status_code == 422


def test_wrong_data_type(client):
    bad = dict(VALID_TRANSACTION)
    bad["Amount"] = "not-a-number"
    resp = client.post("/api/predict", json=bad)
    assert resp.status_code == 422


def test_negative_amount_rejected(client):
    bad = dict(VALID_TRANSACTION)
    bad["Amount"] = -50.0
    resp = client.post("/api/predict", json=bad)
    assert resp.status_code == 422


def test_unknown_extra_field_rejected(client):
    extra = dict(VALID_TRANSACTION)
    extra["extra_field"] = 1.0
    resp = client.post("/api/predict", json=extra)
    assert resp.status_code == 422


def test_threshold_consistency_across_endpoints(client):
    health_threshold = client.get("/health").json()["optimal_threshold"]
    model_threshold = client.get("/api/model").json()["optimal_threshold"]
    predict_threshold = client.post("/api/predict", json=VALID_TRANSACTION).json()["threshold_used"]
    assert health_threshold == model_threshold == predict_threshold


def test_config_endpoint_lists_all_30_fields(client):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    cols = resp.json()["required_columns"]
    assert len(cols) == 30
    assert cols[0] == "Time" and cols[-1] == "Amount"
    assert all(f"V{i}" in cols for i in range(1, 29))
