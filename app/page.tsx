"use client";

import { useEffect, useMemo, useState } from "react";
import { IntakeBot } from "@/components/landing/IntakeBot";
import { ReportView } from "@/components/landing/ReportView";
import { UploadPanel } from "@/components/landing/UploadPanel";
import type { AnalyzeResponse } from "@/lib/contracts";
import type { IntakeAnswers } from "@/lib/engine/schemas";

const STORAGE_KEYS = {
  intake: "cogniverse_intake_v1",
  report: "cogniverse_report_v1",
  mockText: "cogniverse_mocktext_v1",
  horizon: "cogniverse_horizon_v1",
};

export default function HomePage() {
  const [intake, setIntake] = useState<IntakeAnswers>({});
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [mockText, setMockText] = useState("");
  const [horizonDays, setHorizonDays] = useState<7 | 14>(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedIntake = localStorage.getItem(STORAGE_KEYS.intake);
    const storedReport = localStorage.getItem(STORAGE_KEYS.report);
    const storedMock = localStorage.getItem(STORAGE_KEYS.mockText);
    const storedHorizon = localStorage.getItem(STORAGE_KEYS.horizon);

    if (storedIntake) {
      try {
        setIntake(JSON.parse(storedIntake));
      } catch {
        setIntake({});
      }
    }

    if (storedReport) {
      try {
        setAnalysis(JSON.parse(storedReport));
      } catch {
        setAnalysis(null);
      }
    }

    if (storedMock) {
      setMockText(storedMock);
    }

    if (storedHorizon === "14") {
      setHorizonDays(14);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.intake, JSON.stringify(intake));
  }, [intake]);

  useEffect(() => {
    if (analysis) {
      localStorage.setItem(STORAGE_KEYS.report, JSON.stringify(analysis));
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
        <IntakeBot intake={intake} onIntakeChange={setIntake} analysis={analysis} onReset={handleReset} />
      </section>

      <section className="mt-10">
        <ReportView analysis={analysis} loading={loading} />
      </section>
    </main>
  );
}
