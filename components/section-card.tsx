import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SectionCard({ children, className, contentClassName }: SectionCardProps) {
  return (
    <Card className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      <CardContent className={cn("space-y-4 p-5 sm:p-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
