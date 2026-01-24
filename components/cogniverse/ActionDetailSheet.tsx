"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ClipboardCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCogniverse } from "@/lib/domain/mockData";
import type { NextBestAction } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

type ActionDetailSheetProps = {
  action?: NextBestAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: (action: NextBestAction) => void;
};

export function ActionDetailSheet({ action, open, onOpenChange, onShare }: ActionDetailSheetProps) {
  const reducedMotion = useReducedMotionSafe();
  const { toggleActionComplete, addNote, state } = useCogniverse();
  const [quickNote, setQuickNote] = React.useState("");
  const [quickTitle, setQuickTitle] = React.useState("");
  const [celebrate, setCelebrate] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuickNote("");
      setQuickTitle("");
      setCelebrate(false);
    }
  }, [open]);

  if (!action) return null;

  const handleDone = () => {
    toggleActionComplete(action.id);
    setCelebrate(true);
    toast.success("Action completed. Momentum secured.");
    window.setTimeout(() => setCelebrate(false), reducedMotion ? 0 : 900);
  };

  const handleQuickNote = () => {
    if (!quickNote.trim()) {
      toast.error("Drop one sharp takeaway first.");
      return;
    }

    addNote({
      title: quickTitle.trim() || action.title,
      body: quickNote.trim(),
      tags: action.tags,
      linkedActionId: action.id,
      linkedAttemptId: state.report.currentAttemptId,
    });

    setQuickNote("");
    setQuickTitle("");
    toast.success("Note added to your playbook.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(720px,96vw)] rounded-[2rem] border-border/70 p-0 sm:rounded-[2.25rem]">
        <div className="relative flex max-h-[85vh] flex-col overflow-hidden">
          <div className="surface-glow rounded-none border-b border-border/70 px-6 py-6 sm:px-8">
            <DialogHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden />
                Action detail panel
              </div>
              <DialogTitle className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{action.title}</DialogTitle>
              <p className="max-w-2xl text-sm text-muted-foreground">{action.summary}</p>
            </DialogHeader>
            <div className="mt-4 flex flex-wrap gap-2">
              <MetaPill label={formatMinutes(action.durationMinutes)} />
              <MetaPill label={action.difficulty} />
              <MetaPill label={`${action.impact}% impact`} tone="primary" />
            </div>
          </div>

          <div className="grid gap-6 overflow-y-auto px-6 py-6 sm:grid-cols-[1.1fr_0.9fr] sm:px-8">
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Why this helps</h3>
                <p className="text-sm text-muted-foreground">{action.whyThisHelps}</p>
              </section>
              <section className="space-y-3">
                <h3 className="text-base font-semibold">Steps checklist</h3>
                <div className="space-y-2">
                  {action.steps.map((step) => (
                    <div key={step.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-base font-semibold">Add quick note</h3>
                <Input
                  placeholder="Optional title"
                  value={quickTitle}
                  onChange={(event) => setQuickTitle(event.target.value)}
                  className="rounded-2xl"
                />
                <Textarea
                  placeholder="What will you do differently next mock?"
                  value={quickNote}
                  onChange={(event) => setQuickNote(event.target.value)}
                  className="min-h-[100px] rounded-2xl"
                />
                <Button type="button" variant="secondary" className="tap-scale rounded-2xl" onClick={handleQuickNote}>
                  Save quick note
                </Button>
              </section>
            </div>
            <aside className="space-y-4">
              <div className="surface-card space-y-3 border-primary/20 bg-primary/10 p-5">
                <p className="text-sm font-medium text-primary">Fastest win</p>
                <p className="text-sm text-foreground">Close this loop today to protect accuracy under pressure.</p>
                <div className="flex flex-wrap gap-2">
                  {action.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-primary/20 bg-background/80 px-2.5 py-1 text-xs text-primary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="surface-card space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Complete the action</p>
                    <p className="text-xs text-muted-foreground">Tiny wins compound. Mark it when it is actually done.</p>
                  </div>
                </div>
                <Button type="button" className="tap-scale w-full rounded-2xl text-sm font-semibold" onClick={handleDone}>
                  Mark as done
                </Button>
                <Button type="button" variant="outline" className="tap-scale w-full rounded-2xl" onClick={() => onShare?.(action)}>
                  Share this action
                </Button>
              </div>
            </aside>
          </div>

          <AnimatePresence>
            {celebrate ? (
              <motion.div
                initial={reducedMotion ? undefined : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: motionDuration(reducedMotion, 0.35) }}
                className={cn(
                  "pointer-events-none absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-sm",
                  reducedMotion ? "" : "",
                )}
                aria-hidden
              >
                <div className="surface-card flex items-center gap-3 border-primary/25 bg-primary/10 px-6 py-4 text-primary shadow-2xl">
                  <Sparkles className="h-5 w-5" aria-hidden />
                  <span className="text-sm font-semibold">Loop closed. Confidence up.</span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaPill({ label, tone }: { label: string; tone?: "primary" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        tone === "primary" ? "border-primary/30 bg-primary/15 text-primary" : "border-border/70 bg-background/80 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
