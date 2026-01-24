import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReportPattern } from "@/lib/domain/types";

export function PatternCard({ pattern, index }: { pattern: ReportPattern; index: number }) {
  return (
    <Card className="rounded-2xl border bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {index + 1}. {pattern.title}
          </p>
          <p className="text-xs text-muted-foreground">{pattern.evidence}</p>
        </div>
        <Badge variant="outline" className="rounded-full">
          Pattern
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-dashed p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Impact
          </p>
          <p className="mt-1 text-sm text-slate-900">{pattern.impact}</p>
        </div>
        <div className="rounded-xl border border-dashed p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fix
          </p>
          <p className="mt-1 text-sm text-slate-900">{pattern.fix}</p>
        </div>
      </div>
    </Card>
  );
}
