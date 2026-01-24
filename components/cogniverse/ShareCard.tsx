"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, NotebookText, Share2, Sparkles } from "lucide-react";

import type { NextBestAction, Note, Report } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

type ShareCardVariant = "summary" | "progress" | "action" | "note";

type ShareCardProps = {
  variant: ShareCardVariant;
  report: Report;
  action?: NextBestAction;
  note?: Note;
  className?: string;
};

export function ShareCard({ variant, report, action, note, className }: ShareCardProps) {
  const reducedMotion = useReducedMotionSafe();

  const base = (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionDuration(reducedMotion, 0.35) }}
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/18 via-primary/6 to-chart-2/15 p-6 text-left shadow-[0_40px_120px_-70px_rgba(99,102,241,0.55)]",
        "before:absolute before:-right-24 before:-top-20 before:h-72 before:w-72 before:rounded-full before:bg-primary/20 before:blur-3xl",
        className,
      )}
      role="img"
      aria-label="Shareable Cogniverse insight card"
    >
      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
            Cogniverse Coach Report
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-background/70 px-3 py-1 text-xs font-medium text-primary">
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Screenshot-ready
          </div>
        </div>
        {variant === "summary" ? <SummaryCard report={report} /> : null}
        {variant === "progress" ? <ProgressCard report={report} /> : null}
        {variant === "action" && action ? <ActionCard action={action} report={report} /> : null}
        {variant === "note" && note ? <NoteShareCard note={note} /> : null}
      </div>
    </motion.div>
  );

  return base;
}

function SummaryCard({ report }: { report: Report }) {
  const currentAttempt = report.attempts.find((attempt) => attempt.id === report.currentAttemptId) ?? report.attempts[report.attempts.length - 1];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Close the loop on every mock attempt.</p>
        <p className="text-2xl font-semibold leading-snug text-foreground">
          Bottleneck: <span className="text-primary">{report.strategy.bottleneck}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Fastest win: layer your pace so accuracy is safe before you sprint.
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip label={`${report.strategy.confidence}% confidence`} />
          <Chip label={`${report.strategy.signalQuality} signal`} />
          <Chip label={`${report.goal} goal`} />
        </div>
      </div>
      <div className="surface-card flex flex-col gap-3 rounded-[1.6rem] border-primary/10 bg-background/80 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Latest mock</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-semibold text-primary">{currentAttempt.score}</p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
          <div className="space-y-1 text-right text-xs text-muted-foreground">
            <p>Accuracy {currentAttempt.accuracy}%</p>
            <p>Speed {currentAttempt.speed}%</p>
            <p>Consistency {currentAttempt.consistency}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ report }: { report: Report }) {
  const deltas = report.deltas;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Progress that compounds.</p>
        <p className="text-3xl font-semibold leading-tight text-foreground">{report.streakDays}-day streak and rising.</p>
        <p className="text-sm text-muted-foreground">
          You are stacking accuracy and consistency. Keep closing the loop the same day you review.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <DeltaTile label="Accuracy" value={deltas.accuracy} />
          <DeltaTile label="Speed" value={deltas.speed} />
          <DeltaTile label="Risk" value={deltas.risk} tone="down" />
          <DeltaTile label="Consistency" value={deltas.consistency} />
        </div>
      </div>
      <div className="surface-card flex flex-col justify-between rounded-[1.6rem] border-primary/10 bg-background/80 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach note</p>
        <p className="text-lg font-semibold text-foreground">Momentum is real when it is measurable.</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowUpRight className="h-3.5 w-3.5 text-primary" aria-hidden />
          Keep the plan tight, not perfect.
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action, report }: { action: NextBestAction; report: Report }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Next best action</p>
        <p className="text-3xl font-semibold leading-tight text-foreground">{action.title}</p>
        <p className="text-sm text-muted-foreground">{action.summary}</p>
        <div className="flex flex-wrap gap-2">
          <Chip label={`${action.durationMinutes}m`} />
          <Chip label={action.difficulty} />
          <Chip label={`${action.impact}% impact`} />
        </div>
        <div className="space-y-2">
          {action.steps.map((step) => (
            <div key={step.id} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="surface-card flex flex-col justify-between rounded-[1.6rem] border-primary/10 bg-background/80 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Why this helps</p>
        <p className="text-sm text-foreground">{action.whyThisHelps}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {action.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs text-primary">
              {tag}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Strategy: {report.strategy.name}</p>
      </div>
    </div>
  );
}

function NoteShareCard({ note }: { note: Note }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Quick note</p>
        <p className="text-3xl font-semibold leading-tight text-foreground">{note.title}</p>
        <p className="text-sm text-foreground">{note.body}</p>
        <div className="flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </div>
      </div>
      <div className="surface-card flex flex-col justify-between rounded-[1.6rem] border-primary/10 bg-background/80 p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <NotebookText className="h-3.5 w-3.5 text-primary" aria-hidden />
          Remember this
        </div>
        <p className="text-lg font-semibold text-foreground">Your future self will thank you for this trigger.</p>
        <p className="text-xs text-muted-foreground">Linked notes keep strategy sticky under stress.</p>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{label}</span>;
}

function DeltaTile({ label, value, tone }: { label: string; value: number; tone?: "up" | "down" }) {
  const isDown = tone === "down" || value < 0;
  const sign = value > 0 ? "+" : "";

  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold", isDown ? "text-emerald-500" : "text-primary")}>
        {sign}
        {value}
      </p>
      <p className="text-xs text-muted-foreground">vs last mock</p>
    </div>
  );
}
