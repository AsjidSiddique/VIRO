# Deployment

## Backend

The backend is a standard FastAPI app and must run on a platform that keeps a Python process
alive between requests (it loads an ~11MB model once at startup).

**Docker (recommended, works on Render/Railway/Fly.io/a VM/most container platforms):**

```bash
cd backend
docker build -t fraudshield-backend .
docker run -p 8000:8000 \
  -e FRAUDSHIELD_ALLOWED_ORIGINS=https://your-frontend.vercel.app \
  fraudshield-backend
```

**Bare metal / VM:**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Set `FRAUDSHIELD_ALLOWED_ORIGINS` to your real frontend domain(s) — do not leave it as `*` in
production. Confirm `GET /health` reports `"model_loaded": true` immediately after deploy.

## Frontend (Vercel)

1. Push the repository to GitHub.
2. In Vercel, "Import Project" → select the repo → set **Root Directory** to `frontend/`.
3. Framework preset: Next.js (auto-detected).
4. Add environment variable `NEXT_PUBLIC_API_URL` = your deployed backend URL (no trailing
   slash).
5. Deploy.
6. Test: open `/health`-equivalent by visiting `/dashboard` on the deployed frontend and
   confirming real model data renders (not an error state).
7. Test `/predict` with a sample transaction, then `/batch` with a small CSV.

## Post-deploy checklist

- [ ] `GET {backend}/health` returns `model_loaded: true`
- [ ] `POST {backend}/api/predict` returns a real prediction (compare against
      `backend/models/inference` samples if available)
- [ ] `POST {backend}/api/predict/batch` accepts a CSV and returns per-row results
- [ ] Frontend `/dashboard`, `/analytics`, `/model` render real metadata (not "unavailable")
- [ ] CORS: frontend origin is in `FRAUDSHIELD_ALLOWED_ORIGINS`
- [ ] `.env.local` is not committed; `NEXT_PUBLIC_API_URL` is set in Vercel's dashboard, not in code
