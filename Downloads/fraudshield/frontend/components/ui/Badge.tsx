import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "legit" | "fraud" | "medium" | "accent" | "neutral";

const tones: Record<Tone, string> = {
  legit: "bg-legit/10 text-legit border-legit/30",
  fraud: "bg-fraud/10 text-fraud border-fraud/30",
  medium: "bg-medium/10 text-medium border-medium/30",
  accent: "bg-accent/10 text-accent border-accent/30",
  neutral: "bg-surface-2 text-muted border-border",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
