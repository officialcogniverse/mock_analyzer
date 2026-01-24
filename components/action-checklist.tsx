"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionState, ReportAction } from "@/lib/domain/types";

type ActionChecklistProps = {
  attemptId: string;
  actions: ReportAction[];
  state: ActionState[];
  onStateChange?: (next: ActionState[]) => void;
  className?: string;
};

function toStateMap(state: ActionState[]) {
  return new Map(state.map((row) => [row.actionId, row]));
}

function completionStats(actions: ReportAction[], stateMap: Map<string, ActionState>) {
  const total = actions.length;
  const completed = actions.filter((action) => stateMap.get(action.id)?.status === "completed").length;
  const pending = Math.max(0, total - completed);
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pending, completionRate };
}

export function ActionChecklist({
  attemptId,
  actions,
  state,
  onStateChange,
  className,
}: ActionChecklistProps) {
  const stateMap = useMemo(() => toStateMap(state), [state]);
  const stats = useMemo(() => completionStats(actions, stateMap), [actions, stateMap]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markAction(action: ReportAction, status: ActionState["status"]) {
    setBusyId(action.id);
    try {
      const res = await fetch("/api/actions/mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId,
          actionId: action.id,
          title: action.title,
          status,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update action state.");
      }
      const nextState = state.filter((row) => row.actionId !== action.id);
      if (json?.actionState) {
        nextState.push(json.actionState);
      }
      onStateChange?.(nextState);
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className={cn("rounded-2xl border bg-white p-5 space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Next actions</p>
          <p className="text-xs text-muted-foreground">
            Complete the checklist to close the loop before your next attempt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">
            {stats.completed}/{stats.total} done
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {stats.completionRate}% completion
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {actions.map((action) => {
          const current = stateMap.get(action.id);
          const done = current?.status === "completed";
          const isBusy = busyId === action.id;

          return (
            <div
              key={action.id}
              className={cn(
                "rounded-xl border p-4 transition",
                done ? "border-emerald-200 bg-emerald-50/60" : "bg-white"
              )}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => markAction(action, done ? "pending" : "completed")}
                      disabled={isBusy}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border text-xs font-semibold",
                        done
                          ? "border-emerald-400 bg-emerald-500 text-white"
                          : "border-slate-300 text-slate-500"
                      )}
                      aria-pressed={done}
                      aria-label={`Mark ${action.title} as ${done ? "incomplete" : "complete"}`}
                    >
                      {done ? "✓" : ""}
                    </button>
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                  </div>
                  {action.steps.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {action.steps.slice(0, 3).map((step, idx) => (
                        <li key={`${action.id}-step-${idx}`}>{step}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No steps were provided. Focus on executing the action as described.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="rounded-full">
                    {action.duration}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    Impact: {action.expectedImpact}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => markAction(action, "skipped")}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {!actions.length ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No actions yet. Generate a report to see your next steps.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
