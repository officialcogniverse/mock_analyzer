import type { InsightBundle } from "@/lib/schemas/workflow";

type InsightsSummaryProps = {
  insights: InsightBundle;
};

export function InsightsSummary({ insights }: InsightsSummaryProps) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Insights summary</h2>
        <span className="text-xs text-muted-foreground">Known vs inferred vs missing</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Known</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            <li>Score: {insights.known.score ?? "n/a"}</li>
            <li>Accuracy: {insights.known.accuracy ? `${insights.known.accuracy}%` : "n/a"}</li>
            {insights.known.sections?.length ? (
              <li>Sections: {insights.known.sections.length}</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inferred</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            <li>Persona: {insights.inferred.persona ?? "steady"}</li>
            {insights.inferred.confidenceGap ? <li>{insights.inferred.confidenceGap}</li> : null}
            {insights.inferred.riskPatterns?.slice(0, 2).map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing</p>
          {insights.missing?.length ? (
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {insights.missing.map((item) => (
                <li key={item}>{item.replace(/_/g, " ")}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No critical gaps detected.</p>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strengths</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {insights.strengths.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weaknesses</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {insights.weaknesses.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risks</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {insights.risks.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
