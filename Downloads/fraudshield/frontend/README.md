# FraudShield Frontend

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4. Talks to the FraudShield FastAPI backend
via `NEXT_PUBLIC_API_URL` — no ML/Python dependency in this project.

## Setup

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your backend
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Pages

`/` landing · `/dashboard` live model metrics · `/predict` single-transaction analysis ·
`/batch` CSV batch prediction · `/explainability` SHAP explanations · `/analytics` model
comparison · `/model` model card & pipeline · `/docs` API reference · `/about`

## Deploy to Vercel

Import this `frontend/` directory as the project root in Vercel, set `NEXT_PUBLIC_API_URL` in
the project's environment variables, and deploy.
