"use client";

import * as React from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";

type ChecklistProps = {
  actions: Array<any>;
  analysisId?: string | null;
};

export function Checklist({ actions, analysisId }: ChecklistProps) {
  const [done, setDone] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!analysisId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/actions/mark-done?analysisId=${analysisId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.ok) {
          const next: Record<string, boolean> = {};
          (json.data.items || []).forEach((item: { actionId: string; done: boolean }) => {
            next[item.actionId] = item.done;
          });
          setDone(next);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [analysisId]);

  const handleToggle = async (actionId: string, next: boolean) => {
    if (!analysisId) return;
    setDone((prev) => ({ ...prev, [actionId]: next }));
    const res = await fetch("/api/actions/mark-done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, actionId, done: next }),
    });
    const json = await res.json();
    if (!json.ok) {
      toast.error(json.error?.message || "Unable to update");
      setDone((prev) => ({ ...prev, [actionId]: !next }));
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Checklist</h2>
        {loading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
      </div>
      <div className="mt-4 space-y-3">
        {actions?.map((action) => (
          <label
            key={action.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 p-3 text-sm"
          >
            <Checkbox
              checked={done[action.id] ?? false}
              onChange={(event) => handleToggle(action.id, event.currentTarget.checked)}
            />
            <span>{action.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
