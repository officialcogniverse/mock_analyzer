import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonCardProps = {
  lines?: number;
  className?: string;
};

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div className={cn("surface-card space-y-4 p-6", className)} aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-1/3 rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cn("h-4 rounded-full", index === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}
