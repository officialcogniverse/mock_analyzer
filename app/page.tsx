import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-4 pb-20 pt-12 sm:px-6 lg:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Cogniverse Mock Analyzer
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Turn every mock into a clear next-step plan.
            </h1>
            <p className="text-base text-muted-foreground">
              Upload a scorecard, review your next best actions, and follow a weekly plan built for your exam goal.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/app">Get started</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/history">See progress</Link>
            </Button>
          </div>
        </div>
        <div className="surface-card space-y-4 p-6">
          <h2 className="text-xl font-semibold">What you get</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>Upload PDF, image, or text scorecards.</li>
            <li>Deterministic next best actions you can execute today.</li>
            <li>7-day plan with checklist and notes.</li>
            <li>History view for all attempts.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
