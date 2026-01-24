import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">How Mock Analyzer improves your next score</h1>
        <p className="text-sm text-muted-foreground">
          This is a closed loop: Insight → Conversation → Action → Next attempt delta.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "1) Upload a mock",
            body: "Bring a scorecard, PDF, or manual metrics. The analyzer extracts signal and produces a report.",
          },
          {
            title: "2) Review patterns",
            body: "Patterns diagnose execution bottlenecks—not just topics. They drive your next-best actions.",
          },
          {
            title: "3) Complete actions + reflect",
            body: "Mark actions done and add reflections. This drives adherence tracking and improves coaching quality.",
          },
          {
            title: "4) Ask the AI coach",
            body: "Use the structured coach modes. Every response cites patterns, actions, metrics, or deltas.",
          },
        ].map((step) => (
          <Card key={step.title} className="rounded-2xl border border-slate-200">
            <CardHeader>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Upload my mock</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Choose login path</Link>
        </Button>
      </div>
    </div>
  );
}
