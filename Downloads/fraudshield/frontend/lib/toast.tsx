"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { border: string; icon: ReactNode; text: string }> = {
  success: {
    border: "border-legit/40",
    icon: <CheckCircle2 className="h-4 w-4 text-legit" aria-hidden />,
    text: "text-legit",
  },
  error: {
    border: "border-fraud/40",
    icon: <XCircle className="h-4 w-4 text-fraud" aria-hidden />,
    text: "text-fraud",
  },
  info: {
    border: "border-accent/40",
    icon: <Info className="h-4 w-4 text-accent" aria-hidden />,
    text: "text-accent",
  },
};

let idSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = ++idSeq;
      setItems((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((item) => {
          const tone = TONE_STYLES[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg border bg-surface/95 px-3.5 py-2.5 text-sm shadow-lg backdrop-blur-md",
                tone.border,
              )}
            >
              {tone.icon}
              <span className="flex-1 text-foreground">{item.message}</span>
              <button
                onClick={() => dismiss(item.id)}
                className="text-muted hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback if used outside provider (shouldn't happen once wired into layout).
    return { toast: () => {} };
  }
  return ctx;
}
