"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, Copy, SlidersHorizontal } from "lucide-react";
import type { PredictionResult, RiskLevel } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskGauge } from "./RiskGauge";
import { formatPercent } from "@/lib/utils";
import { useToast } from "@/lib/toast";

const RISK_TONE = { LOW: "legit", MEDIUM: "medium", HIGH: "fraud" } as const;

function riskForProbability(p: number): RiskLevel {
  if (p >= 0.7) return "HIGH";
  if (p >= 0.3) return "MEDIUM";
  return "LOW";
}

export function ResultCard({ result }: { result: PredictionResult }) {
  const { toast } = useToast();
  const isFraud = result.prediction === 1;
  const [whatIf, setWhatIf] = useState(result.threshold_used);

  const whatIfIsFraud = result.fraud_probability >= whatIf;
  const whatIfRisk = riskForProbability(result.fraud_probability);
  const whatIfChanged = whatIf !== result.threshold_used;

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      toast("Prediction copied as JSON.", "success");
    } catch {
      toast("Couldn't copy to clipboard.", "error");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className={isFraud ? "glow-fraud border-fraud/30" : "glow-legit border-legit/30"}>
        <CardContent className="flex flex-col gap-6 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {isFraud ? (
                <ShieldAlert className="h-8 w-8 text-fraud" aria-hidden />
              ) : (
                <ShieldCheck className="h-8 w-8 text-legit" aria-hidden />
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Transaction Analysis</p>
                <p className={`text-2xl font-semibold ${isFraud ? "text-fraud" : "text-legit"}`}>
                  {isFraud ? "FRAUD DETECTED" : "LEGITIMATE"}
                </p>
              </div>
            </div>
            <button
              onClick={copyJson}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Copy JSON
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Fraud Probability</p>
              <p className="font-tabular text-xl font-semibold">{formatPercent(result.fraud_probability, 1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Risk Level</p>
              <Badge tone={RISK_TONE[result.risk_level]} className="mt-1">
                {result.risk_level}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted">Decision Threshold</p>
              <p className="font-tabular text-xl font-semibold">{formatPercent(result.threshold_used, 0)}</p>
            </div>
          </div>

          <RiskGauge
            probability={result.fraud_probability}
            threshold={result.threshold_used}
            riskLevel={result.risk_level}
          />

          <div className="rounded-lg border border-border bg-surface-2/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5 text-accent" aria-hidden />
              What-if: try a different decision threshold
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={whatIf}
              onChange={(e) => setWhatIf(parseFloat(e.target.value))}
              className="w-full accent-accent"
              aria-label="Hypothetical decision threshold"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>Threshold: <span className="font-tabular text-foreground">{formatPercent(whatIf, 0)}</span></span>
              <span className="flex items-center gap-2">
                Would decide:
                <Badge tone={whatIfIsFraud ? "fraud" : "legit"}>{whatIfIsFraud ? "Fraud" : "Legitimate"}</Badge>
                <Badge tone={RISK_TONE[whatIfRisk]}>{whatIfRisk}</Badge>
              </span>
            </div>
            {whatIfChanged && (
              <p className="mt-2 text-[11px] text-muted">
                This recomputes the decision locally from the same fraud probability — it doesn&apos;t
                call the model again. It shows why the deployed threshold ({formatPercent(result.threshold_used, 0)}) was
                chosen deliberately rather than left at the default 50%.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
