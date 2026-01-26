"use client";

import { Button } from "@/components/ui/button";
import type { ChatMode } from "@/lib/engine/schemas";

const modes: Array<{ id: ChatMode; label: string }> = [
  { id: "BREAKDOWN", label: "Breakdown" },
  { id: "STRATEGY", label: "Strategy" },
  { id: "MOTIVATION", label: "Motivation" },
];

type ModeTabsProps = {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
};

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-transparent/70 p-2">
      {modes.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant={mode === item.id ? "secondary" : "ghost"}
          size="sm"
          className="rounded-xl"
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
