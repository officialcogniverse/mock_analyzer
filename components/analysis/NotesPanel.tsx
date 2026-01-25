"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type NotesPanelProps = {
  actions: Array<any>;
  analysisId?: string | null;
};

export function NotesPanel({ actions, analysisId }: NotesPanelProps) {
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = React.useState<Record<string, Array<{ content: string; createdAt: string }>>>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!analysisId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/notes?analysisId=${analysisId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.ok) {
          const grouped: Record<string, Array<{ content: string; createdAt: string }>> = {};
          (json.data.items || []).forEach((item: { actionId: string; content: string; createdAt: string }) => {
            if (!grouped[item.actionId]) grouped[item.actionId] = [];
            grouped[item.actionId].push({ content: item.content, createdAt: item.createdAt });
          });
          setSavedNotes(grouped);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [analysisId]);

  const handleSave = async (actionId: string) => {
    if (!analysisId) return;
    const content = notes[actionId];
    if (!content) return;
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, actionId, content }),
    });
    const json = await res.json();
    if (json.ok) {
      toast.success("Note saved");
      setNotes((prev) => ({ ...prev, [actionId]: "" }));
      setSavedNotes((prev) => ({
        ...prev,
        [actionId]: [
          { content, createdAt: new Date().toISOString() },
          ...(prev[actionId] || []),
        ],
      }));
    } else {
      toast.error(json.error?.message || "Unable to save note");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notes</h2>
        {loading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
      </div>
      <div className="mt-4 space-y-4">
        {actions?.map((action) => (
          <div key={action.id} className="space-y-2 rounded-xl border border-border/60 p-4">
            <p className="text-sm font-medium">{action.title}</p>
            <Textarea
              value={notes[action.id] ?? ""}
              onChange={(event) =>
                setNotes((prev) => ({ ...prev, [action.id]: event.target.value }))
              }
              placeholder="Add a quick reflection"
            />
            <Button size="sm" onClick={() => handleSave(action.id)}>
              Save note
            </Button>
            {savedNotes[action.id]?.length ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Saved notes</p>
                <ul className="mt-2 space-y-2">
                  {savedNotes[action.id].slice(0, 3).map((note, index) => (
                    <li key={`${action.id}-note-${index}`}>
                      <p>{note.content}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
