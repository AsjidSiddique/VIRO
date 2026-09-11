"use client";

import { motion } from "framer-motion";

const STAGES = [
  { label: "Probability", color: "#2dd4f0" },
  { label: "Threshold", color: "#f59e0b" },
  { label: "Risk", color: "#f43f5e" },
  { label: "Explanation", color: "#9b7bf6" },
];

export function HeroRiskVisual() {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur-sm sm:p-8">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        {STAGES.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, duration: 0.4 }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full border text-xs font-semibold"
                style={{ borderColor: stage.color, color: stage.color, boxShadow: `0 0 24px -8px ${stage.color}` }}
              >
                {i + 1}
              </div>
              <span className="text-xs text-muted">{stage.label}</span>
            </motion.div>
            {i < STAGES.length - 1 && (
              <span className="hidden text-muted sm:inline" aria-hidden>
                &rarr;
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Every prediction moves through this exact pipeline — nothing is skipped or shortcut.
      </p>
    </div>
  );
}
