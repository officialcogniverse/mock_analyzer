"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { RecommendationBundleSchema } from "@/lib/schemas/workflow";

type AttemptState = {
  data: {
    attempt: {
      _id: string;
      createdAt: string | null;
      exam?: { detected?: string; confidence?: number };
    };
    recommendation: z.infer<typeof RecommendationBundleSchema>;
  } | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AttemptResponseSchema = z.object({
  ok: z.literal(true),
  attempt: z.object({
    _id: z.string(),
    createdAt: z.string().nullable(),
    exam: z.object({ detected: z.string().optional(), confidence: z.number().optional() }).optional(),
  }),
  recommendation: RecommendationBundleSchema,
});

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

  return AttemptResponseSchema.parse(json);
}

export function useAttempt(attemptId: string): AttemptState {
  const [data, setData] = useState<AttemptState["data"]>(null);
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
