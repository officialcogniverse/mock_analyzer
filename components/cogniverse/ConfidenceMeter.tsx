"use client";

import { motion } from "framer-motion";
import { Info, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

type ConfidenceMeterProps = {
  value: number;
  label?: string;
  description?: string;
  mode?: "ring" | "thermo";
  className?: string;
};

export function ConfidenceMeter({
  value,
  label = "Strategy confidence",
  description,
  mode = "ring",
  className,
}: ConfidenceMeterProps) {
  const reducedMotion = useReducedMotionSafe();
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  if (mode === "thermo") {
    return (
      <div className={cn("surface-card flex flex-col gap-4 p-6", className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
          </div>
          <span className="text-sm font-semibold text-primary">{clamped}%</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/70">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-chart-2"
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: motionDuration(reducedMotion, 0.6), ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {description ?? "Confidence grows as signal quality improves and outcomes confirm the strategy."}
        </p>
      </div>
    );
  }

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("surface-card flex flex-col gap-5 p-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" aria-hidden />
          Raises with more mocks
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-start">
        <div className="relative grid place-items-center">
          <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90" role="img" aria-label={`${clamped}% confidence`}>
            <circle cx="72" cy="72" r={radius} className="stroke-muted" strokeWidth="14" fill="transparent" opacity={0.35} />
            <motion.circle
              cx="72"
              cy="72"
              r={radius}
              stroke="url(#confidenceGradient)"
              strokeWidth="14"
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: progress }}
              transition={{ duration: motionDuration(reducedMotion, 0.8), ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-3xl font-semibold text-primary">{clamped}%</p>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Confidence</p>
            </div>
          </div>
        </div>
        <div className="max-w-xs space-y-2 text-sm">
          <p className="font-medium">This is a hypothesis based on limited signal.</p>
          <p className="text-muted-foreground">
            {description ?? "We weight timing signals and recent stability. Confirming time splits and mock frequency boosts confidence fastest."}
          </p>
        </div>
      </div>
    </div>
  );
}
