"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

function parseNumeric(value: string): { num: number; prefix: string; suffix: string } | null {
  const match = value.match(/^([^\d-]*)(-?[\d.]+)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2]);
  if (Number.isNaN(num)) return null;
  return { num, prefix: match[1], suffix: match[3] };
}

export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "legit" | "fraud" | "accent" | "medium";
}) {
  const toneClass = {
    legit: "text-legit",
    fraud: "text-fraud",
    accent: "text-accent",
    medium: "text-medium",
  }[tone ?? "accent"];

  const parsed = parseNumeric(value);
  const decimals = parsed
    ? parsed.num % 1 === 0
      ? 0
      : Math.min(2, (String(parsed.num).split(".")[1] || "").length)
    : 0;
  const animated = useCountUp(parsed?.num ?? 0);

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className={cn("mt-1 font-tabular text-2xl font-semibold", toneClass)}>
          {parsed ? `${parsed.prefix}${animated.toFixed(decimals)}${parsed.suffix}` : value}
        </p>
      </CardContent>
    </Card>
  );
}
