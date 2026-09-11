import type { PredictionResult, Transaction } from "./types";

const STORAGE_KEY = "fraudshield.history.v1";
const MAX_ENTRIES = 25;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  amount: number;
  label: PredictionResult["label"];
  prediction: 0 | 1;
  fraud_probability: number;
  risk_level: PredictionResult["risk_level"];
  threshold_used: number;
  source: "predict" | "explain";
}

function safeParse(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function addHistoryEntry(
  result: PredictionResult,
  transaction: Transaction,
  source: HistoryEntry["source"],
): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    amount: transaction.Amount,
    label: result.label,
    prediction: result.prediction,
    fraud_probability: result.fraud_probability,
    risk_level: result.risk_level,
    threshold_used: result.threshold_used,
    source,
  };
  const next = [entry, ...getHistory()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
