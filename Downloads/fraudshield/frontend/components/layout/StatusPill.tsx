"use client";

import { useHealth } from "@/hooks/useHealth";
import { cn } from "@/lib/utils";

export function StatusPill() {
  const { online, checked } = useHealth();

  const label = !checked ? "Checking..." : online ? "Model Online" : "Service Offline";
  const dotColor = !checked ? "bg-muted" : online ? "bg-legit" : "bg-fraud";
  const textColor = !checked ? "text-muted" : online ? "text-legit" : "text-fraud";

  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-xs sm:inline-flex"
      title="Live status of the FraudShield inference service"
    >
      <span className={cn("relative h-1.5 w-1.5 rounded-full", dotColor)}>
        {checked && online && <span className={cn("status-dot absolute inset-0 rounded-full", "text-legit")} />}
      </span>
      <span className={textColor}>{label}</span>
    </span>
  );
}
