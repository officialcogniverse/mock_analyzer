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
    } else {
      toast.error(json.error?.message || "Unable to save note");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h2 className="text-lg font-semibold">Notes</h2>
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
          </div>
        ))}
      </div>
    </div>
  );
}
