import { Card } from "@/components/ui/card";

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
};

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
          {item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}
        </Card>
      ))}
    </div>
  );
}
