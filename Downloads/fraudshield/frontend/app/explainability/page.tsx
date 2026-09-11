"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionForm } from "@/components/prediction/TransactionForm";
import { ResultCard } from "@/components/prediction/ResultCard";
import { ContributionChart } from "@/components/explainability/ContributionChart";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { addHistoryEntry } from "@/lib/history";
import { useToast } from "@/lib/toast";
import type { PredictionResult, SamplesResponse, ExplanationResult, ConfigResponse, Transaction } from "@/lib/types";
import { BrainCircuit } from "lucide-react";

export default function ExplainabilityPage() {
  const { toast } = useToast();
  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.samples().catch(() => null), api.config().catch(() => null)])
      .then(([s, c]) => {
        setSamples(s);
        setConfig(c);
      })
      .finally(() => setLoadingMeta(false));
  }, []);

  function handleResult(res: PredictionResult | null, tx: Transaction | null, err: string | null) {
    setResult(res);
    setError(err);
    if (res && tx) {
      addHistoryEntry(res, tx, "explain");
    } else if (err) {
      toast(err, "error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Explainability"
        description="SHAP shows which anonymized model features pushed a prediction toward fraud (red) or toward legitimate (green)."
      />

      {loadingMeta ? (
        <Skeleton className="mb-6 h-10 w-full" />
      ) : config && !config.shap_enabled ? (
        <div className="mb-6">
          <ErrorState message="SHAP explainability is not available for the currently loaded model." />
        </div>
      ) : null}

      <TransactionForm
        mode="explain"
        samples={samples}
        onResult={handleResult}
        onExplanation={setExplanation}
      />

      <div className="mt-8 flex flex-col gap-6">
        {error && <ErrorState message={error} />}
        {result && <ResultCard result={result} />}

        {explanation ? (
          <Card>
            <CardHeader>
              <CardTitle>Top Contributing Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ContributionChart
                increasing={explanation.top_increasing_risk}
                decreasing={explanation.top_decreasing_risk}
              />
              <p className="mt-4 text-xs text-muted">{explanation.disclaimer}</p>
            </CardContent>
          </Card>
        ) : (
          !result &&
          !error && (
            <EmptyState
              icon={<BrainCircuit className="h-8 w-8 text-muted" aria-hidden />}
              title="No explanation yet"
              description="Submit a transaction above to see which features drove FraudShield's prediction."
            />
          )
        )}
      </div>
    </div>
  );
}
