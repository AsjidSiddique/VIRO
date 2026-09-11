# Architecture

## Overview

FraudShield is split into two independently deployable services:

```
Next.js Frontend (Vercel)  --HTTPS-->  FastAPI Backend (persistent container)  --loads-->  Artifacts
```

The frontend is a static/SSR Next.js app with no server-side ML dependencies — it is safe to
deploy to Vercel's serverless/edge environment. The backend is a standard Python process that
must run somewhere that keeps a process alive and in memory between requests (a container, VM,
or platform like Render/Railway/Fly.io) because it loads a ~11MB scikit-learn model once at
startup and reuses it for every request.

## Why not run inference inside Vercel functions?

- scikit-learn + a Random Forest artifact do not fit well into typical serverless cold-start /
  package-size constraints, and reloading the model on every cold start would be slow and wasteful.
- SHAP explanation computation is CPU-bound and benefits from a warm, long-lived process.
- Keeping ML inference in a dedicated Python service also keeps the frontend bundle free of any
  Python/ML dependency, which is what actually lets `npm run build` stay fast and portable.

## Request flow (single prediction)

1. Frontend form (`/predict`) validates input client-side with Zod (30 required numeric fields).
2. `POST /api/predict` sent to the FastAPI service with the transaction JSON.
3. FastAPI validates the payload against a Pydantic model (`extra="forbid"`, typed floats).
4. `ModelService.predict_transaction()`:
   - Applies the **already-fitted** `preprocessor.pkl` (`.transform()` only — never `.fit()`).
   - Calls `model.predict_proba()` on the trained Random Forest.
   - Applies the threshold stored in `model_metadata.json`.
   - Computes a LOW/MEDIUM/HIGH risk label from the same threshold.
5. Response returned to the frontend and rendered in `ResultCard` + `RiskGauge`.

## Request flow (batch)

Same as above, but for every row in an uploaded CSV, after column/type/size validation
(`validation_service.py`) rejects malformed files before any preprocessing is attempted.

## Model loading lifecycle

The model, preprocessor, and metadata are loaded exactly once, in FastAPI's `lifespan` context
manager (`app/main.py`), at process startup — not per-request, and not lazily on first request.
If artifacts are missing or fail to load, `/health` reports `"status": "degraded"` with a
non-leaking error detail, rather than crashing the whole process or silently serving broken
predictions.
