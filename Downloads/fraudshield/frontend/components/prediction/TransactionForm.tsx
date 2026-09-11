"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { transactionSchema, V_FEATURE_NAMES, type TransactionFormValues } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import type { PredictionResult, Transaction, SamplesResponse, ExplanationResult } from "@/lib/types";
import { RotateCcw, Sparkles, Info } from "lucide-react";

const DEFAULT_VALUES: TransactionFormValues = {
  Time: 0,
  V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0, V7: 0, V8: 0, V9: 0, V10: 0,
  V11: 0, V12: 0, V13: 0, V14: 0, V15: 0, V16: 0, V17: 0, V18: 0, V19: 0, V20: 0,
  V21: 0, V22: 0, V23: 0, V24: 0, V25: 0, V26: 0, V27: 0, V28: 0,
  Amount: 0,
};

export function TransactionForm({
  onResult,
  samples,
  mode = "predict",
  onExplanation,
}: {
  onResult: (result: PredictionResult | null, transaction: Transaction | null, error: string | null) => void;
  samples: SamplesResponse | null;
  mode?: "predict" | "explain";
  onExplanation?: (explanation: ExplanationResult | null) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: TransactionFormValues) {
    setSubmitting(true);
    onResult(null, null, null);
    onExplanation?.(null);
    try {
      if (mode === "explain") {
        const explanation = await api.explain(values);
        onExplanation?.(explanation);
        onResult(explanation.prediction, values, null);
      } else {
        const result = await api.predict(values);
        onResult(result, values, null);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      onResult(null, null, message);
      onExplanation?.(null);
    } finally {
      setSubmitting(false);
    }
  }


  function fillSample(sample: Transaction | null) {
    if (!sample) return;
    reset(sample);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => fillSample(samples?.legitimate_example ?? null)}
          disabled={!samples?.legitimate_example}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" /> Try Legitimate Example
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => fillSample(samples?.fraud_example ?? null)}
          disabled={!samples?.fraud_example}
          className="gap-2"
          title={!samples?.fraud_example ? "No real fraud example is bundled with these artifacts" : undefined}
        >
          <Sparkles className="h-4 w-4" /> Try Fraud Example
        </Button>
        <Button type="button" variant="ghost" onClick={() => reset(DEFAULT_VALUES)} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>

      {!samples?.fraud_example && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          No fraud example is bundled with the deployed artifacts (the sampled test set happened
          to contain only legitimate transactions) — this button is disabled rather than faking one.
        </p>
      )}

      <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <legend className="col-span-full mb-1 text-sm font-medium text-foreground">
          Core Fields
        </legend>
        <div>
          <label htmlFor="Time" className="mb-1 block text-xs text-muted">
            Time (seconds)
          </label>
          <Input id="Time" type="number" step="any" {...register("Time", { valueAsNumber: true })} />
          {errors.Time && <p className="mt-1 text-xs text-fraud">{errors.Time.message}</p>}
        </div>
        <div>
          <label htmlFor="Amount" className="mb-1 block text-xs text-muted">
            Amount
          </label>
          <Input id="Amount" type="number" step="any" {...register("Amount", { valueAsNumber: true })} />
          {errors.Amount && <p className="mt-1 text-xs text-fraud">{errors.Amount.message}</p>}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          Anonymized Features (V1&ndash;V28)
        </legend>
        <p className="mb-3 text-xs text-muted">
          V1&ndash;V28 are PCA-anonymized features from the original dataset owners. They carry no
          disclosed real-world meaning (e.g. no field maps to &quot;merchant category&quot;) — they are
          model inputs only.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {V_FEATURE_NAMES.map((name) => (
            <div key={name}>
              <label htmlFor={name} className="mb-1 block text-xs text-muted">
                {name}
              </label>
              <Input
                id={name}
                type="number"
                step="any"
                {...register(name, { valueAsNumber: true })}
              />
              {errors[name] && <p className="mt-1 text-xs text-fraud">{errors[name]?.message}</p>}
            </div>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={submitting} className="w-full sm:w-fit">
        {submitting ? "Analyzing transaction..." : "Analyze Transaction"}
      </Button>
    </form>
  );
}
