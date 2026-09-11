import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 4): string {
  return value.toFixed(digits);
}

export const RISK_COLORS: Record<string, string> = {
  LOW: "var(--legit)",
  MEDIUM: "var(--medium)",
  HIGH: "var(--fraud)",
};
