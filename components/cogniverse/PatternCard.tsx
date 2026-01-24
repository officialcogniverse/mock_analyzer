"use client";

import { AlertTriangle, Flame, ShieldAlert, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import type { PatternInsight, Severity } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

const severityStyles: Record<Severity, { label: string; icon: typeof Sparkles; tone: string }> = {
  low: {
    label: "Low",
    icon: Sparkles,
    tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  medium: {
    label: "Medium",
    icon: AlertTriangle,
    tone: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  high: {
    label: "High",
    icon: Flame,
    tone: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  },
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    tone: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
};

type PatternCardProps = {
  pattern: PatternInsight;
  onOpen?: (pattern: PatternInsight) => void;
};

export function PatternCard({ pattern, onOpen }: PatternCardProps) {
  const reducedMotion = useReducedMotionSafe();
  const severity = severityStyles[pattern.severity];
  const Icon = severity.icon;

  return (
    <motion.button
      type="button"
      layout
      whileHover={reducedMotion ? undefined : { y: -4 }}
      transition={{ duration: motionDuration(reducedMotion, 0.22) }}
      onClick={() => onOpen?.(pattern)}
      className={cn(
        "surface-card tap-scale flex h-full flex-col gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "transition-colors hover:border-primary/35",
      )}
      aria-label={`${pattern.title} pattern insight`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", severity.tone)}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {severity.label}
            </span>
            {pattern.isHypothesis ? (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Hypothesis
              </span>
            ) : null}
          </div>
          <h3 className="text-base font-semibold leading-snug sm:text-lg">{pattern.title}</h3>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
          <p>{pattern.evidence}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fastest fix</p>
          <p className="font-medium text-primary">{pattern.fix}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {pattern.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
    </motion.button>
  );
}
