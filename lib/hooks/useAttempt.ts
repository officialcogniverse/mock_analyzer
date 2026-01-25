"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AttemptDetail } from "@/lib/domain/schemas";
import { AttemptDetailSchema } from "@/lib/domain/schemas";

type AttemptState = {
  data: AttemptDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

async function fetchAttempt(attemptId: string) {
  const res = await fetch(`/api/attempts/${attemptId}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || "Failed to load attempt.");
  }

  return AttemptDetailSchema.parse(json);
}

export function useAttempt(attemptId: string): AttemptState {
  const [data, setData] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAttempt(attemptId);
      setData(next);
    } catch (err: any) {
      setError(err?.message || "Failed to load attempt.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refresh,
    }),
    [data, loading, error, refresh]
  );
}
