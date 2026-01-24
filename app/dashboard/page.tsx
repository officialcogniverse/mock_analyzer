"use client";

import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Sparkles, Target } from "lucide-react";
import { motion } from "framer-motion";

import { EmptyState } from "@/components/cogniverse/EmptyState";
import { NextBestActionRail } from "@/components/cogniverse/NextBestActionRail";
import { SectionHeader } from "@/components/cogniverse/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import { deriveBaselinePlanFromActions, deriveTodayPlan, planCompletion } from "@/lib/domain/selectors";
import type { PlanDay } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

export default function DashboardPage() {
  const reducedMotion = useReducedMotionSafe();
  const { state, toggleTaskComplete } = useCogniverse();
  const report = state.report;
  const hasAttempts = report.attempts.length > 0;

  const todayPlan = report.plan.length ? deriveTodayPlan(report.plan) : deriveBaselinePlanFromActions(report.actions);
  const todayCompletion = planCompletion(todayPlan);

  const handleTaskToggle = (day: PlanDay, taskId: string) => {
    if (day.locked || report.paywall.lockedProgress) return;
    toggleTaskComplete(day.id, taskId);
  };

  if (!hasAttempts) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 pb-16 pt-14 sm:px-6">
        <EmptyState
          title="Upload one mock to generate your plan."
          description="We will pinpoint the bottleneck, show the expected uplift, and give you the fastest next steps."
          ctaLabel="Upload mock"
          ctaHref="/"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-12 sm:px-6 lg:px-10">
      <SectionHeader
        title="Your next mock plan"
        subtitle="One bottleneck. One plan. Finish the actions and watch your score move."
        action={
          <Button asChild className="tap-scale rounded-full">
            <a href="/plan">
              View full plan
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </a>
          </Button>
        }
      />

      <HeroCoachCard />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            <SectionHeader title="Next best actions" subtitle="Limit to three. These are the highest-leverage moves before your next mock." />
            <NextBestActionRail actions={report.actions} />
          </div>

          <div className="space-y-4">
            <SectionHeader title="3–7 day execution plan" subtitle="One goal per day. One or two tasks max." />
            <PlanPreview plan={report.plan} />
          </div>

          <div className="space-y-4">
            <SectionHeader title="Why we&apos;re suggesting this" subtitle="Signals, assumptions, and confidence — so you can trust the plan." />
            <TrustPanel />
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <TodayExecutionCard day={todayPlan} completion={todayCompletion} onToggleTask={handleTaskToggle} reducedMotion={reducedMotion} />
          <SoftPaywallCard />
        </aside>
      </section>
    </main>
  );
}

function HeroCoachCard() {
  const { state } = useCogniverse();
  const { hero, trust, paywall, learning } = state.report;

  return (
    <section className="surface-card flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Badge className="rounded-full border-primary/15 bg-primary/10 text-primary">
            <Target className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Primary bottleneck
          </Badge>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{hero.primaryBottleneck}</h2>
          <p className="max-w-3xl text-base text-muted-foreground">
            Follow the plan and your strategy will update based on your next attempt.
          </p>
        </div>
        <div className="grid min-w-[220px] gap-3">
          <HeroStat label="Expected uplift" value={hero.upliftRange} hint="based on similar bottlenecks" />
          <HeroStat label="Daily commitment" value={`${hero.dailyCommitmentMinutes} minutes`} hint="finish the top action first" />
          <HeroStat label="Confidence" value={trust.confidenceBand.toUpperCase()} hint={`${learning.actionCompletionRate}% action completion`} />
        </div>
      </div>

      {!paywall.isPremium ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Free plan: summary + first action</p>
            <p className="text-xs text-muted-foreground">Unlock the full reasoning, every action, and progress tracking before your next mock.</p>
          </div>
          <Button className="tap-scale rounded-full">{paywall.ctaLabel}</Button>
        </div>
      ) : null}
    </section>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/95 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function TodayExecutionCard({
  day,
  completion,
  onToggleTask,
  reducedMotion,
}: {
  day: PlanDay;
  completion: number;
  onToggleTask: (day: PlanDay, taskId: string) => void;
  reducedMotion: boolean;
}) {
  const { state } = useCogniverse();
  const locked = day.locked || state.report.paywall.lockedProgress;

  return (
    <section className="surface-card relative flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Today&apos;s focus</p>
          <h3 className="text-lg font-semibold">{day.focus}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Progress</p>
          <p className="text-2xl font-semibold text-primary">{completion}%</p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${completion}%` }}
          transition={{ duration: motionDuration(reducedMotion, 0.6), ease: "easeOut" }}
        />
      </div>

      <div className="space-y-2">
        {day.tasks.slice(0, 2).map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onToggleTask(day, task.id)}
            className={cn(
              "flex w-full items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/95 p-3 text-left transition",
              task.completed && !locked ? "border-emerald-500/40 bg-emerald-500/5" : "",
              locked ? "cursor-not-allowed opacity-80" : "hover:border-primary/40",
            )}
            aria-pressed={task.completed}
            disabled={locked}
          >
            <div>
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground">{task.why}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatMinutes(task.durationMinutes)}</span>
              {task.completed && !locked ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : null}
            </div>
          </button>
        ))}
      </div>

      {locked ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/90 text-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="h-4 w-4 text-primary" aria-hidden />
            Progress tracking is locked
          </div>
          <p className="max-w-xs text-xs text-muted-foreground">Mark tasks done to track progress.</p>
          <Button size="sm" className="tap-scale rounded-full">{state.report.paywall.ctaLabel}</Button>
        </div>
      ) : null}
    </section>
  );
}

function PlanPreview({ plan }: { plan: PlanDay[] }) {
  const { state } = useCogniverse();
  const variant = state.report.planVariant;
  const previewDays = plan.slice(0, variant);

  return (
    <section className="surface-card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Plan length</p>
          <h3 className="text-lg font-semibold">{variant}-day sprint</h3>
        </div>
        <Button asChild variant="outline" className="tap-scale rounded-full">
          <a href="/plan">Adjust plan</a>
        </Button>
      </div>
      <div className="grid gap-3">
        {previewDays.map((day, index) => (
          <div key={day.id} className="relative overflow-hidden rounded-2xl border border-border/70 bg-background/95 p-4">
            <div className={cn(day.locked ? "pointer-events-none select-none blur-[1px]" : "")}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Day {index + 1}</p>
                <span className="text-xs text-muted-foreground">{day.tasks.length} task{day.tasks.length > 1 ? "s" : ""}</span>
              </div>
              <p className="text-sm text-muted-foreground">{day.focus}</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {day.tasks.slice(0, 2).map((task) => (
                  <p key={task.id}>• {task.title}</p>
                ))}
              </div>
            </div>
            {day.locked ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/85 text-center">
                <Lock className="h-4 w-4 text-primary" aria-hidden />
                <p className="text-xs font-medium text-foreground">Premium plan day</p>
                <p className="max-w-xs text-[11px] text-muted-foreground">Unlock every day&apos;s focus and tasks.</p>
                <Button size="sm" className="tap-scale rounded-full">{state.report.paywall.ctaLabel}</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustPanel() {
  const { state } = useCogniverse();
  const { trust, paywall } = state.report;
  const locked = paywall.lockedReasoning || trust.locked;

  return (
    <section className="surface-card relative flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          Trust signals
        </div>
        <Badge variant="secondary" className="rounded-full border-border/70 bg-muted/70 text-xs text-muted-foreground">
          Confidence: {trust.confidenceBand}
        </Badge>
      </div>

      <div className={cn("grid gap-4 md:grid-cols-2", locked ? "pointer-events-none select-none blur-[1px]" : "")}>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Signals used</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trust.signals.slice(0, 4).map((signal) => (
              <li key={signal} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assumptions</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trust.assumptions.slice(0, 4).map((assumption) => (
              <li key={assumption} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                <span>{assumption}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Separator />
      <p className={cn("text-sm text-muted-foreground", locked ? "blur-[1px]" : "")}>{trust.reasoning}</p>

      {locked ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/90 text-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="h-4 w-4 text-primary" aria-hidden />
            Strategy reasoning is locked
          </div>
          <p className="max-w-xs text-xs text-muted-foreground">Unlock the full &quot;why&quot; behind every recommendation.</p>
          <Button size="sm" className="tap-scale rounded-full">{paywall.ctaLabel}</Button>
        </div>
      ) : null}
    </section>
  );
}

function SoftPaywallCard() {
  const { state } = useCogniverse();
  const { paywall } = state.report;

  return (
    <section className="surface-card flex flex-col gap-3 border-primary/15 bg-primary/5 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" aria-hidden />
        Unlock your full improvement plan
      </div>
      <p className="text-sm text-muted-foreground">{paywall.ctaHint}</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>• All 3 actions with reasoning</li>
        <li>• Full 3/5/7 day plan</li>
        <li>• Progress tracking that updates your strategy</li>
      </ul>
      <Button className="tap-scale mt-1 rounded-full">{paywall.ctaLabel}</Button>
    </section>
  );
}
