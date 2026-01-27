"use client";

import { useEffect, useMemo, useState } from "react";
import { IntakeBot } from "@/components/landing/IntakeBot";
import { InstrumentedAttemptPanel } from "@/components/landing/InstrumentedAttemptPanel";
import { ReportView } from "@/components/landing/ReportView";
import { UploadPanel } from "@/components/landing/UploadPanel";
import type { AnalyzeResponse } from "@/lib/contracts";
import type { IntakeAnswers } from "@/lib/engine/schemas";

const STORAGE_KEYS = {
  intake: "cogniverse_intake_v1",
  report: "cogniverse_report_v1",
  mockText: "cogniverse_mocktext_v1",
  horizon: "cogniverse_horizon_v1",
  lastReport: "cv.lastReport.v1",
};

export default function HomePage() {
  const [intake, setIntake] = useState<IntakeAnswers>(() => {
    if (typeof window === "undefined") return {};
    const stored = localStorage.getItem(STORAGE_KEYS.intake);
    if (!stored) return {};
    try {
      return JSON.parse(stored) as IntakeAnswers;
    } catch {
      return {};
    }
  });
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(() => {
    if (typeof window === "undefined") return null;
    const stored =
      localStorage.getItem(STORAGE_KEYS.report) ?? localStorage.getItem(STORAGE_KEYS.lastReport);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AnalyzeResponse;
    } catch {
      return null;
    }
  });
  const [mockText, setMockText] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEYS.mockText) ?? "";
  });
  const [horizonDays, setHorizonDays] = useState<7 | 14>(() => {
    if (typeof window === "undefined") return 7;
    return localStorage.getItem(STORAGE_KEYS.horizon) === "14" ? 14 : 7;
  });
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"quick" | "instrument">("quick");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.intake, JSON.stringify(intake));
  }, [intake]);

  useEffect(() => {
    if (analysis) {
      localStorage.setItem(STORAGE_KEYS.report, JSON.stringify(analysis));
      localStorage.setItem(STORAGE_KEYS.lastReport, JSON.stringify(analysis));
    } else {
      localStorage.removeItem(STORAGE_KEYS.report);
    }
  }, [analysis]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.mockText, mockText);
  }, [mockText]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.horizon, horizonDays.toString());
  }, [horizonDays]);

  const handleReset = () => {
    setIntake({});
    setAnalysis(null);
    setMockText("");
    setHorizonDays(7);
    localStorage.removeItem(STORAGE_KEYS.intake);
    localStorage.removeItem(STORAGE_KEYS.report);
    localStorage.removeItem(STORAGE_KEYS.mockText);
    localStorage.removeItem(STORAGE_KEYS.horizon);
  };

  const headerSubtitle = useMemo(() => {
    if (analysis?.ok) return "Your report is ready — refine it with the companion anytime.";
    return "Answer a few questions, upload a mock, and get a focused study plan.";
  }, [analysis]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
      <header className="mb-10 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">
          Cogniverse Mock Analyzer
        </p>
        <h1 className="text-display">Bot-first mock analysis, built for momentum.</h1>
        <p className="text-muted max-w-2xl">{headerSubtitle}</p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm ${
                mode === "quick"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 text-muted-foreground hover:border-primary/70"
              }`}
              onClick={() => setMode("quick")}
            >
              Quick Analyze (Upload/Paste)
            </button>
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm ${
                mode === "instrument"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 text-muted-foreground hover:border-primary/70"
              }`}
              onClick={() => setMode("instrument")}
            >
              Instrumented Attempt (Mode 2)
            </button>
          </div>

          {mode === "quick" ? (
            <UploadPanel
              intake={intake}
              mockText={mockText}
              horizonDays={horizonDays}
              onMockTextChange={setMockText}
              onHorizonChange={setHorizonDays}
              onReport={setAnalysis}
              onLoadingChange={setLoading}
              onReset={handleReset}
            />
          ) : (
            <InstrumentedAttemptPanel onReport={setAnalysis} onLoadingChange={setLoading} />
          )}
        </div>

        <IntakeBot intake={intake} onIntakeChange={setIntake} analysis={analysis} onReset={handleReset} />
      </section>

      <section className="mt-10">
        <ReportView
          key={analysis?.meta?.requestId ?? (analysis ? "report" : "empty")}
          analysis={analysis}
          loading={loading}
        />
      </section>
    </main>
  );
}
