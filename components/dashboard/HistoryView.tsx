"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function HistoryView() {
  const [history, setHistory] = React.useState<Array<any>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadHistory() {
      const res = await fetch("/api/history");
      const json = await res.json();
      if (json.ok) setHistory(json.data.items || []);
      setLoading(false);
    }
    void loadHistory();
  }, []);

  React.useEffect(() => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName: "view_history" }),
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <h1 className="text-3xl font-semibold">History</h1>
      <div className="grid gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="rounded-2xl border border-border bg-background p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-4 w-40" />
              <Skeleton className="mt-4 h-3 w-56" />
            </div>
          ))
        ) : history.length ? (
          history.map((item) => (
            <Link
              key={item.attemptId}
              href={item.analysisId ? `/app?analysisId=${item.analysisId}` : "/app"}
              className="rounded-2xl border border-border bg-background p-5 transition hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.exam || "General"}</p>
                  <p className="text-base font-semibold">Attempt {item.attemptId.slice(0, 6)}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toDateString()}
                </span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {item.summary
                  ? item.summary
                  : item.nbaTitles?.length
                  ? item.nbaTitles.join(" · ")
                  : "No actions yet"}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Checklist: {item.completion.completed}/{item.completion.total}
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No attempts yet. Upload your first mock to kick off your plan.
            </p>
            <Button asChild className="mt-4">
              <Link href="/app">Analyze your first mock</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
