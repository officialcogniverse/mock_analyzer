import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatPillProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "positive" | "warning";
  className?: string;
};

const toneStyles: Record<NonNullable<StatPillProps["tone"]>, string> = {
  default: "border-slate-200 bg-white text-slate-900",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function StatPill({
  label,
  value,
  hint,
  tone = "default",
  className,
}: StatPillProps) {
  return (
    <div className={cn("flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl border p-3", toneStyles[tone], className)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold leading-none">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
