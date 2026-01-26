"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AnalysisResult, IntakeAnswers } from "@/lib/engine/schemas";

type UploadPanelProps = {
  intake?: IntakeAnswers;
  mockText: string;
  horizonDays: 7 | 14;
  onMockTextChange: (value: string) => void;
  onHorizonChange: (value: 7 | 14) => void;
  onReport: (result: AnalysisResult) => void;
  onLoadingChange: (loading: boolean) => void;
  onReset: () => void;
};

type ApiError = {
  code: string;
  message: string;
};

const quickHints = [
  "Upload a text-based PDF (not scanned).",
  "Include section scores, accuracy, time split, and mistakes.",
  "Minimum 200 characters for pasted text.",
];

export function UploadPanel({
  intake,
  mockText,
  horizonDays,
  onMockTextChange,
  onHorizonChange,
  onReport,
  onLoadingChange,
  onReset,
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const canSubmit = useMemo(() => Boolean(file || mockText.trim()), [file, mockText]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError({
        code: "MISSING_INPUT",
        message: "Upload a PDF or paste your scorecard text to continue.",
      });
      return;
    }

    setLoading(true);
    onLoadingChange(true);
    setError(null);

    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (mockText.trim()) form.append("text", mockText.trim());
      if (intake) form.append("intake", JSON.stringify(intake));
      form.append("horizonDays", horizonDays.toString());

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setError({
          code: payload?.error?.code ?? "ANALYZE_FAILED",
          message: payload?.error?.message ?? "Unable to analyze. Please try again.",
        });
        return;
      }

      onReport(payload.result as AnalysisResult);
    } catch (err) {
      setError({
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network issue. Please retry.",
      });
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setError(null);
    onReset();
  };

  return (
    <section className="surface-card space-y-6 p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">
          Upload & Analyze
        </p>
        <h2 className="text-lg font-semibold">Drop your mock scorecard</h2>
        <p className="text-sm text-muted-foreground">
          We’ll parse your mock and generate a structured plan in seconds.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Upload a text-based PDF</label>
        <Input
          type="file"
          accept="application/pdf"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Scanned PDFs are not supported yet. Export as text or paste below.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Or paste mock text</label>
        <Textarea
          rows={8}
          value={mockText}
          onChange={(event) => {
            onMockTextChange(event.target.value);
            setError(null);
          }}
          placeholder="Paste your mock scorecard, time split, mistakes, and notes."
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Plan horizon
        </p>
        <div className="flex gap-2">
          {[7, 14].map((value) => (
            <Button
              key={value}
              type="button"
              variant={horizonDays === value ? "secondary" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => onHorizonChange(value as 7 | 14)}
            >
              {value}-day
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="tap-scale" onClick={handleSubmit} disabled={loading}>
          {loading ? "Generating..." : "Generate Report"}
        </Button>
        <Button type="button" variant="ghost" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-semibold">{error.code}</p>
          <p>{error.message}</p>
        </div>
      ) : null}

      <ul className="space-y-1 text-xs text-muted-foreground">
        {quickHints.map((hint) => (
          <li key={hint} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
            <span>{hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
