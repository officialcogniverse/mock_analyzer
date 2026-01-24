"use client";

import { useMemo } from "react";

import type { PatternInsight } from "@/lib/domain/types";
import { PatternCard } from "@/components/cogniverse/PatternCard";

type PatternCardGridProps = {
  patterns: PatternInsight[];
  onOpenPattern?: (pattern: PatternInsight) => void;
};

export function PatternCardGrid({ patterns, onOpenPattern }: PatternCardGridProps) {
  const topPatterns = useMemo(() => patterns.slice(0, 6), [patterns]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {topPatterns.map((pattern) => (
        <PatternCard key={pattern.id} pattern={pattern} onOpen={onOpenPattern} />
      ))}
    </div>
  );
}
