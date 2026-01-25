"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis } from "@/lib/schemas/mvp";

const inputTabs = [
  { id: "upload", label: "Upload PDF" },
  { id: "paste", label: "Paste Text" },
] as const;

type InputTab = (typeof inputTabs)[number]["id"];

type ApiError = {
  code: string;
  message: string;
};

export function AnalyzePanel() {
  const [tab, setTab] = useState<InputTab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const resultsReady = useMemo(() => Boolean(analysis), [analysis]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      let res: Response | null = null;

      if (file || text.trim()) {
        const form = new FormData();
        if (file) form.append("file", file);
        if (text.trim()) form.append("text", text.trim());

        res = await fetch("/api/analyze", {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      }

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setError({
          code: payload?.error?.code ?? "ANALYZE_FAILED",
          message: payload?.error?.message ?? "Unable to analyze. Please try again.",
        });
        setAnalysis(null);
        return;
      }

      setAnalysis(payload.analysis as Analysis);
    } catch (err) {
      setError({
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network issue. Please retry.",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="space-y-6">
      <div className="surface-card space-y-6 p-6">
        <div className="flex flex-wrap gap-3">
          {inputTabs.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={tab === item.id ? "default" : "outline"}
              className="tap-scale"
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {tab === "upload" ? (
          <div className="space-y-3">
            <label className="text-sm font-medium">Upload a mock scorecard PDF</label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Text-based PDFs only. Scanned images aren’t supported yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-sm font-medium">Paste mock text</label>
            <Textarea
              rows={8}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste your mock scorecard, time split, mistakes, and notes."
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="tap-scale"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Next Best Actions"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFile(null);
              setText("");
              setAnalysis(null);
              setChecked({});
              setError(null);
            }}
          >
            Reset
          </Button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p className="font-semibold">{error.code}</p>
            <p>{error.message}</p>
          </div>
        ) : null}
      </div>

      {resultsReady && analysis ? (
        <div className="space-y-6">
          <div className="surface-glow p-6">
            <h3 className="text-lg font-semibold">Summary</h3>
            <p className="text-muted mt-2">{analysis.summary || "Summary generated."}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="surface-card space-y-4 p-6">
              <h3 className="text-lg font-semibold">Detected mistakes</h3>
              <div className="space-y-3">
                {analysis.errors.map((errorItem, idx) => (
                  <div key={`${errorItem.type}-${idx}`} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold capitalize">{errorItem.type}</p>
                      <span className="rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
                        Severity {errorItem.severity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{errorItem.detail}</p>
                  </div>
                ))}
                {analysis.errors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No errors detected yet.</p>
                ) : null}
              </div>
            </div>

            <div className="surface-card space-y-4 p-6">
              <h3 className="text-lg font-semibold">Next Best Actions</h3>
              <div className="space-y-3">
                {analysis.nextBestActions.map((action, idx) => (
                  <div key={`${action.title}-${idx}`} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{action.title}</p>
                      <span className="text-xs text-muted-foreground">~{action.etaMins} mins</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{action.why}</p>
                    {action.steps.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {action.steps.map((step, stepIdx) => (
                          <li key={`${action.title}-step-${stepIdx}`}>{step}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
                {analysis.nextBestActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No actions generated yet.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="surface-card space-y-4 p-6">
            <h3 className="text-lg font-semibold">7-Day Study Plan</h3>
            <div className="space-y-4">
              {analysis.plan7d.map((day) => (
                <div key={`day-${day.day}`} className="rounded-2xl border border-border/70 p-4">
                  <p className="text-sm font-semibold">Day {day.day}: {day.focus}</p>
                  <div className="mt-3 space-y-2">
                    {day.tasks.map((task, idx) => {
                      const key = `${day.day}-${idx}`;
                      return (
                        <label key={key} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(checked[key])}
                            onChange={() => toggleTask(key)}
                            className="h-4 w-4 rounded border-border/70 accent-primary"
                          />
                          <span>{task.title} · {task.minutes} min</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {analysis.plan7d.length === 0 ? (
                <p className="text-sm text-muted-foreground">Plan not available yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
