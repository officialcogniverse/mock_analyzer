import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
};

export function EmptyState({ title, description, ctaLabel, ctaHref, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col items-start gap-3 p-6 text-left md:flex-row md:items-center md:justify-between",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted">{description}</p>
      </div>
      {ctaLabel && ctaHref ? (
        <Button asChild className="tap-scale gap-2 rounded-full">
          <Link href={ctaHref} aria-label={ctaLabel}>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
