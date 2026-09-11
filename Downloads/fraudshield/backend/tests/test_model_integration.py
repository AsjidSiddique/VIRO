"""
MODEL INTEGRATION TEST (required by the project brief, Phase 29).

Loads a real transaction from the bundled sample_transactions.csv, runs it through the
backend's ACTUAL loaded preprocessor + model, and compares the result against the
notebook-generated sample_predictions.csv. If every row matches within floating-point
tolerance, the backend is faithfully reproducing the original notebook's inference
behavior. If not, this test fails loudly rather than silently passing.

Run with: pytest tests/test_model_integration.py -v -s
"""
import numpy as np
import pandas as pd
import pytest

from app.config import settings, REQUIRED_COLUMNS
from app.services.model_service import model_service


@pytest.fixture(scope="module", autouse=True)
def ensure_model_loaded():
    if not model_service.is_loaded:
        model_service.load()
    assert model_service.is_loaded, f"Model failed to load: {model_service.load_error}"


def test_model_integration_matches_notebook_predictions():
    tx_path = settings.SAMPLE_TRANSACTIONS_PATH
    pred_path = settings.SAMPLE_PREDICTIONS_PATH

    if not tx_path.exists() or not pred_path.exists():
        pytest.skip("Sample transaction/prediction files not bundled with this deployment.")

    transactions = pd.read_csv(tx_path)
    expected = pd.read_csv(pred_path)

    scored = model_service.predict_dataframe(transactions)

    prob_diff = np.abs(scored["Fraud_Probability"].values - expected["Fraud_Probability"].values)
    max_diff = float(prob_diff.max())
    predictions_match = np.array_equal(scored["Prediction"].values, expected["Prediction"].values)
    probabilities_match = bool(np.allclose(
        scored["Fraud_Probability"].values, expected["Fraud_Probability"].values, atol=1e-4
    ))

    passed = predictions_match and probabilities_match
    print(f"\nRows compared        : {len(expected)}")
    print(f"Max probability diff : {max_diff:.8f}")
    print(f"Predictions match    : {predictions_match}")
    print(f"Probabilities match  : {probabilities_match}")
    print("MODEL INTEGRATION TEST:", "PASSED" if passed else "FAILED")

    assert passed, (
        f"Backend predictions diverge from notebook-saved predictions "
        f"(max prob diff={max_diff}). Investigate preprocessing/model/threshold drift."
    )
