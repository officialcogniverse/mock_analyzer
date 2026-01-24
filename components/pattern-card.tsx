import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReportPattern } from "@/lib/domain/types";

function severityLabel(severity: number) {
  if (severity >= 4) return { label: "High risk", tone: "destructive" as const };
  if (severity <= 2) return { label: "Low risk", tone: "secondary" as const };
  return { label: "Medium risk", tone: "outline" as const };
}

export function PatternCard({ pattern, index }: { pattern: ReportPattern; index: number }) {
  const severity = severityLabel(pattern.severity);
  return (
    <Card className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {index + 1}. {pattern.title}
          </p>
          <p className="text-xs text-muted-foreground">{pattern.evidence}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="rounded-full">
            Severity {pattern.severity}/5
          </Badge>
          <Badge variant={severity.tone} className="rounded-full">
            {severity.label}
          </Badge>
        </div>
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
