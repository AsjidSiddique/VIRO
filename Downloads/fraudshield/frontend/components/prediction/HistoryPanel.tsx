"use client";

import { motion, AnimatePresence } from "framer-motion";
import { History, Trash2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPercent } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/history";

const RISK_TONE = { LOW: "legit", MEDIUM: "medium", HIGH: "fraud" } as const;

export function HistoryPanel({
  entries,
  onClear,
}: {
  entries: HistoryEntry[];
  onClear: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 normal-case tracking-normal text-foreground">
          <History className="h-4 w-4 text-accent" aria-hidden />
          Session History
        </CardTitle>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-muted hover:text-fraud"
            aria-label="Clear session history"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            Analyses you run in this browser session will appear here — nothing is sent anywhere,
            it&apos;s stored locally on this device.
          </p>
        ) : (
          <ul className="flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {entries.map((e) => (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {e.prediction === 1 ? (
                      <ShieldAlert className="h-4 w-4 shrink-0 text-fraud" aria-hidden />
                    ) : (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-legit" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {e.label} &middot; ${e.amount.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-tabular text-xs text-foreground">
                      {formatPercent(e.fraud_probability, 1)}
                    </span>
                    <Badge tone={RISK_TONE[e.risk_level]} className="px-1.5 py-0 text-[10px]">
                      {e.risk_level}
                    </Badge>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
