import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LoadingCardProps = {
  lines?: number;
  className?: string;
};

export function LoadingCard({ lines = 3, className }: LoadingCardProps) {
  return (
    <Card className={cn("rounded-2xl border bg-white p-5", className)}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-28 rounded-full bg-slate-200" />
        <div className="h-6 w-3/4 rounded-full bg-slate-200" />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, idx) => (
            <div key={idx} className="h-3 w-full rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
    </Card>
  );
}
