"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, PlayCircle, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ActionDetailSheet } from "@/components/cogniverse/ActionDetailSheet";
import { ShareCard } from "@/components/cogniverse/ShareCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import type { NextBestAction } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

type NextBestActionRailProps = {
  actions: NextBestAction[];
  sticky?: boolean;
  className?: string;
};

export function NextBestActionRail({ actions, sticky, className }: NextBestActionRailProps) {
  const reducedMotion = useReducedMotionSafe();
  const { toggleActionComplete, state } = useCogniverse();
  const [activeActionId, setActiveActionId] = React.useState<string | null>(null);
  const [shareActionId, setShareActionId] = React.useState<string | null>(null);

  const topActions = React.useMemo(() => actions.slice(0, 3), [actions]);
  const activeAction = topActions.find((action) => action.id === activeActionId);
  const shareAction = topActions.find((action) => action.id === shareActionId);

  const handleToggle = (action: NextBestAction) => {
    toggleActionComplete(action.id);
    toast.success(action.isCompleted ? "Action reopened." : "Marked done. Keep stacking wins.");
  };

  return (
    <div className={cn(sticky ? "lg:sticky lg:top-24" : "", className)}>
      <div className="surface-card flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Next best actions</p>
            <h3 className="text-xl font-semibold">Here&apos;s the fastest win.</h3>
          </div>
          <Badge className="rounded-full border-primary/15 bg-primary/10 text-primary">
            <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />
            Focused loop
          </Badge>
        </div>

        <div className="space-y-4">
          {topActions.map((action, index) => (
            <motion.div
              key={action.id}
              initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : index * 0.05, duration: motionDuration(reducedMotion, 0.25) }}
              className={cn(
                "rounded-2xl border border-border/70 bg-background/80 p-4 transition hover:border-primary/40",
                action.isCompleted ? "border-emerald-500/40 bg-emerald-500/5" : "",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold leading-snug">{action.title}</h4>
                    <Badge variant="secondary" className="rounded-full border-border/70 bg-muted/60 text-xs text-muted-foreground">
                      {formatMinutes(action.durationMinutes)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{action.summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="tap-scale rounded-full"
                    onClick={() => setActiveActionId(action.id)}
                    aria-label={`Start ${action.title}`}
                  >
                    <PlayCircle className="mr-1.5 h-4 w-4" aria-hidden />
                    Start
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="tap-scale rounded-full"
                    onClick={() => setShareActionId(action.id)}
                    aria-label={`Share ${action.title}`}
                  >
                    <Share2 className="mr-1.5 h-4 w-4" aria-hidden />
                    Share
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {action.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={action.isCompleted ? "secondary" : "default"}
                  className={cn("tap-scale rounded-full", action.isCompleted ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "")}
                  onClick={() => handleToggle(action)}
                  aria-pressed={action.isCompleted}
                >
                  <Check className="mr-1.5 h-4 w-4" aria-hidden />
                  {action.isCompleted ? "Done" : "Mark done"}
                </Button>
              </div>
              {index < topActions.length - 1 ? <Separator className="mt-4" /> : null}
            </motion.div>
          ))}
        </div>

        {shareAction ? (
          <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-primary">Share this action</p>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setShareActionId(null)}>
                Close
              </Button>
            </div>
            <ShareCard variant="action" report={state.report} action={shareAction} />
          </div>
        ) : null}
      </div>

      <ActionDetailSheet
        action={activeAction}
        open={Boolean(activeAction)}
        onOpenChange={(open) => (!open ? setActiveActionId(null) : undefined)}
        onShare={(action) => {
          setShareActionId(action.id);
        }}
      />
    </div>
  );
}
