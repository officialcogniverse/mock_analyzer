"use client";

import { CalendarClock, Lock, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/cogniverse/EmptyState";
import { SectionHeader } from "@/components/cogniverse/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import type { PlanVariantDays } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export default function PlanPage() {
  const { state, setPlanVariant } = useCogniverse();
  const report = state.report;

  if (!report.plan.length) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-14 sm:px-6">
        <EmptyState
          title="Plan missing. Generate a report first."
          description="Upload one mock and we will build a short, finishable plan for your next attempt."
          ctaLabel="Upload mock"
          ctaHref="/"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-12 sm:px-6 lg:px-10">
      <SectionHeader
        title="Your 3–7 day plan"
        subtitle="Pick the sprint length you can actually finish. One goal per day, one or two actions max."
        action={<PlanVariantSwitcher current={report.planVariant} onChange={setPlanVariant} options={report.availablePlanVariants} />}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface-card flex flex-col gap-4 p-6">
          {report.plan.slice(0, report.planVariant).map((day, index) => (
            <div key={day.id} className="relative overflow-hidden rounded-2xl border border-border/70 bg-background/95 p-5">
              <div className={cn(day.locked ? "pointer-events-none select-none blur-[1px]" : "")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Day {index + 1}</p>
                    <h3 className="text-lg font-semibold">{day.focus}</h3>
                  </div>
                  <Badge variant="secondary" className="rounded-full border-border/70 bg-muted/70 text-xs text-muted-foreground">
                    {day.tasks.length} action{day.tasks.length > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-2">
                  {day.tasks.slice(0, 2).map((task) => (
                    <div key={task.id} className="rounded-2xl border border-border/70 bg-background/100 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <span className="text-xs text-muted-foreground">{formatMinutes(task.durationMinutes)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{task.why}</p>
                    </div>
                  ))}
                </div>
              </div>

              {day.locked ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/88 text-center">
                  <Lock className="h-4 w-4 text-primary" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">Premium day</p>
                  <p className="max-w-xs text-xs text-muted-foreground">Unlock the full plan to see every day&apos;s goal and steps.</p>
                  <Button size="sm" className="tap-scale rounded-full">{report.paywall.ctaLabel}</Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <section className="surface-card flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
              Daily commitment
            </div>
            <p className="text-3xl font-semibold text-primary">{report.hero.dailyCommitmentMinutes} min</p>
            <p className="text-sm text-muted-foreground">Time-box the first action, then stop. Consistency beats intensity in a short sprint.</p>
            <Separator />
            <p className="text-xs text-muted-foreground">Strategy updates after your next uploaded mock.</p>
          </section>
          <section className="surface-card flex flex-col gap-3 border-primary/15 bg-primary/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
              Unlock the full sprint
            </div>
            <p className="text-sm text-muted-foreground">Free gives you day 1. Premium unlocks every day, all actions, and reasoning.</p>
            <Button className="tap-scale rounded-full">{report.paywall.ctaLabel}</Button>
          </section>
        </aside>
      </section>
    </main>
  );
}

function PlanVariantSwitcher({
  current,
  onChange,
  options,
}: {
  current: PlanVariantDays;
  onChange: (variant: PlanVariantDays) => void;
  options: PlanVariantDays[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option}
          type="button"
          variant={current === option ? "default" : "outline"}
          className="tap-scale rounded-full"
          onClick={() => onChange(option)}
        >
          {option}-day plan
        </Button>
      ))}
    </div>
  );
}
