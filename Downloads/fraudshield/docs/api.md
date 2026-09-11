# API Reference

Base URL: value of `NEXT_PUBLIC_API_URL` on the frontend, or wherever you've deployed
`backend/`. Interactive Swagger docs are also available at `/docs` on the running service.

## `GET /health`

Returns service + model load status. Use this for uptime checks and to confirm the deployed
model/threshold before trusting the service.

## `GET /api/model`

Full model metadata: name, type, training date, threshold, cost assumptions, final metrics,
feature names, limitations.

## `GET /api/metrics`

`final_metrics` plus (if bundled) the full cross-model comparison table and threshold-vs-cost
curve, for the Analytics page.

## `GET /api/config`

Required input columns, batch upload limits, whether SHAP is currently available.

## `GET /api/samples`

Real sample transactions bundled with the deployed artifacts (`legitimate_example`,
`fraud_example` — either may be `null` if not present in the bundle; never fabricated).

## `POST /api/predict`

Request body: 30 required numeric fields (`Time`, `V1`-`V28`, `Amount`). Extra fields are
rejected (422). Missing/invalid fields are rejected (422).

```json
{ "Time": 12345, "V1": -1.35, "V2": -0.07, "...": "...", "V28": -0.02, "Amount": 149.50 }
```

Response:

```json
{ "prediction": 1, "label": "Fraud", "fraud_probability": 0.914, "risk_level": "HIGH", "threshold_used": 0.44 }
```

## `POST /api/predict/batch`

`multipart/form-data` with a `file` field (CSV). Columns must include `Time`, `V1`-`V28`,
`Amount`. Rejects oversized files and CSVs exceeding the configured row limit before scoring.

## `POST /api/explain`

Same request body as `/api/predict`. Returns the prediction plus the top SHAP-driving features
in each direction, with an explicit non-causation disclaimer. Returns `503` if SHAP is not
available for the currently loaded model.

## Error format

All errors return `{"detail": "<human-readable message>"}` with an appropriate HTTP status.
Stack traces and filesystem paths are never included.
