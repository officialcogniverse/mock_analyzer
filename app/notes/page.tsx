"use client";

import * as React from "react";
import { NotebookText, Search, Share2, Tags } from "lucide-react";

import { EmptyState } from "@/components/cogniverse/EmptyState";
import { NoteCard } from "@/components/cogniverse/NoteCard";
import { NotesComposer } from "@/components/cogniverse/NotesComposer";
import { SectionHeader } from "@/components/cogniverse/SectionHeader";
import { ShareCard } from "@/components/cogniverse/ShareCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCogniverse } from "@/lib/domain/mockData";
import { findActionById } from "@/lib/domain/selectors";
import type { Note } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export default function NotesPage() {
  const { state } = useCogniverse();
  const notes = state.report.notes;
  const actions = state.report.actions;

  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string>("All");
  const [shareNote, setShareNote] = React.useState<Note | null>(null);

  const tags = React.useMemo(() => {
    const allTags = notes.flatMap((note) => note.tags);
    return ["All", ...Array.from(new Set(allTags))];
  }, [notes]);

  const filteredNotes = React.useMemo(() => {
    return notes.filter((note) => {
      const matchesTag = activeTag === "All" || note.tags.includes(activeTag);
      const matchesQuery =
        !query.trim() ||
        note.title.toLowerCase().includes(query.toLowerCase()) ||
        note.body.toLowerCase().includes(query.toLowerCase());
      return matchesTag && matchesQuery;
    });
  }, [activeTag, notes, query]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-10">
      <SectionHeader
        title="Notes"
        subtitle="Quick notes that survive mock pressure. Write the trigger, not the paragraph."
        action={
          <Badge className="rounded-full border-primary/15 bg-primary/10 text-primary">
            <NotebookText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Flashcard style
          </Badge>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <NotesComposer actions={actions} />

          <div className="surface-card flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  placeholder="Search notes"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-auto border-none bg-transparent px-0 focus-visible:ring-0"
                  aria-label="Search notes"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" aria-hidden />
                {tags.map((tag) => {
                  const active = tag === activeTag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(tag)}
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

            {filteredNotes.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    linkedAction={findActionById(state.report, note.linkedActionId)}
                    onShare={(selected) => setShareNote(selected)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No notes match that filter."
                description="Try a different tag or create a new quick note above."
                className="border-dashed"
              />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
          <div className="surface-card flex flex-col gap-3 p-5">
            <p className="text-sm font-medium text-muted-foreground">Share mindset</p>
            <h3 className="text-lg font-semibold">Every insight should be shareable.</h3>
            <p className="text-sm text-muted-foreground">Select a note and we will render it as a clean coach card.</p>
            <Button className="tap-scale rounded-2xl" onClick={() => setShareNote(notes[0] ?? null)}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden />
              Share a note
            </Button>
          </div>

          {shareNote ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-primary">Share card</p>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setShareNote(null)}>
                  Close
                </Button>
              </div>
              <ShareCard variant="note" report={state.report} note={shareNote} />
            </div>
          ) : (
            <EmptyState
              title="Share-ready cards appear here."
              description="Tap share on any note to generate a screenshot layout."
              className="border-dashed"
            />
          )}
        </aside>
      </section>
    </main>
  );
}
