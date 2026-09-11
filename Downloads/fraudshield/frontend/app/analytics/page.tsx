"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ModelComparisonChart } from "@/components/charts/ModelComparisonChart";
import { ThresholdCostChart } from "@/components/charts/ThresholdCostChart";
import { api, ApiError } from "@/lib/api";
import type { MetricsResponse, ModelInfo } from "@/lib/types";

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.metrics(), api.model()])
      .then(([m, mod]) => {
        setMetrics(m);
        setModel(mod);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Model Performance"
        description="Fraud detection is evaluated using imbalance-aware metrics; accuracy alone can be misleading when fraud is roughly 0.17% of all transactions."
      />

      {loading && (
        <div className="grid gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-64" />
        </div>
      )}

      {!loading && (error || !metrics) && (
        <ErrorState message={error || "FraudShield inference service is currently unavailable."} />
      )}

      {!loading && metrics && (
        <div className="flex flex-col gap-6">
          {metrics.model_comparison && (
            <Card>
              <CardHeader>
                <CardTitle>Model Comparison — Precision / Recall / F1 / PR-AUC / ROC-AUC</CardTitle>
              </CardHeader>
              <CardContent>
                <ModelComparisonChart data={metrics.model_comparison} />
              </CardContent>
            </Card>
          )}

          {metrics.model_comparison && (
            <Card>
              <CardHeader>
                <CardTitle>Full Comparison Table</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      {Object.keys(metrics.model_comparison[0]).map((k) => (
                        <th key={k} className="whitespace-nowrap py-2 pr-6 font-medium">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.model_comparison.map((row) => (
                      <tr key={row.Model} className="border-b border-border/60">
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k} className="whitespace-nowrap py-2 pr-6">
                            {typeof v === "number" ? v.toFixed(4) : v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {metrics.threshold_curve && model && (
            <Card>
              <CardHeader>
                <CardTitle>Business Cost vs. Decision Threshold — {model.model_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ThresholdCostChart data={metrics.threshold_curve} selectedThreshold={model.optimal_threshold} />
                <p className="mt-3 text-xs text-muted">
                  Business Cost = FN &times; {model.cost_fn} + FP &times; {model.cost_fp} (illustrative,
                  configurable business assumptions — not verified real banking figures).
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Why PR-AUC?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              With fraud at roughly 0.17% of transactions, ROC-AUC stays deceptively high even for a
              mediocre model because the false-positive <em>rate</em> looks tiny against such a large
              negative class. PR-AUC compares precision directly against recall on the rare class, so it
              reflects real-world usefulness far more faithfully than accuracy or ROC-AUC alone — this is
              why model selection in this project prioritizes PR-AUC.
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
