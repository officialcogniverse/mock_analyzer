import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2 rounded-2xl border bg-white p-5">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton key={`loading-line-${idx}`} className="h-4 w-full" />
      ))}
    </div>
  );
}
