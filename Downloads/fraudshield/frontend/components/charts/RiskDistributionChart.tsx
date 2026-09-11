"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { RiskLevel } from "@/lib/types";

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#f43f5e",
};

export function RiskDistributionChart({ counts }: { counts: Record<RiskLevel, number> }) {
  const data = (Object.keys(counts) as RiskLevel[])
    .map((level) => ({ name: level, value: counts[level] }))
    .filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
          {data.map((d) => (
            <Cell key={d.name} fill={RISK_COLORS[d.name as RiskLevel]} stroke="var(--surface)" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
