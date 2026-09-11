# Explainability

FraudShield uses SHAP (`TreeExplainer`) on the final Random Forest model to explain individual
predictions via `POST /api/explain`.

## What SHAP values mean here

For a given transaction, SHAP assigns each feature a signed contribution to the model's output:
positive values pushed the prediction toward "Fraud", negative values pushed it toward
"Legitimate". The frontend renders these as a horizontal bar chart (red = increasing risk,
green = decreasing risk) on the `/explainability` page.

## What SHAP values do NOT mean

- They do not prove a feature **causes** fraud — they describe this specific model's learned
  behavior on this specific transaction, which is a correlational, not causal, statement.
- `V1`-`V28` are anonymized, PCA-derived features from the original dataset owners. This project
  never assigns them invented real-world meaning (e.g. "V14 represents merchant category") —
  they are referenced purely as `V14`, `V10`, etc. throughout the API, notebook, and UI.

## Availability

SHAP explanation is only available when the loaded model is tree-based (Random Forest in the
current deployment). If a future retrain selects a different model type without an available
explainer, `/api/explain` returns `503` and the frontend shows a clear unavailable state rather
than a fabricated explanation.
