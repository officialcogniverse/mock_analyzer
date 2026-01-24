"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NextAction } from "@/lib/types";

type NextBestActionRailProps = {
  actions: NextAction[];
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
};

export function NextBestActionRail({
  actions,
  loading,
  title = "Next best action",
  emptyMessage = "Run another mock to unlock your next best action.",
  ctaLabel,
  onCtaClick,
}: NextBestActionRailProps) {
  const top = actions[0];

  return (
    <Card className="p-5 rounded-2xl space-y-3 sticky top-6">
      <div className="flex items-start justify-between gap-2">
        <div className="text-lg font-semibold">{title}</div>
        {top?.expectedImpact ? (
          <Badge
            variant={top.expectedImpact === "High" ? "default" : "secondary"}
            className="rounded-full"
          >
            {top.expectedImpact} impact
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading your next move…</div>
      ) : top ? (
        <div className="space-y-3">
          <div className="font-medium">{top.title}</div>
          {top.effort ? (
            <div className="text-xs text-muted-foreground">Effort: {top.effort}</div>
          ) : null}
          {top.metric ? (
            <div className="text-xs text-muted-foreground">Metric: {top.metric}</div>
          ) : null}
          {top.steps?.length ? (
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {top.steps.slice(0, 3).map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          ) : null}
          {top.evidence?.length ? (
            <div className="text-xs text-muted-foreground">
              Recommended because your last mocks showed:{" "}
              {top.evidence.slice(0, 2).join(", ")}.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{emptyMessage}</div>
      )}

      {ctaLabel && onCtaClick ? (
        <Button type="button" variant="secondary" onClick={onCtaClick} className="w-full">
          {ctaLabel}
        </Button>
      ) : null}
    </Card>
  );
}
