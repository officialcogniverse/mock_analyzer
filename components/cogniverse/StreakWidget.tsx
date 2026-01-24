"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Flame, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

const StreakMiniChart = dynamic(() => import("@/components/cogniverse/charts/StreakMiniChart").then((mod) => mod.StreakMiniChart), {
  ssr: false,
  loading: () => <div className="h-32 w-full animate-pulse rounded-2xl bg-muted/60" aria-hidden />,
});

type StreakWidgetProps = {
  streakDays: number;
  weeklyCompletion: Array<{ day: string; completed: number }>;
  intensity: number;
  className?: string;
};

export function StreakWidget({ streakDays, weeklyCompletion, intensity, className }: StreakWidgetProps) {
  const reducedMotion = useReducedMotionSafe();

  return (
    <div className={cn("surface-card flex flex-col gap-5 p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Consistency streak</p>
          <div className="flex items-center gap-2">
            <motion.p
              key={streakDays}
              initial={reducedMotion ? undefined : { scale: 0.94, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: motionDuration(reducedMotion, 0.32) }}
              className="text-3xl font-semibold text-primary"
            >
              {streakDays} days
            </motion.p>
            <Badge variant="secondary" className="rounded-full border-primary/15 bg-primary/10 text-primary">
              <Flame className="mr-1 h-3.5 w-3.5" aria-hidden />
              Locked in
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Small loops, stacked daily. Keep it boring and repeatable.</p>
        </div>
        <div className="surface-glow min-w-[180px] space-y-2 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Streak energy</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-primary">{intensity}%</p>
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <p className="text-xs text-muted-foreground">Intensity rises when you close the loop on the same day.</p>
        </div>
      </div>
      <StreakMiniChart data={weeklyCompletion} />
    </div>
  );
}
