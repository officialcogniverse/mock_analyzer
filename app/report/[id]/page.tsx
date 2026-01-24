"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/section-header";
import { sampleReportPayload } from "@/lib/sampleData";
import { formatExamLabel } from "@/lib/exams";
import { trackEvent } from "@/lib/analytics";
import { ClipboardList, Sparkles, ArrowRight, Download, HelpCircle } from "lucide-react";

const EMPTY_REPORT = {
  summary: "No report data available.",
  facts: { metrics: [], notes: [] },
  inferences: [],
  patterns: [],
  next_actions: [],
  strategy: { next_mock_script: [], attempt_rules: [] },
  followups: [],
};

type FollowupAnswer = {
  id: string;
  value: string;
};

export default function ReportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({});
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  const isSample = params.id === "sample";

  useEffect(() => {
    let active = true;
    async function loadReport() {
      setLoading(true);
      if (isSample) {
        setReportData(sampleReportPayload);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/report/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load report");
        if (!active) return;
        setReportData(json);
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.message || "Failed to load report");
        setReportData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReport();
    return () => {
      active = false;
    };
  }, [params.id, isSample]);

  const report = reportData?.report || EMPTY_REPORT;
  const examLabel = formatExamLabel(reportData?.exam);
  const confidence = report?.meta?.strategy?.confidence_band || "low";
  const confidenceScore = report?.meta?.strategy?.confidence_score ?? null;

  const completionRate = useMemo(() => {
    const actions = report?.next_actions || [];
    if (!actions.length) return 0;
    const doneCount = actions.filter((action: any) => completedActions[action.title]).length;
    return Math.round((doneCount / actions.length) * 100);
  }, [completedActions, report?.next_actions]);

  async function exportReport() {
    try {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cogniverse_report_${params.id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  async function handleFollowupSubmit() {
    const answers: FollowupAnswer[] = Object.entries(followupAnswers)
      .filter(([id, value]) => id && value.trim().length > 0)
      .map(([id, value]) => ({ id, value }));

    if (!answers.length) {
      toast.message("Add at least one answer.");
      return;
    }

    await trackEvent("followup_answered", { reportId: params.id, answers });
    toast.success("Thanks! We saved your answers.");
  }

  async function toggleAction(title: string) {
    const next = !completedActions[title];
    setCompletedActions((prev) => ({ ...prev, [title]: next }));
    if (next) {
      await trackEvent("action_completed", { reportId: params.id, action: title });
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <Card className="rounded-2xl border">
          <CardContent className="p-6">Loading report…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Coach-style report</h1>
          <p className="text-sm text-muted-foreground">
            Personalized insights built for your next attempt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {examLabel ? <Badge variant="secondary">{examLabel}</Badge> : null}
          <Badge variant="outline">Confidence: {confidence}</Badge>
          {confidenceScore !== null ? (
            <Badge variant="outline">Score: {confidenceScore}</Badge>
          ) : null}
          <Button variant="outline" onClick={exportReport} className="gap-2">
            <Download className="h-4 w-4" /> Export JSON
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-6 p-6">
          <SectionHeader
            title="Summary"
            description="Coach-style overview for the next mock"
          />
          <p className="text-base text-slate-900">{report.summary}</p>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader
              title="Facts"
              description="Metrics extracted from your scorecard"
            />
            {report.facts?.metrics?.length ? (
              <div className="space-y-3">
                {report.facts.metrics.map((metric: any) => (
                  <div key={metric.label} className="rounded-xl border p-3">
                    <div className="text-sm font-semibold text-slate-900">{metric.label}</div>
                    <div className="text-lg font-bold text-indigo-700">{metric.value}</div>
                    <div className="text-xs text-muted-foreground">{metric.evidence}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No solid metrics extracted. Add manual metrics to improve confidence.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader
              title="Inferences"
              description="Hypotheses based on current signals"
            />
            {report.inferences?.length ? (
              <div className="space-y-3">
                {report.inferences.map((item: any, idx: number) => (
                  <div key={`${item.hypothesis}-${idx}`} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{item.hypothesis}</span>
                      <Badge variant="outline">{item.confidence}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{item.evidence}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No inferences yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader
              title="Patterns"
              description="Top execution patterns detected"
            />
            {report.patterns?.length ? (
              <div className="space-y-3">
                {report.patterns.map((pattern: any, idx: number) => (
                  <div key={`${pattern.title}-${idx}`} className="rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Sparkles className="h-4 w-4" /> {pattern.title}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Evidence:</span> {pattern.evidence}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Impact:</span> {pattern.impact}
                    </p>
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">Fix:</span> {pattern.fix}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No patterns detected yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader
              title="Next best actions"
              description={`Completion rate: ${completionRate}%`}
            />
            {report.next_actions?.length ? (
              <div className="space-y-3">
                {report.next_actions.map((action: any, idx: number) => (
                  <div key={`${action.title}-${idx}`} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {action.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {action.duration} · {action.expected_impact}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={completedActions[action.title] ? "default" : "outline"}
                        onClick={() => toggleAction(action.title)}
                      >
                        {completedActions[action.title] ? "Done" : "Mark done"}
                      </Button>
                    </div>
                    {action.steps?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                        {action.steps.map((step: string, sIdx: number) => (
                          <li key={`${action.title}-${sIdx}`}>{step}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No actions yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader
              title="Next mock strategy"
              description="Your attempt script and constraints"
            />
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Script</div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-900">
                  {report.strategy?.next_mock_script?.length ? (
                    report.strategy.next_mock_script.map((item: string, idx: number) => (
                      <li key={`script-${idx}`}>{item}</li>
                    ))
                  ) : (
                    <li>No script available yet.</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Attempt rules</div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-900">
                  {report.strategy?.attempt_rules?.length ? (
                    report.strategy.attempt_rules.map((rule: string, idx: number) => (
                      <li key={`rule-${idx}`}>{rule}</li>
                    ))
                  ) : (
                    <li>No attempt rules yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader
              title="Follow-ups"
              description="Answer these to raise confidence"
            />
            {report.followups?.length ? (
              <div className="space-y-3">
                {report.followups.map((followup: any, idx: number) => (
                  <div key={`${followup.id}-${idx}`} className="space-y-2">
                    <div className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                      <HelpCircle className="mt-0.5 h-4 w-4 text-indigo-600" />
                      {followup.question}
                    </div>
                    <Input
                      value={followupAnswers[followup.id] || ""}
                      onChange={(e) =>
                        setFollowupAnswers((prev) => ({
                          ...prev,
                          [followup.id]: e.target.value,
                        }))
                      }
                      placeholder={followup.type === "text" ? "Type your answer" : "Answer"}
                    />
                    <p className="text-xs text-muted-foreground">{followup.reason}</p>
                  </div>
                ))}
                <Button onClick={handleFollowupSubmit} className="w-full">
                  Save follow-up answers
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No follow-ups needed. You have enough signal coverage.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" onClick={() => router.push("/history")}>
          <ClipboardList className="mr-2 h-4 w-4" /> View attempt history
        </Button>
        <Button
          className="gap-2"
          onClick={async () => {
            await trackEvent("next_attempt_uploaded", { reportId: params.id });
            router.push("/");
          }}
        >
          Upload next attempt <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
