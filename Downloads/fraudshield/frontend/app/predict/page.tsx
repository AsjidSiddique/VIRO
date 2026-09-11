"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionForm } from "@/components/prediction/TransactionForm";
import { ResultCard } from "@/components/prediction/ResultCard";
import { HistoryPanel } from "@/components/prediction/HistoryPanel";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api";
import { addHistoryEntry, clearHistory, getHistory, type HistoryEntry } from "@/lib/history";
import { useToast } from "@/lib/toast";
import type { PredictionResult, Transaction, SamplesResponse } from "@/lib/types";

export default function PredictPage() {
  const { toast } = useToast();
  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [loadingSamples, setLoadingSamples] = useState(true);

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [, setLastTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // One-time hydration of client-only localStorage data; safe to set directly
    // since this never re-runs and avoids an SSR/client markup mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(getHistory());
    api
      .samples()
      .then(setSamples)
      .catch((err) => setSamplesError(err instanceof ApiError ? err.message : "Could not load sample transactions."))
      .finally(() => setLoadingSamples(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Analyze Transaction"
        description="Submit a single transaction to FraudShield's live inference service. Results come directly from the deployed Random Forest model — nothing here is simulated."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {loadingSamples ? (
            <Skeleton className="mb-6 h-10 w-full" />
          ) : samplesError ? (
            <p className="mb-6 text-xs text-muted">Sample transactions unavailable: {samplesError}</p>
          ) : null}

          <TransactionForm
            samples={samples}
            onResult={(res, tx, err) => {
              setResult(res);
              setLastTransaction(tx);
              setError(err);
              if (res && tx) {
                setHistory(addHistoryEntry(res, tx, "predict"));
                toast(
                  res.prediction === 1 ? "Flagged as fraud." : "Looks legitimate.",
                  res.prediction === 1 ? "error" : "success",
                );
              } else if (err) {
                toast(err, "error");
              }
            }}
          />

          <div className="mt-8">
            {error && <ErrorState message={error} />}
            {result && <ResultCard result={result} />}
          </div>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <HistoryPanel
            entries={history}
            onClear={() => {
              clearHistory();
              setHistory([]);
              toast("Session history cleared.", "info");
            }}
          />
        </div>
      </div>
    </div>
  );
}
