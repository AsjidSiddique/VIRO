import type {
  Transaction,
  PredictionResult,
  ExplanationResult,
  BatchPredictionResult,
  ModelInfo,
  MetricsResponse,
  HealthResponse,
  ConfigResponse,
  SamplesResponse,
} from "./types";

// Never hardcode localhost in production components — always resolve from the env var,
// with a local-dev fallback only.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "FraudShield inference service is currently unavailable.",
      0,
    );
  }

  if (!res.ok) {
    let detail = "Request failed.";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore body parse failure
    }
    throw new ApiError(detail, res.status);
  }

  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  config: () => request<ConfigResponse>("/api/config"),
  model: () => request<ModelInfo>("/api/model"),
  metrics: () => request<MetricsResponse>("/api/metrics"),
  samples: () => request<SamplesResponse>("/api/samples"),

  predict: (transaction: Transaction) =>
    request<PredictionResult>("/api/predict", {
      method: "POST",
      body: JSON.stringify(transaction),
    }),

  explain: (transaction: Transaction) =>
    request<ExplanationResult>("/api/explain", {
      method: "POST",
      body: JSON.stringify(transaction),
    }),

  predictBatch: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<BatchPredictionResult>("/api/predict/batch", {
      method: "POST",
      body: formData,
    });
  },
};
