"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { BarChart3, Brain, CheckCircle2, ClipboardList, Share2, Sparkles, Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { ConfidenceMeter } from "@/components/cogniverse/ConfidenceMeter";
import { EmptyState } from "@/components/cogniverse/EmptyState";
import { NextBestActionRail } from "@/components/cogniverse/NextBestActionRail";
import { PatternCardGrid } from "@/components/cogniverse/PatternCardGrid";
import { SectionHeader } from "@/components/cogniverse/SectionHeader";
import { SkeletonCard } from "@/components/cogniverse/SkeletonCard";
import { StreakWidget } from "@/components/cogniverse/StreakWidget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import { computeStreakIntensity, deriveBaselinePlanFromActions, deriveTodayPlan, planCompletion } from "@/lib/domain/selectors";
import type { TuneStrategyAnswers } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

const LazyShareCard = dynamic(() => import("@/components/cogniverse/ShareCard").then((mod) => mod.ShareCard), {
  ssr: false,
  loading: () => <SkeletonCard lines={4} />,
});

export default function DashboardPage() {
  const reducedMotion = useReducedMotionSafe();
  const { state, today, toggleTaskComplete } = useCogniverse();
  const [shareVariant, setShareVariant] = React.useState<"summary" | "progress" | null>(null);
  const [celebrateTaskId, setCelebrateTaskId] = React.useState<string | null>(null);

  const report = state.report;
  const hasAttempts = report.attempts.length > 0;
  const todayPlan = today.tasks.length ? today : deriveBaselinePlanFromActions(report.actions);
  const todayCompletion = planCompletion(todayPlan);
  const streakIntensity = computeStreakIntensity(report);

  const handleTaskToggle = (taskId: string) => {
    toggleTaskComplete(todayPlan.id, taskId);
    setCelebrateTaskId(taskId);
    window.setTimeout(() => setCelebrateTaskId((current) => (current === taskId ? null : current)), reducedMotion ? 0 : 650);
  };

  if (!hasAttempts) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 pb-16 pt-14 sm:px-6">
        <EmptyState
          title="Upload your first mock to unlock your plan."
          description="We will turn one attempt into patterns, next best actions, and a pathway you can actually follow."
          ctaLabel="Upload mock"
          ctaHref="/"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-10">
      <SectionHeader
        title="Dashboard"
        subtitle="Supportive, rigorous, and always pointed at the fastest lift."
        action={
          <div className="flex flex-wrap gap-2">
            <TuneStrategyDialog />
            <Button variant="outline" className="tap-scale rounded-full" onClick={() => setShareVariant("summary")}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden />
              Share summary
            </Button>
          </div>
        }
      />

      {shareVariant ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-primary">Shareable insight</p>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setShareVariant(null)}>
              Close
            </Button>
          </div>
          <LazyShareCard variant={shareVariant} report={report} />
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <CognitiveSummaryCard onShare={() => setShareVariant("summary")} />

          <div className="space-y-4">
            <SectionHeader title="Pattern cards" subtitle="Evidence, severity, and the fix. Hypotheses are labeled clearly." />
            <PatternCardGrid patterns={report.patterns} />
          </div>

          <div className="space-y-4">
            <SectionHeader title="Next best actions" subtitle="No fluff. Just the highest lift you can close today." />
            <NextBestActionRail actions={report.actions} />
          </div>

          <div className="space-y-4">
            <SectionHeader title="Today's plan" subtitle="Derived from your pathway. Short, sharp, and finishable." />
            <TodayPlanCard
              day={todayPlan}
              completion={todayCompletion}
              celebrateTaskId={celebrateTaskId}
              onToggleTask={handleTaskToggle}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StreakWidget streakDays={report.streakDays} weeklyCompletion={report.weeklyCompletion} intensity={streakIntensity} />
            <ConfidenceMeter
              value={report.strategy.confidence}
              description="Confidence rises fastest when we confirm timing splits and see outcomes hold across mocks."
            />
          </div>

          <WhyStrategyPanel />
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
          <TodayChecklistRail day={todayPlan} completion={todayCompletion} onToggleTask={handleTaskToggle} />
          <ShareProgressCard onShare={() => setShareVariant("progress")} />
          <UploadNextMockCard />
        </aside>
      </section>
    </main>
  );
}

function CognitiveSummaryCard({ onShare }: { onShare: () => void }) {
  const { state } = useCogniverse();
  const report = state.report;

  return (
    <section className="surface-card surface-glow flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border-primary/15 bg-primary/10 text-primary">
              <Brain className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Cognitive summary
            </Badge>
            <Badge variant="secondary" className="rounded-full border-border/70 bg-background/80 text-muted-foreground">
              Signal quality: {report.strategy.signalQuality}
            </Badge>
          </div>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{report.strategy.name}</h2>
          <p className="max-w-3xl text-base text-muted-foreground">
            {report.strategy.summary} Primary bottleneck: <span className="font-medium text-foreground">{report.strategy.bottleneck}</span>
          </p>
        </div>
        <div className="surface-card flex min-w-[220px] flex-col gap-3 rounded-[1.75rem] border-primary/15 bg-background/85 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Confidence meter</p>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-semibold text-primary">{report.strategy.confidence}%</p>
            <p className="text-xs text-muted-foreground">Evidence-weighted</p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-chart-2"
              initial={{ width: 0 }}
              animate={{ width: `${report.strategy.confidence}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">This is a hypothesis based on limited signal. Tune it to raise confidence.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <TuneStrategyDialog compact />
        <Button className="tap-scale rounded-full" onClick={onShare}>
          Share summary
        </Button>
      </div>
    </section>
  );
}

type TodayPlanCardProps = {
  day: ReturnType<typeof deriveTodayPlan>;
  completion: number;
  celebrateTaskId: string | null;
  onToggleTask: (taskId: string) => void;
};

function TodayPlanCard({ day, completion, celebrateTaskId, onToggleTask }: TodayPlanCardProps) {
  const reducedMotion = useReducedMotionSafe();

  return (
    <section className="surface-card flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{day.label}</p>
          <h3 className="text-xl font-semibold">{day.focus}</h3>
          <p className="text-sm text-muted-foreground">{completion}% complete · keep the loop short enough to finish.</p>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">{completion}%</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {day.tasks.slice(0, 4).map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionDuration(reducedMotion, 0.25) }}
            className={cn(
              "relative flex flex-col gap-2 rounded-3xl border border-border/70 bg-background/80 p-4 transition hover:border-primary/35",
              task.completed ? "border-emerald-500/40 bg-emerald-500/5" : "",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="font-semibold">{task.title}</p>
                <p className="text-xs text-muted-foreground">{formatMinutes(task.durationMinutes)} · {task.type}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={task.completed ? "secondary" : "default"}
                className={cn("tap-scale rounded-full", task.completed ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "")}
                onClick={() => onToggleTask(task.id)}
                aria-pressed={task.completed}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
                {task.completed ? "Done" : "Mark done"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{task.why}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              {task.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
            <AnimatePresence>
              {celebrateTaskId === task.id && !reducedMotion ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3 }}
                  className="pointer-events-none absolute inset-0 grid place-items-center rounded-3xl bg-background/60"
                  aria-hidden
                >
                  <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Loop closed
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

type TodayChecklistRailProps = {
  day: ReturnType<typeof deriveTodayPlan>;
  completion: number;
  onToggleTask: (taskId: string) => void;
};

function TodayChecklistRail({ day, completion, onToggleTask }: TodayChecklistRailProps) {
  return (
    <section className="surface-card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Today</p>
          <h3 className="text-lg font-semibold">Checklist</h3>
        </div>
        <div className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{completion}%</div>
      </div>
      <div className="space-y-2">
        {day.tasks.slice(0, 4).map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onToggleTask(task.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-left text-sm transition hover:border-primary/35",
              task.completed ? "border-emerald-500/40 bg-emerald-500/5" : "",
            )}
            aria-pressed={task.completed}
          >
            <span className="line-clamp-1 pr-3">{task.title}</span>
            <span className={cn("text-xs font-semibold", task.completed ? "text-emerald-500" : "text-primary")}>{task.completed ? "Done" : "Open"}</span>
          </button>
        ))}
      </div>
      <Separator />
      <p className="text-xs text-muted-foreground">Finish two tasks, then share your progress. Public accountability is a cheat code.</p>
    </section>
  );
}

function ShareProgressCard({ onShare }: { onShare: () => void }) {
  const { state } = useCogniverse();
  return (
    <section className="surface-card surface-glow flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <BarChart3 className="h-4 w-4" aria-hidden />
        Share progress
      </div>
      <p className="text-sm text-muted-foreground">Streak {state.report.streakDays} days · confidence {state.report.strategy.confidence}%.</p>
      <Button className="tap-scale rounded-2xl" onClick={onShare}>
        <Share2 className="mr-2 h-4 w-4" aria-hidden />
        Open share card
      </Button>
    </section>
  );
}

function UploadNextMockCard() {
  return (
    <section className="surface-card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Upload className="h-4 w-4 text-primary" aria-hidden />
        Upload next mock
      </div>
      <p className="text-sm text-muted-foreground">Signal quality compounds with each attempt. The next upload is the unlock.</p>
      <Button variant="outline" className="tap-scale rounded-2xl">
        Upload attempt
      </Button>
    </section>
  );
}

function WhyStrategyPanel() {
  const { state } = useCogniverse();
  const report = state.report;

  return (
    <section className="surface-card flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Why this strategy</p>
          <h3 className="text-2xl font-semibold">Signals, assumptions, confidence.</h3>
        </div>
        <Badge variant="secondary" className="rounded-full border-border/70 bg-muted/60 text-muted-foreground">
          Hypotheses are labeled
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          {report.strategy.signals.map((signal) => (
            <div key={signal.id} className="rounded-3xl border border-border/70 bg-background/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{signal.label}</p>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {(signal.weight * 100).toFixed(0)}% weight
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{signal.detail}</p>
              <p className="pt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Source: {signal.source}</p>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="surface-card space-y-3 border-primary/20 bg-primary/10 p-5">
            <p className="text-sm font-medium text-primary">Assumptions</p>
            <ul className="space-y-2 text-sm text-foreground">
              {report.strategy.assumptions.map((assumption) => (
                <li key={assumption} className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-card space-y-2 p-5">
            <p className="text-sm font-medium">Confidence changes</p>
            <p className="text-xs text-muted-foreground">What raises confidence fastest:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {report.strategy.confidenceNotes.map((note) => (
                <div key={note} className="rounded-2xl border border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type TuneDialogProps = {
  compact?: boolean;
};

function TuneStrategyDialog({ compact }: TuneDialogProps) {
  const { tuneStrategy } = useCogniverse();
  const [answers, setAnswers] = React.useState<TuneStrategyAnswers>({
    timeSplitKnown: "no",
    timeSink: "Mid-difficulty sets",
    mocksPerWeek: "1",
    stressLevel: "Medium",
    weakestTags: ["Selection"],
  });

  const weakestOptions = ["Selection", "Algebra", "RC", "Modern History", "Biology", "Polity"];

  const submit = () => {
    tuneStrategy(answers);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={cn("tap-scale rounded-full", compact ? "" : "bg-primary text-primary-foreground")}>
          <ClipboardList className="mr-2 h-4 w-4" aria-hidden />
          Tune my strategy
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(720px,96vw)] rounded-[2rem] border-border/70">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-semibold">Fill the missing signal</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            This is how we raise confidence without pretending we know everything.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectRow
            label="Time split known?"
            value={answers.timeSplitKnown}
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, timeSplitKnown: value as "yes" | "no" }))}
          />
          <SelectRow
            label="Biggest time sink"
            value={answers.timeSink}
            options={[
              { label: "Mid-difficulty sets", value: "Mid-difficulty sets" },
              { label: "Reviewing correct answers", value: "Reviewing correct answers" },
              { label: "Hard set rabbit holes", value: "Hard set rabbit holes" },
            ]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, timeSink: value }))}
          />
          <SelectRow
            label="Mocks per week"
            value={answers.mocksPerWeek}
            options={[
              { label: "1", value: "1" },
              { label: "2", value: "2" },
              { label: "3+", value: "3+" },
            ]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, mocksPerWeek: value }))}
          />
          <SelectRow
            label="Stress level in mocks"
            value={answers.stressLevel}
            options={[
              { label: "Low", value: "Low" },
              { label: "Medium", value: "Medium" },
              { label: "High", value: "High" },
            ]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, stressLevel: value }))}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Weakest area tags</p>
          <div className="flex flex-wrap gap-2">
            {weakestOptions.map((tag) => {
              const active = answers.weakestTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      weakestTags: active ? prev.weakestTags.filter((item) => item !== tag) : [...prev.weakestTags, tag],
                    }))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/70 bg-background text-muted-foreground hover:border-primary/35",
                  )}
                  aria-pressed={active}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">TODO: replace with backend strategy engine hooks.</p>
          <Button className="tap-scale rounded-2xl" onClick={submit}>
            Refresh my plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SelectRowProps = {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
};

function SelectRow({ label, value, options, onChange }: SelectRowProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/70 bg-background text-muted-foreground hover:border-primary/35",
              )}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
