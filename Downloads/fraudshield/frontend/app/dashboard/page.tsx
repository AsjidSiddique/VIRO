"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ModelComparisonChart } from "@/components/charts/ModelComparisonChart";
import { api, ApiError } from "@/lib/api";
import type { ModelInfo, MetricsResponse } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

export default function DashboardPage() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.model(), api.metrics()])
      .then(([m, met]) => {
        setModel(m);
        setMetrics(met);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <PageHeader title="Dashboard" description="Real-time model information from FraudShield's inference service." />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <PageHeader title="Dashboard" />
        <ErrorState message={error || "FraudShield inference service is currently unavailable."} />
      </div>
    );
  }

  const fm = model.final_metrics;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Dashboard"
        description="How does FraudShield make a decision? Probability &rarr; Threshold &rarr; Risk &rarr; Explanation. Every value below comes live from model_metadata.json via the API."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Model" value={model.model_name} tone="accent" />
        <MetricCard label="Version" value={model.project_version} tone="accent" />
        <MetricCard label="Optimal Threshold" value={formatPercent(model.optimal_threshold, 0)} tone="medium" />
        <MetricCard label="PR-AUC" value={String(fm["PR-AUC"] ?? fm["pr_auc"] ?? "—")} tone="legit" />
        <MetricCard label="ROC-AUC" value={String(fm["ROC-AUC"] ?? fm["roc_auc"] ?? "—")} tone="legit" />
        <MetricCard label="Precision" value={String(fm["Precision"] ?? fm["precision"] ?? "—")} />
        <MetricCard label="Recall" value={String(fm["Recall"] ?? fm["recall"] ?? "—")} />
        <MetricCard label="F1" value={String(fm["F1"] ?? fm["f1"] ?? "—")} />
        <MetricCard label="False Positives" value={String(fm["FP"] ?? "—")} tone="medium" />
        <MetricCard label="False Negatives" value={String(fm["FN"] ?? "—")} tone="fraud" />
      </div>

      {metrics?.model_comparison && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Model Comparison (Test Set)</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelComparisonChart data={metrics.model_comparison} />
          </CardContent>
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Preprocessing</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">{model.preprocessing_description}</CardContent>
      </Card>
    </div>
  );
}
