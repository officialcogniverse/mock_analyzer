"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Plan } from "@/lib/schemas/workflow";

type PlanPathwayProps = {
  plan: Plan;
  onUpdate: (taskId: string, status: string, note?: string) => void;
  savingTaskId?: string | null;
};

export function PlanPathway({ plan, onUpdate, savingTaskId }: PlanPathwayProps) {
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  if (!plan?.days?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Analyze a mock to get your plan.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{plan.horizonDays}-day plan</h2>
        <span className="text-xs text-muted-foreground">Timeline view</span>
      </div>
      <div className="mt-4 space-y-4">
        {plan.days.map((day) => (
          <div key={day.dayIndex} className="rounded-xl border border-border/60 p-4">
            <p className="font-medium">{day.title}</p>
            <div className="mt-3 space-y-3">
              {day.tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.estMinutes ? (
                        <p className="text-xs text-muted-foreground">{task.estMinutes} min</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={task.status}
                        onValueChange={(value) => onUpdate(task.id, value, task.note)}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To do</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="skipped">Skipped</SelectItem>
                          <SelectItem value="difficult">Difficult</SelectItem>
                        </SelectContent>
                      </Select>
                      {savingTaskId === task.id ? (
                        <span className="text-xs text-muted-foreground">Saving…</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      className="h-8 text-xs"
                      placeholder="Add a note (optional)"
                      value={notes[task.id] ?? task.note ?? ""}
                      onChange={(event) =>
                        setNotes((prev) => ({ ...prev, [task.id]: event.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdate(task.id, task.status, notes[task.id])}
                    >
                      Save note
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
