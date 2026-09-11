"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, ApiError } from "@/lib/api";
import type { ModelInfo } from "@/lib/types";

const PIPELINE_STAGES = [
  "Data", "Validation", "Preprocessing", "Imbalance Handling",
  "Model", "Probability", "Cost-Optimized Threshold", "Risk Decision", "Explanation",
];

export default function ModelPage() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .model()
      .then(setModel)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load model info."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <PageHeader title="Model" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <PageHeader title="Model" />
        <ErrorState message={error || "FraudShield inference service is currently unavailable."} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="Model" description="Everything below is read directly from model_metadata.json — nothing is hardcoded." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Inference Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-2">
                <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent">
                  {stage}
                </span>
                {i < PIPELINE_STAGES.length - 1 && <span className="text-muted">&rarr;</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Final Model</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Model" value={model.model_name} />
            <Row label="Type" value={model.model_type} />
            <Row label="Trained" value={new Date(model.training_date).toLocaleString()} />
            <Row label="Random State" value={String(model.random_state)} />
            <Row label="Optimal Threshold" value={model.optimal_threshold.toFixed(2)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cost-Sensitive Methodology</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Cost — False Negative" value={String(model.cost_fn)} />
            <Row label="Cost — False Positive" value={String(model.cost_fp)} />
            <p className="pt-2 text-xs text-muted">
              These costs are illustrative, configurable business assumptions — not verified real
              banking figures.
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader><CardTitle>Preprocessing</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted">{model.preprocessing_description}</CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader><CardTitle>Training Description</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted">{model.training_description}</CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader><CardTitle>Features ({model.feature_names.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {model.feature_names.map((f) => (
                <span key={f} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
                  {f}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader><CardTitle>Limitations</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {model.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
