import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "text-background bg-[linear-gradient(120deg,#2dd4f0,#7c9bf7,#9b7bf6)] bg-[length:160%_100%] bg-left hover:bg-right hover:shadow-[0_0_28px_-8px_rgba(45,212,240,0.55)] focus-visible:ring-accent",
  secondary:
    "bg-surface-2 text-foreground border border-border hover:bg-surface-3 hover:border-border-strong focus-visible:ring-border",
  ghost: "bg-transparent text-foreground hover:bg-surface-2 focus-visible:ring-border",
  danger: "bg-fraud text-white hover:brightness-110 focus-visible:ring-fraud",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
        "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
