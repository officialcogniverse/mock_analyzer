"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AnalyzeResponse } from "@/lib/contracts";
import type { IntakeAnswers } from "@/lib/engine/schemas";
import { emitEvent } from "@/lib/clientEvents";

type IntakeBotProps = {
  intake: IntakeAnswers;
  onIntakeChange: (next: IntakeAnswers) => void;
  analysis: AnalyzeResponse | null;
  onReset: () => void;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const examOptions: Array<{ id: Exclude<IntakeAnswers["exam"], undefined>; label: string }> = [
  { id: "CAT", label: "CAT" },
  { id: "JEE", label: "JEE" },
  { id: "NEET", label: "NEET" },
  { id: "UPSC", label: "UPSC" },
  { id: "OTHER", label: "Other" },
];

const situationOptions: Array<{ id: Exclude<IntakeAnswers["situation"], undefined>; label: string }> = [
  { id: "LOW_MOTIVATION", label: "Low motivation" },
  { id: "INCONSISTENT", label: "Inconsistent" },
  { id: "LOW_ACCURACY", label: "Low accuracy" },
  { id: "WEAK_CONCEPTS", label: "Weak concepts" },
  { id: "TIME_MANAGEMENT", label: "Time management" },
  { id: "OTHER", label: "Other" },
];

const weeklyOptions: Array<{ id: Exclude<IntakeAnswers["weeklyHours"], undefined>; label: string }> = [
  { id: "0_3", label: "0-3 hrs" },
  { id: "4_6", label: "4-6 hrs" },
  { id: "7_10", label: "7-10 hrs" },
  { id: "11_15", label: "11-15 hrs" },
  { id: "16_25", label: "16-25 hrs" },
  { id: "25_PLUS", label: "25+ hrs" },
];

const routineOptions: Array<{ id: Exclude<IntakeAnswers["routineType"], undefined>; label: string }> = [
  { id: "MORNING", label: "Morning focus" },
  { id: "NIGHT", label: "Night focus" },
  { id: "MIXED", label: "Mixed" },
];

const quickChips = [
  "Summarize my top error patterns",
  "Give me one thing to fix this week",
  "I feel stuck — give me a reset plan",
];

export function IntakeBot({ intake, onIntakeChange, analysis, onReset }: IntakeBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "I’m your Cogniverse Strategy Companion." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  useEffect(() => {
    if (!analysis) {
      setMessages([{ role: "assistant", content: "I’m your Cogniverse Strategy Companion." }]);
    }
  }, [analysis]);

  const completedCount = useMemo(() => {
    return [
      intake.exam,
      intake.daysToExam !== undefined,
      intake.situation,
      intake.weeklyHours,
      intake.routineType,
      intake.biggestPainPoint,
    ].filter(Boolean).length;
  }, [intake]);

  const stepLabel = `Step ${Math.min(completedCount + 1, 6)} of 6`;

  const updateIntake = (patch: Partial<IntakeAnswers>) => {
    onIntakeChange({ ...intake, ...patch });
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);

    try {
      await emitEvent("chat_message", { role: "user", content: trimmed });
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setError(payload?.error?.message ?? "Bot unavailable. Try again soon.");
        return;
      }

      if (payload.disclaimer) {
        setDisclaimer(payload.disclaimer);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload.message ?? "I’m here to help—try again with a shorter prompt.",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network issue. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="surface-card flex h-full flex-col gap-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">
            Cogniverse Strategy Companion
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
        <h3 className="text-xl font-semibold">Bot-first intake & guidance</h3>
        <p className="text-sm text-muted-foreground">
          Answer a few questions so I can tailor your report. You can skip anything.
        </p>
        {!analysis ? <p className="text-xs text-muted-foreground">{stepLabel}</p> : null}
      </div>

      {!analysis ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Which exam are you targeting?</p>
            <div className="flex flex-wrap gap-2">
              {examOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={intake.exam === option.id ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => {
                    updateIntake({ exam: option.id });
                    emitEvent("intake_updated", { exam: option.id });
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Days to exam (optional)</p>
            <Input
              type="number"
              min={0}
              value={intake.daysToExam ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                const next = value ? Number(value) : undefined;
                updateIntake({ daysToExam: next });
                emitEvent("intake_updated", { daysToExam: next });
              }}
              placeholder="e.g. 45"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What’s the current blocker?</p>
            <div className="flex flex-wrap gap-2">
              {situationOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={intake.situation === option.id ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => {
                    updateIntake({ situation: option.id });
                    emitEvent("intake_updated", { situation: option.id });
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Weekly study hours</p>
            <div className="flex flex-wrap gap-2">
              {weeklyOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={intake.weeklyHours === option.id ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => {
                    updateIntake({ weeklyHours: option.id });
                    emitEvent("intake_updated", { weeklyHours: option.id });
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Routine type</p>
            <div className="flex flex-wrap gap-2">
              {routineOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={intake.routineType === option.id ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => {
                    updateIntake({ routineType: option.id });
                    emitEvent("intake_updated", { routineType: option.id });
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Biggest pain point</p>
            <Textarea
              rows={3}
              value={intake.biggestPainPoint ?? ""}
              onChange={(event) => {
                const next = event.target.value || undefined;
                updateIntake({ biggestPainPoint: next });
                emitEvent("intake_updated", { biggestPainPoint: next });
              }}
              placeholder="e.g. I run out of time in quant and rush accuracy."
            />
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            Upload or paste your mock scorecard on the left to generate your report.
          </div>
        </div>
      ) : (
        <div className="space-y-4" />
      )}

      <div className="space-y-4 border-t border-border/60 pt-4">
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary/90 transition hover:border-primary hover:text-primary"
              onClick={() => sendMessage(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-transparent/40 p-4 text-sm">
          {messages.map((message, idx) => (
            <div
              key={`${message.role}-${idx}`}
              className={
                message.role === "user"
                  ? "ml-auto w-fit max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
                  : "mr-auto w-fit max-w-[80%] rounded-2xl bg-card px-4 py-2 text-foreground"
              }
            >
              {message.content}
            </div>
          ))}
          {loading ? <p className="text-xs text-muted-foreground">Bot is typing...</p> : null}
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {disclaimer ? <p className="text-xs text-muted-foreground">{disclaimer}</p> : null}

        <div className="space-y-2">
          <Textarea
            rows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask for your next move..."
          />
          <Button type="button" onClick={() => sendMessage(input)} disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
