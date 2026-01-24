import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-dashed bg-slate-50/70 p-4 text-sm",
        className
      )}
    >
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="text-muted-foreground">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
