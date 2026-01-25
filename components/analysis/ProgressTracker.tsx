type ProgressTrackerProps = {
  summary: Record<string, any> | null;
  recentEvents: Array<Record<string, any>>;
};

export function ProgressTracker({ summary, recentEvents }: ProgressTrackerProps) {
  if (!summary) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Progress will appear after your first plan is generated.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Progress tracker</h2>
        <span className="text-xs text-muted-foreground">Completion {summary.completionRate ?? 0}%</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 p-3">
          <p className="text-xs uppercase text-muted-foreground">Tasks done</p>
          <p className="text-lg font-semibold">{summary.tasksDone ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <p className="text-xs uppercase text-muted-foreground">Skipped</p>
          <p className="text-lg font-semibold">{summary.skippedCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <p className="text-xs uppercase text-muted-foreground">Difficult</p>
          <p className="text-lg font-semibold">{summary.difficultCount ?? 0}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top blockers</p>
        {summary.topBlockers?.length ? (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {summary.topBlockers.map((task: any) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No blockers yet.</p>
        )}
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</p>
        {recentEvents?.length ? (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {recentEvents.map((event) => (
              <li key={event._id ?? event.createdAt}>
                {event.type?.replace(/_/g, " ") ?? "Update"} •{" "}
                {event.payload?.taskId ? `Task ${event.payload.taskId}` : "Plan"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No recent activity.</p>
        )}
      </div>
    </div>
  );
}
