"use client";

import { motion } from "framer-motion";
import type { RiskLevel } from "@/lib/types";
import { RISK_COLORS } from "@/lib/utils";

export function RiskGauge({
  probability,
  threshold,
  riskLevel,
}: {
  probability: number;
  threshold: number;
  riskLevel: RiskLevel;
}) {
  const pct = Math.round(probability * 100);
  const thresholdPct = Math.round(threshold * 100);
  const color = RISK_COLORS[riskLevel];

  return (
    <div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/70"
          style={{ left: `${thresholdPct}%` }}
          title={`Decision threshold: ${thresholdPct}%`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>0%</span>
        <span>
          Threshold: <span className="text-foreground">{thresholdPct}%</span>
        </span>
        <span>100%</span>
      </div>
      <p className="mt-3 text-xs text-muted">
        Fraud probability is the model&apos;s raw score. The decision threshold is a separate,
        deliberately chosen cutoff (not 0.5) that converts that score into a Legitimate/Fraud
        decision — these are not the same number.
      </p>
    </div>
  );
}
