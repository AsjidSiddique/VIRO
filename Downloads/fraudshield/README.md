# FraudShield

Explainable, cost-sensitive credit card fraud detection — a research/portfolio project built on
the public [Kaggle Credit Card Fraud Detection dataset](https://www.kaggle.com/mlg-ulb/creditcardfraud)
(284,807 European cardholder transactions, September 2013).

**This is not a real banking production system.** It demonstrates a full pipeline — imbalance-aware
ML, cost-sensitive threshold optimization, SHAP explainability, and a production-style web
application — built around a genuinely trained model, with a FastAPI backend that loads real
saved artifacts and never retrains, and a Next.js frontend that never fabricates results.

## Architecture

```
                Next.js Frontend (Vercel)
   Dashboard · Predict · Batch · Explainability · Analytics · Model · Docs
                          │
                    HTTPS REST API
                          │
                          ▼
              Python FastAPI Inference Service
   validation · preprocessing · model loading · prediction · risk · SHAP
                          │
                          ▼
                 FraudShield Artifacts
   random_forest.pkl · preprocessor.pkl · model_metadata.json · feature_names.json
```

The backend loads the trained artifacts **once** at process startup and holds them in memory —
it never retrains, never refits the preprocessor, and never changes the decision threshold.

## Features

- Cost-sensitive fraud detection with an explicitly documented, configurable business-cost model
- Class-imbalance-aware evaluation (PR-AUC prioritized over accuracy)
- Random Forest (selected final model; Logistic Regression and a PyTorch MLP were also evaluated
  during model development — see the notebook)
- SHAP explainability for individual predictions
- Cost-optimized decision threshold (not a default 0.5)
- Production inference service (`/api/predict`) that only ever loads saved artifacts
- Batch CSV prediction (`/api/predict/batch`) with validation, pagination, search, filtering
- Next.js/TypeScript frontend with a dark fintech-style UI
- FastAPI backend with Pydantic validation, CORS, and no leaked stack traces

## ML Methodology (summary — see `docs/model.md` for full detail)

- **Dataset:** 284,807 transactions, ~0.17% fraud. `Time`, `V1`-`V28` (PCA-anonymized), `Amount`.
- **Preprocessing:** mean-impute + StandardScaler on `Time`/`V1`-`V28`; median-impute + log1p +
  StandardScaler on `Amount`. Fit only on training data.
- **Imbalance handling:** SMOTE (training data only) and class-weighting were compared during
  development; see the training notebook for the full comparison.
- **Final model:** Random Forest, selected by test-set PR-AUC (not accuracy), with Business Cost
  as a tie-breaker.
- **Threshold:** chosen on a held-out validation set by minimizing an illustrative business cost
  (`FN × COST_FN + FP × COST_FP`), never on the test set.
- **Explainability:** SHAP `TreeExplainer` on the Random Forest. SHAP values describe model
  behavior, not causation, and `V1`-`V28` carry no disclosed real-world meaning.

## Metrics (from the bundled `model_metadata.json` / `results/model_comparison.csv`)

See `/dashboard` and `/analytics` in the running app, or `backend/models/model_metadata.json`
directly, for the exact figures — they are read live from the artifacts, not hardcoded anywhere
in this README, so they stay accurate as the model is retrained in the future.

## API Documentation

See [`docs/api.md`](docs/api.md) and the running service's interactive docs at `/docs`
(FastAPI's built-in Swagger UI).

## Local Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` should report `"model_loaded": true`.

Run tests (including the required model integration test):

```bash
pytest tests/ -v -s
```

### Frontend

```bash
cd frontend
cp .env.example .env.local     # then edit NEXT_PUBLIC_API_URL if needed
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Environment Variables

**Backend** (all optional; sensible defaults shown):

| Variable | Default | Purpose |
|---|---|---|
| `FRAUDSHIELD_MODELS_DIR` | `backend/models` | Where artifacts are loaded from |
| `FRAUDSHIELD_ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `FRAUDSHIELD_MAX_BATCH_ROWS` | `5000` | Max rows accepted per batch CSV |
| `FRAUDSHIELD_MAX_UPLOAD_BYTES` | `10485760` (10MB) | Max CSV upload size |
| `FRAUDSHIELD_SHAP_ENABLED` | `true` | Toggle SHAP explainability |
| `FRAUDSHIELD_ENV` | `development` | Environment label |

**Frontend** (`.env.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the deployed FastAPI service (no trailing slash) |

## Deployment

### Backend

```bash
cd backend
docker build -t fraudshield-backend .
docker run -p 8000:8000 -e FRAUDSHIELD_ALLOWED_ORIGINS=https://your-frontend.vercel.app fraudshield-backend
```

Deploy the image to any platform that runs a persistent container (Render, Railway, Fly.io, a
VM, AWS/GCP/Azure container services, etc.) — **not** Vercel's serverless functions, which are
not suited to holding a loaded scikit-learn model in memory. See `docs/deployment.md`.

### Frontend (Vercel)

1. Push this repository to GitHub.
2. Import the `frontend/` directory into Vercel as a new project.
3. Set `NEXT_PUBLIC_API_URL` to your deployed backend's URL in Vercel's project settings.
4. Deploy.
5. Confirm `/health` on the backend responds, then confirm a prediction from `/predict` on the
   deployed frontend, then confirm batch upload on `/batch`.

## GitHub Push Commands

```bash
git init
git add .
git commit -m "FraudShield: explainable, cost-sensitive fraud detection"
git branch -M main
git remote add origin https://github.com/<your-username>/fraudshield.git
git push -u origin main
```

## Known Limitations

- Dataset is a static, historical (Sept 2013) snapshot; real fraud patterns drift over time.
- `V1`-`V28` are anonymized PCA-derived features with no disclosed real-world meaning.
- `COST_FN`/`COST_FP` and the resulting threshold are illustrative business assumptions, not
  verified figures from a real financial institution.
- The bundled sample artifacts do not include a real fraud example (the small sampled test set
  happened to contain only legitimate transactions) — the "Try Fraud Example" button is disabled
  rather than fabricating one.
- `scikit-learn` is pinned to `1.6.1` in `backend/requirements.txt` because the bundled
  `preprocessor.pkl` fails to load under `scikit-learn >= 1.8` (a breaking internal
  `ColumnTransformer` change). Do not upgrade without re-running the integration test.
- Not verified as production-ready for real banking systems without further validation,
  monitoring, and periodic retraining on live data.

## Security Notes

- All prediction endpoints validate input strictly via Pydantic (`extra="forbid"`, typed floats,
  non-negative `Amount`) — malformed requests are rejected before reaching the model.
- Batch CSV uploads are size- and row-limited (`FRAUDSHIELD_MAX_UPLOAD_BYTES`,
  `FRAUDSHIELD_MAX_BATCH_ROWS`) and column/type-validated before any inference is attempted.
- Unhandled exceptions return a generic `500` — no stack traces or filesystem paths are ever
  returned to the client (see `app/main.py`'s global exception handler).
- Model file paths are never exposed to the frontend; the frontend only ever talks to the REST API.
- CORS is restricted via `FRAUDSHIELD_ALLOWED_ORIGINS` — set this to your real frontend domain
  in production, not `*`.

## Future Work

- Feature-drift monitoring against live transaction data.
- A scheduled retraining/validation pipeline rather than a static artifact.
- Authentication/rate-limiting on the inference API for a multi-tenant deployment.
- Persisting and serving the notebook's saved figures (ROC/PR/confusion-matrix PNGs) directly
  from the API for a fully static audit trail alongside the live Recharts visualizations.

## License

This project is provided for educational/portfolio purposes. The underlying dataset is subject
to its own [Kaggle license terms](https://www.kaggle.com/mlg-ulb/creditcardfraud).
