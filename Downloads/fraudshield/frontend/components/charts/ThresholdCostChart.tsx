"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

export function ThresholdCostChart({
  data,
  selectedThreshold,
}: {
  data: Record<string, number | string>[];
  selectedThreshold: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="threshold" stroke="var(--muted)" fontSize={12} />
        <YAxis stroke="var(--muted)" fontSize={12} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Line type="monotone" dataKey="business_cost" stroke="#ef4444" dot={false} strokeWidth={2} />
        <ReferenceLine
          x={selectedThreshold}
          stroke="var(--accent)"
          strokeDasharray="4 4"
          label={{ value: "Selected", fill: "var(--accent)", fontSize: 11, position: "top" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
