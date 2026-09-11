FROM python:3.11-slim

WORKDIR /app

# System deps for scientific Python wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY models ./models

ENV FRAUDSHIELD_MODELS_DIR=/app/models
ENV FRAUDSHIELD_ENV=production
ENV FRAUDSHIELD_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app

EXPOSE 8000

# Single worker: the model is loaded once per process; scale via multiple container replicas,
# not multiple uvicorn workers sharing one loaded model in memory across forked processes
# unless you've confirmed your platform's fork behavior reloads artifacts safely per worker.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
