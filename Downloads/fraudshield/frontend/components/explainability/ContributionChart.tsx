"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import type { FeatureContribution } from "@/lib/types";

export function ContributionChart({
  increasing,
  decreasing,
}: {
  increasing: FeatureContribution[];
  decreasing: FeatureContribution[];
}) {
  const data = [...increasing, ...decreasing].sort((a, b) => a.contribution - b.contribution);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" stroke="var(--muted)" fontSize={12} />
        <YAxis type="category" dataKey="feature" stroke="var(--muted)" fontSize={12} width={60} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => (typeof value === "number" ? value.toFixed(4) : String(value))}
        />
        <Bar dataKey="contribution" radius={4}>
          {data.map((d) => (
            <Cell key={d.feature} fill={d.contribution >= 0 ? "var(--fraud)" : "var(--legit)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
