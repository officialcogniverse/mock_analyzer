"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionChecklistItem = {
  id: string;
  title: string;
  why?: string;
  duration?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  steps?: string[];
};

type ActionChecklistProps = {
  items: ActionChecklistItem[];
  completedIds: Record<string, boolean>;
  completedToday: number;
  streakCount: number;
  onToggle: (id: string, nextDone: boolean) => void;
  onStart?: (id: string) => void;
  className?: string;
};

export function ActionChecklist({
  items,
  completedIds,
  completedToday,
  streakCount,
  onToggle,
  onStart,
  className,
}: ActionChecklistProps) {
  return (
    <Card className={cn("rounded-2xl border bg-white p-5 space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Today’s 3 tasks</p>
          <p className="text-xs text-muted-foreground">
            Keep the streak going with tiny wins.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">
            {completedToday}/3 today
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {streakCount} day streak
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {items.slice(0, 3).map((item) => {
          const done = !!completedIds[item.id];
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border p-4 transition",
                done ? "border-emerald-200 bg-emerald-50/60" : "bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggle(item.id, !done)}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border text-xs font-semibold",
                        done
                          ? "border-emerald-400 bg-emerald-500 text-white"
                          : "border-slate-300 text-slate-500"
                      )}
                      aria-pressed={done}
                      aria-label={`Mark ${item.title} as ${
                        done ? "incomplete" : "complete"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </button>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                  </div>
                  {item.why ? (
                    <p className="text-xs text-muted-foreground">{item.why}</p>
                  ) : null}
                  {item.steps?.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {item.steps.slice(0, 2).map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                  {item.duration ? (
                    <Badge variant="secondary" className="rounded-full">
                      {item.duration}
                    </Badge>
                  ) : null}
                  {item.difficulty ? (
                    <Badge variant="outline" className="rounded-full">
                      {item.difficulty}
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onStart?.(item.id)}
                  >
                    Start
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
