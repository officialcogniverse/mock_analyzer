"use client";

import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getExamPatternChecklist } from "@/lib/examPatterns";
import { normalizeExam } from "@/lib/exams";

type ExamPatternChecklistProps = {
  exam?: string | null;
  title?: string;
  subtitle?: string;
};

export function ExamPatternChecklist({
  exam,
  title = "Exam pattern checklist",
  subtitle = "Advice is calibrated to the real exam format.",
}: ExamPatternChecklistProps) {
  const normalizedExam = normalizeExam(exam || "");
  const items = getExamPatternChecklist(normalizedExam);

  return (
    <Card className="p-5 rounded-2xl space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
        {normalizedExam ? (
          <Badge variant="secondary" className="rounded-full">
            {normalizedExam}
          </Badge>
        ) : null}
      </div>

      {items?.length ? (
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item.label} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-500" />
              <div>
                <span className="font-medium text-slate-900">{item.label}:</span>{" "}
                {item.detail}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">
          Choose an exam to see the exact format, timing, and marking rules we align to.
        </div>
      )}
    </Card>
  );
}
