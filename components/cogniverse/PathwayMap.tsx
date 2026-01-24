"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Map, Milestone, Route, Sparkles } from "lucide-react";

import { ActionDetailSheet } from "@/components/cogniverse/ActionDetailSheet";
import { Button } from "@/components/ui/button";
import { useCogniverse } from "@/lib/domain/mockData";
import type { NextBestAction, PlanDay, PlanTask } from "@/lib/domain/types";
import { planCompletion } from "@/lib/domain/selectors";
import { formatDate, formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

type PathwayStyle = "metro" | "roadmap";

type PathwayMapProps = {
  plan: PlanDay[];
  actions: NextBestAction[];
  className?: string;
};

export function PathwayMap({ plan, actions, className }: PathwayMapProps) {
  const reducedMotion = useReducedMotionSafe();
  const { toggleTaskComplete } = useCogniverse();
  const [style, setStyle] = React.useState<PathwayStyle>("metro");
  const [activeDayId, setActiveDayId] = React.useState<string>(plan.find((day) => day.status === "current")?.id ?? plan[0]?.id);
  const [activeActionId, setActiveActionId] = React.useState<string | null>(null);
  const [sparkDayId, setSparkDayId] = React.useState<string | null>(null);

  const activeDay = plan.find((day) => day.id === activeDayId) ?? plan[0];
  const activeAction = actions.find((action) => action.id === activeActionId);

  const triggerSpark = React.useCallback(
    (dayId: string) => {
      setSparkDayId(dayId);
      window.setTimeout(() => setSparkDayId((current) => (current === dayId ? null : current)), reducedMotion ? 0 : 700);
    },
    [reducedMotion],
  );

  const handleTaskToggle = React.useCallback(
    (day: PlanDay, task: PlanTask) => {
      toggleTaskComplete(day.id, task.id);
      triggerSpark(day.id);
    },
    [toggleTaskComplete, triggerSpark],
  );

  return (
    <div className={cn("surface-card flex flex-col gap-6 p-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Plan pathway</p>
          <h2 className="text-2xl font-semibold">Your adaptive route to the next mock.</h2>
          <p className="text-sm text-muted-foreground">Switch views. Same plan, different mental model.</p>
        </div>
        <div className="flex w-full gap-2 md:w-auto">
          <ToggleButton active={style === "metro"} onClick={() => setStyle("metro")} icon={Map} label="Metro map" />
          <ToggleButton active={style === "roadmap"} onClick={() => setStyle("roadmap")} icon={Route} label="Roadmap" />
        </div>
      </div>

      {style === "metro" ? (
        <MetroMap
          plan={plan}
          activeDayId={activeDayId}
          onSelectDay={setActiveDayId}
          sparkDayId={sparkDayId}
          reducedMotion={reducedMotion}
        />
      ) : (
        <Roadmap
          plan={plan}
          activeDayId={activeDayId}
          onSelectDay={setActiveDayId}
          sparkDayId={sparkDayId}
          reducedMotion={reducedMotion}
        />
      )}

      {activeDay ? (
        <DayPanel
          day={activeDay}
          actions={actions}
          onToggleTask={handleTaskToggle}
          onOpenAction={(actionId) => setActiveActionId(actionId)}
        />
      ) : null}

      <ActionDetailSheet
        action={activeAction}
        open={Boolean(activeAction)}
        onOpenChange={(open) => (!open ? setActiveActionId(null) : undefined)}
        onShare={() => undefined}
      />
    </div>
  );
}

type MapViewProps = {
  plan: PlanDay[];
  activeDayId?: string;
  onSelectDay: (dayId: string) => void;
  sparkDayId: string | null;
  reducedMotion: boolean;
};

function MetroMap({ plan, activeDayId, onSelectDay, sparkDayId, reducedMotion }: MapViewProps) {
  return (
    <div className="relative overflow-hidden rounded-[1.8rem] border border-primary/15 bg-gradient-to-br from-primary/15 via-background to-chart-2/10 p-4">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {plan.map((day, index) => {
          const completion = planCompletion(day);
          const isActive = day.id === activeDayId;
          const isSpark = sparkDayId === day.id;

          return (
            <div key={day.id} className="relative flex min-w-[220px] flex-col">
              {index < plan.length - 1 ? (
                <div className="absolute left-[calc(50%+48px)] top-10 hidden h-0.5 w-[120px] bg-primary/30 md:block" aria-hidden />
              ) : null}
              <motion.button
                type="button"
                onClick={() => onSelectDay(day.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-3 rounded-3xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "border-primary/50 bg-background/80" : "border-border/60 bg-background/70 hover:border-primary/40",
                )}
                whileHover={reducedMotion ? undefined : { y: -3 }}
                transition={{ duration: motionDuration(reducedMotion, 0.2) }}
                aria-pressed={isActive}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{day.label}</span>
                  {day.milestone ? (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
                      Milestone
                    </span>
                  ) : null}
                </div>
                <div className="flex w-full items-center gap-3">
                  <NodeDot day={day} completion={completion} reducedMotion={reducedMotion} />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{day.focus}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(day.date)} · {completion}% complete</p>
                  </div>
                </div>
                {isSpark ? <SparkBurst reducedMotion={reducedMotion} /> : null}
              </motion.button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Roadmap({ plan, activeDayId, onSelectDay, sparkDayId, reducedMotion }: MapViewProps) {
  return (
    <div className="relative overflow-hidden rounded-[1.8rem] border border-primary/15 bg-gradient-to-br from-background via-primary/5 to-chart-2/10 p-4">
      <div className="relative flex flex-col gap-4 pl-3">
        <div className="absolute left-5 top-2 h-[calc(100%-1rem)] w-0.5 bg-primary/20" aria-hidden />
        {plan.map((day) => {
          const completion = planCompletion(day);
          const isActive = day.id === activeDayId;
          const isSpark = sparkDayId === day.id;

          return (
            <motion.button
              key={day.id}
              type="button"
              onClick={() => onSelectDay(day.id)}
              className={cn(
                "group relative flex flex-col gap-2 rounded-3xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "border-primary/50 bg-background/85" : "border-border/60 bg-background/70 hover:border-primary/35",
              )}
              whileHover={reducedMotion ? undefined : { x: 2 }}
              transition={{ duration: motionDuration(reducedMotion, 0.2) }}
              aria-pressed={isActive}
            >
              <div className="flex items-start gap-3">
                <NodeDot day={day} completion={completion} reducedMotion={reducedMotion} compact />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{day.label}</span>
                    {day.milestone ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
                        <Milestone className="h-3 w-3" aria-hidden />
                        {day.milestone}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold">{day.focus}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(day.date)} · {completion}% complete</p>
                </div>
              </div>
              {isSpark ? <SparkBurst reducedMotion={reducedMotion} /> : null}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

type NodeDotProps = {
  day: PlanDay;
  completion: number;
  reducedMotion: boolean;
  compact?: boolean;
};

function NodeDot({ day, completion, reducedMotion, compact }: NodeDotProps) {
  const isCurrent = day.status === "current";
  const isCompleted = day.status === "completed" || completion === 100;

  return (
    <div className="relative grid place-items-center">
      <motion.span
        className={cn(
          "grid place-items-center rounded-full border-2",
          compact ? "h-11 w-11" : "h-14 w-14",
          isCompleted ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-500" : "border-primary/50 bg-primary/12 text-primary",
        )}
        animate={
          reducedMotion || !isCurrent
            ? undefined
            : {
                scale: [1, 1.05, 1],
                boxShadow: ["0 0 0px rgba(99,102,241,0.25)", "0 0 18px rgba(99,102,241,0.35)", "0 0 0px rgba(99,102,241,0.25)"],
              }
        }
        transition={{ duration: motionDuration(reducedMotion, 1.6), repeat: isCurrent && !reducedMotion ? Infinity : 0 }}
      >
        {isCompleted ? <CheckCircle2 className="h-6 w-6" aria-hidden /> : <span className="text-sm font-semibold">{day.dayIndex}</span>}
      </motion.span>
      {isCurrent && !reducedMotion ? (
        <motion.span
          className="absolute inset-0 rounded-full border border-primary/30"
          animate={{ scale: [1, 1.18], opacity: [0.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

function SparkBurst({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.35 }}
        className="pointer-events-none absolute -right-3 -top-3 rounded-full border border-primary/20 bg-background/80 p-2 text-primary shadow-lg"
        aria-hidden
      >
        <Sparkles className="h-4 w-4" />
      </motion.div>
    </AnimatePresence>
  );
}

type DayPanelProps = {
  day: PlanDay;
  actions: NextBestAction[];
  onToggleTask: (day: PlanDay, task: PlanTask) => void;
  onOpenAction: (actionId: string) => void;
};

function DayPanel({ day, actions, onToggleTask, onOpenAction }: DayPanelProps) {
  const completion = planCompletion(day);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{day.label} · {formatDate(day.date)}</p>
            <h3 className="text-xl font-semibold">{day.focus}</h3>
            <p className="text-sm text-muted-foreground">Completion: {completion}% · Energy: {day.energyHint}</p>
          </div>
          {day.milestone ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              <Milestone className="h-3.5 w-3.5" aria-hidden />
              {day.milestone}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {day.tasks.map((task) => {
            const linkedAction = actions.find((action) => action.id === task.actionId);
            return (
              <div key={task.id} className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-background/80 p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{task.title}</p>
                    <span className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                      {formatMinutes(task.durationMinutes)}
                    </span>
                    <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                      {task.type}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{task.why}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {task.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {linkedAction ? (
                    <Button variant="secondary" size="sm" className="tap-scale rounded-full" onClick={() => onOpenAction(linkedAction.id)}>
                      Open action
                    </Button>
                  ) : null}
                  <Button
                    variant={task.completed ? "secondary" : "default"}
                    size="sm"
                    className={cn("tap-scale rounded-full", task.completed ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "")}
                    onClick={() => onToggleTask(day, task)}
                    aria-pressed={task.completed}
                  >
                    {task.completed ? "Completed" : "Mark done"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-4">
        <div className="surface-card space-y-3 border-primary/20 bg-primary/10 p-5">
          <p className="text-sm font-medium text-primary">Why this day exists</p>
          <p className="text-sm text-foreground">
            Each day closes a specific bottleneck. Today focuses on {day.focus.toLowerCase()} to protect your accuracy bank.
          </p>
        </div>
        <div className="surface-card space-y-3 p-5">
          <p className="text-sm font-medium">Keep it screenshot-worthy</p>
          <p className="text-xs text-muted-foreground">Finish two tasks, then share your progress card. Momentum loves witnesses.</p>
          <Button variant="outline" className="tap-scale w-full rounded-2xl">
            Share progress
          </Button>
        </div>
      </div>
    </div>
  );
}

type ToggleButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: typeof Map;
  label: string;
};

function ToggleButton({ active, onClick, icon: Icon, label }: ToggleButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "secondary"}
      onClick={onClick}
      className={cn("tap-scale flex-1 rounded-2xl text-sm font-semibold md:flex-none", active ? "shadow-lg" : "")}
      aria-pressed={active}
      aria-label={`Switch pathway view to ${label}`}
    >
      <Icon className="mr-2 h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
