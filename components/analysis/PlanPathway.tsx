export function PlanPathway({ plan }: { plan: Array<any> }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h2 className="text-lg font-semibold">7-day plan</h2>
      <div className="mt-4 space-y-4">
        {plan?.map((day) => (
          <div key={day.day} className="rounded-xl border border-border/60 p-4">
            <p className="font-medium">{day.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {day.tasks?.map((task: string, index: number) => (
                <li key={`${day.day}-${index}`}>{task}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
