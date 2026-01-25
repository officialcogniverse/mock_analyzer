import { Badge } from "@/components/ui/badge";

export function NextBestActions({ actions }: { actions: Array<any> }) {
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
              <p className="font-medium">{action.title}</p>
              <p className="text-sm text-muted-foreground">{action.reason}</p>
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
