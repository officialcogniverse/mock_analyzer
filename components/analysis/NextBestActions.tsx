import { Badge } from "@/components/ui/badge";

type NBAAction = {
  id: string;
  title: string;
  why: string;
  expectedImpact: string;
  effortLevel: "S" | "M" | "L";
  timeHorizon: "Today" | "ThisWeek" | "Next14Days";
  successCriteria: string[];
  tags: string[];
};

export function NextBestActions({ actions }: { actions: NBAAction[] }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Next best actions</h2>
        <Badge variant="outline">Top priorities</Badge>
      </div>
      <div className="mt-4 space-y-4">
        {actions?.length ? (
          actions.map((action) => (
            <div key={action.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{action.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{action.effortLevel} effort</span>
                  <span>•</span>
                  <span>{action.timeHorizon}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{action.why}</p>
              <p className="mt-2 text-sm text-foreground">{action.expectedImpact}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {action.successCriteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {action.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Generate an analysis to unlock your next actions.
          </div>
        )}
      </div>
    </div>
  );
}
