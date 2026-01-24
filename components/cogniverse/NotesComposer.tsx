"use client";

import * as React from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCogniverse } from "@/lib/domain/mockData";
import type { NextBestAction } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type NotesComposerProps = {
  actions: NextBestAction[];
  defaultActionId?: string;
  className?: string;
};

export function NotesComposer({ actions, defaultActionId, className }: NotesComposerProps) {
  const { addNote, state } = useCogniverse();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [linkedActionId, setLinkedActionId] = React.useState<string | undefined>(defaultActionId);

  const availableTags = React.useMemo(() => {
    const planTags = state.report.plan.flatMap((day) => day.tasks.flatMap((task) => task.tags));
    const noteTags = state.report.notes.flatMap((note) => note.tags);
    return Array.from(new Set([...planTags, ...noteTags])).slice(0, 12);
  }, [state.report.notes, state.report.plan]);

  const handleAddTag = React.useCallback(
    (value: string) => {
      const normalized = value.trim();
      if (!normalized || tags.includes(normalized)) return;
      setTags((prev) => [...prev, normalized]);
      setTagInput("");
    },
    [tags],
  );

  const removeTag = React.useCallback((tag: string) => {
    setTags((prev) => prev.filter((item) => item !== tag));
  }, []);

  const handleSubmit = React.useCallback(() => {
    if (!title.trim() || !body.trim()) {
      toast.error("Give your note a title and one clear trigger.");
      return;
    }

    addNote({
      title: title.trim(),
      body: body.trim(),
      tags: tags.length ? tags : ["General"],
      linkedActionId,
      linkedAttemptId: state.report.currentAttemptId,
      isPinned: false,
    });

    toast.success("Note saved. Future-you is grateful.");
    setTitle("");
    setBody("");
    setTags([]);
    setTagInput("");
  }, [addNote, body, linkedActionId, state.report.currentAttemptId, tags, title]);

  return (
    <div className={cn("surface-card flex flex-col gap-5 p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Quick notes</p>
          <h3 className="text-lg font-semibold">Capture the trigger, not the essay.</h3>
        </div>
        <Badge className="rounded-full border-primary/15 bg-primary/10 text-primary">
          <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />
          Flashcard mode
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="note-title">
            Title
          </label>
          <Input
            id="note-title"
            placeholder="e.g., Exit rule script"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-2xl"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="note-action">
            Link to action
          </label>
          <Select value={linkedActionId} onValueChange={(value) => setLinkedActionId(value)}>
            <SelectTrigger id="note-action" className="rounded-2xl">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((action) => (
                <SelectItem key={action.id} value={action.id}>
                  {action.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="note-body">
          Trigger / insight
        </label>
        <Textarea
          id="note-body"
          placeholder="Write the one line that will save you 5 marks later."
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-[120px] rounded-2xl"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Tags</p>
          <p className="text-xs text-muted-foreground">Hit enter to add</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-full border-border/70 bg-muted/60">
              {tag}
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-background"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag} tag`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="Add a tag and press Enter"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddTag(tagInput);
              }
            }}
            className="rounded-2xl"
          />
          <Button type="button" variant="secondary" className="tap-scale rounded-2xl" onClick={() => handleAddTag(tagInput)}>
            Add tag
          </Button>
        </div>
        {availableTags.length ? (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Button type="button" onClick={handleSubmit} className="tap-scale rounded-2xl text-sm font-semibold">
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        Save note
      </Button>
    </div>
  );
}
