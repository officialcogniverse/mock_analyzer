"use client";

import { motion } from "framer-motion";
import { Link2, Pin, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NextBestAction, Note } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { motionDuration, useReducedMotionSafe } from "@/lib/utils/motion";

type NoteCardProps = {
  note: Note;
  linkedAction?: NextBestAction;
  onShare?: (note: Note) => void;
  className?: string;
};

export function NoteCard({ note, linkedAction, onShare, className }: NoteCardProps) {
  const reducedMotion = useReducedMotionSafe();

  return (
    <motion.article
      layout
      whileHover={reducedMotion ? undefined : { y: -3 }}
      transition={{ duration: motionDuration(reducedMotion, 0.2) }}
      className={cn(
        "surface-card tap-scale flex h-full flex-col gap-4 p-5 text-left transition hover:border-primary/35",
        className,
      )}
      aria-label={`Note titled ${note.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{formatDate(note.createdAt)}</p>
          <h3 className="text-lg font-semibold leading-snug">{note.title}</h3>
        </div>
        {note.isPinned ? (
          <span className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary" aria-label="Pinned note">
            <Pin className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{note.body}</p>

      {linkedAction ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5 text-primary" aria-hidden />
          Linked to: <span className="font-medium text-foreground">{linkedAction.title}</span>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {note.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">Keep it short. Repeat it often.</p>
        <Button type="button" variant="secondary" size="sm" className="tap-scale rounded-full" onClick={() => onShare?.(note)}>
          <Share2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Share
        </Button>
      </div>
    </motion.article>
  );
}
