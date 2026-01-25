import { AnalyzePanel } from "@/components/analyze/AnalyzePanel";
import { BotPanel } from "@/components/chat/BotPanel";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">
              Mock Analyzer MVP
            </p>
            <h1 className="text-display">Turn mock chaos into a clean 7-day plan.</h1>
            <p className="text-muted">
              Upload a PDF or paste your mock scorecard. We’ll detect your mistakes, build next best actions,
              and deliver a focused study plan you can actually finish.
            </p>
          </div>

          <AnalyzePanel />
        </div>

        <BotPanel />
      </section>
    </main>
  );
}
