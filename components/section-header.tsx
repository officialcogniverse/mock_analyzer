import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
