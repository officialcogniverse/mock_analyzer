"use client";

import * as React from "react";

export function HistoryView() {
  const [history, setHistory] = React.useState<Array<any>>([]);

  React.useEffect(() => {
    async function loadHistory() {
      const res = await fetch("/api/history");
      const json = await res.json();
      if (json.ok) setHistory(json.data);
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
        {history.map((item) => (
          <div key={item.attemptId} className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{item.exam || "General"}</p>
                <p className="text-base font-semibold">Attempt {item.attemptId.slice(0, 6)}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toDateString()}</span>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {item.nbaTitles?.length ? item.nbaTitles.join(" · ") : "No actions yet"}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Checklist: {item.completion.completed}/{item.completion.total}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
