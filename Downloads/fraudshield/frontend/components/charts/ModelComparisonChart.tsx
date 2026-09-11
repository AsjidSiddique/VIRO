"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ModelComparisonRow } from "@/lib/types";

const METRIC_COLORS: Record<string, string> = {
  Precision: "#22d3ee",
  Recall: "#10b981",
  F1: "#f59e0b",
  "PR-AUC": "#ef4444",
  "ROC-AUC": "#a78bfa",
};

export function ModelComparisonChart({ data }: { data: ModelComparisonRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="Model" stroke="var(--muted)" fontSize={12} />
        <YAxis stroke="var(--muted)" fontSize={12} domain={[0, 1]} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
        {Object.entries(METRIC_COLORS).map(([key, color]) => (
          <Bar key={key} dataKey={key} fill={color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
