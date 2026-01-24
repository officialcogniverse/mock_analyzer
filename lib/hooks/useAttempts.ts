"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Attempt } from "@/lib/domain/types";
import { AttemptSchema } from "@/lib/domain/schemas";

type AttemptsState = {
  attempts: Attempt[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

async function fetchAttempts(limit = 12) {
  const res = await fetch(`/api/attempts?limit=${limit}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || "Failed to load attempts.");
  }

  const rows = Array.isArray(json?.attempts) ? json.attempts : [];
  return rows.map((row: unknown) => AttemptSchema.parse(row));
}

export function useAttempts(limit = 12): AttemptsState {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAttempts(limit);
      setAttempts(rows);
    } catch (err: any) {
      setError(err?.message || "Failed to load attempts.");
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({ attempts, loading, error, refresh }),
    [attempts, loading, error, refresh]
  );
}
