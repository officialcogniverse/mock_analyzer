import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ConfidenceBand = "high" | "medium" | "low";

type ConfidenceBadgeProps = {
  score?: number | null;
  band?: ConfidenceBand | null;
  className?: string;
};

const bandStyles: Record<ConfidenceBand, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700",
};

export function ConfidenceBadge({ score, band, className }: ConfidenceBadgeProps) {
  const safeBand: ConfidenceBand = band || "medium";
  const label =
    typeof score === "number"
      ? `Confidence ${Math.round(score)}%`
      : `Confidence ${safeBand}`;

  return (
    <Badge className={cn("rounded-full capitalize", bandStyles[safeBand], className)}>
      {label}
    </Badge>
  );
}
