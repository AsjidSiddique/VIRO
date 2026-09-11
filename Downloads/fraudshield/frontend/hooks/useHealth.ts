"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

export function useHealth(pollMs = 60_000) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await api.health();
        if (!cancelled) setHealth(res);
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    check();
    const interval = window.setInterval(check, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollMs]);

  const online = health?.status === "ok" && health.model_loaded;
  return { health, online, checked };
}
