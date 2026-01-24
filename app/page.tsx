"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, Goal, Loader2, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ShareCard } from "@/components/cogniverse/ShareCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import type { GoalFocus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "success" | "error";

const goals: GoalFocus[] = ["Score", "Accuracy", "Speed", "Concepts"];
const FILE_SIZE_LIMIT_BYTES = 8 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function LandingPage() {
  const router = useRouter();
  const { state, setIntake, analyzeAttempt } = useCogniverse();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [manualText, setManualText] = React.useState("");
  const [uploadState, setUploadState] = React.useState<UploadState>("idle");
  const [statusMessage, setStatusMessage] = React.useState<string>("Upload a PDF scorecard to get your next mock plan.");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFilePick = () => inputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadState("error");
      setStatusMessage("Only PDF scorecards are supported. Export your scorecard as a PDF and try again.");
      return;
    }

    if (file.size > FILE_SIZE_LIMIT_BYTES) {
      setUploadState("error");
      setStatusMessage("That PDF is too large. Please upload a file under 8MB.");
      return;
    }

    setSelectedFile(file);
    setUploadState("idle");
    setStatusMessage(`Ready to analyze ${file.name} (${formatFileSize(file.size)}).`);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setUploadState("error");
      setStatusMessage("Choose a PDF scorecard first. If your mock platform blocks downloads, use Print → Save as PDF.");
      return;
    }

    try {
      setUploadState("uploading");
      setStatusMessage("Uploading your PDF and generating your improvement plan…");

      const result = await analyzeAttempt({
        examLabel: state.intake.examLabel,
        files: [selectedFile],
        manualText,
      });

      setUploadState("success");
      setStatusMessage("Plan ready. Opening your coach view…");
      toast.success("Coach plan generated.");
      router.push(`/dashboard?attempt=${result.attemptId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
      setUploadState("error");
      setStatusMessage(`${message} If this keeps happening, re-export the PDF and upload it again.`);
      toast.error(message);
    }
  };

  const uploadTone =
    uploadState === "success"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : uploadState === "error"
        ? "border-destructive/40 bg-destructive/5"
        : "border-primary/25 bg-primary/5";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-4 pb-24 pt-12 sm:px-6 lg:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <Badge className="inline-flex items-center gap-2 rounded-full border-primary/15 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-primary">
            <Goal className="h-3.5 w-3.5" aria-hidden />
            Personal coach for your next mock
          </Badge>
          <div className="space-y-4">
            <h1 className="text-display max-w-2xl">Upload one mock. Get a 7-day score lift plan in minutes.</h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Cogniverse is your personal coach. We pinpoint the primary bottleneck, show the expected uplift, and tell you exactly what to do before your next attempt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5">
              <Clock3 className="h-4 w-4 text-primary" aria-hidden />
              Value in under 3 minutes
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5">
              <UploadCloud className="h-4 w-4 text-primary" aria-hidden />
              PDF scorecards supported
            </div>
          </div>
        </div>

        <div className="surface-card flex flex-col gap-6 p-6 sm:p-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Generate your improvement plan</h2>
            <p className="text-sm text-muted-foreground">Start with a PDF scorecard. We&apos;ll do the heavy lifting.</p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="exam-label">
                Exam label (optional)
              </label>
              <Input
                id="exam-label"
                placeholder="e.g., CAT 2026"
                value={state.intake.examLabel}
                onChange={(event) => setIntake({ examLabel: event.target.value })}
                className="rounded-2xl"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Goal"
                value={state.intake.goal}
                onValueChange={(value) => setIntake({ goal: value as GoalFocus })}
                options={goals.map((goal) => ({ label: goal, value: goal }))}
              />
              <SelectField
                label="Plan length"
                value={state.intake.nextMockDays}
                onValueChange={(value) => setIntake({ nextMockDays: value })}
                options={[
                  { label: "3 days", value: "3" },
                  { label: "5 days", value: "5" },
                  { label: "7 days", value: "7" },
                ]}
              />
              <SelectField
                label="Weekly hours"
                value={state.intake.weeklyHours}
                onValueChange={(value) => setIntake({ weeklyHours: value })}
                options={[
                  { label: "<10 hours", value: "<10" },
                  { label: "10–20 hours", value: "10-20" },
                  { label: "20–35 hours", value: "20-35" },
                  { label: "35+ hours", value: "35+" },
                ]}
              />
              <SelectField
                label="Daily commitment"
                value={state.intake.dailyCommitmentMinutes}
                onValueChange={(value) => setIntake({ dailyCommitmentMinutes: value })}
                options={[
                  { label: "45 min / day", value: "45" },
                  { label: "60 min / day", value: "60" },
                  { label: "90 min / day", value: "90" },
                  { label: "120 min / day", value: "120" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Upload PDF scorecard</p>
              <div className={cn("flex flex-col gap-4 rounded-[1.75rem] border border-dashed p-5 text-sm transition", uploadTone)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Choose a PDF</p>
                    <p className="text-xs text-muted-foreground">We validate file type and size. Max 8MB.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" className="tap-scale rounded-full" onClick={handleFilePick}>
                      Choose file
                    </Button>
                    {selectedFile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full text-muted-foreground"
                        onClick={() => {
                          setSelectedFile(null);
                          setUploadState("idle");
                          setStatusMessage("Upload a PDF scorecard to get your next mock plan.");
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>

                <input ref={inputRef} id="mock-upload" type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

                {selectedFile ? (
                  <div className="rounded-2xl border border-border/70 bg-background/90 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{selectedFile.name}</p>
                    <p>
                      PDF · {formatFileSize(selectedFile.size)} · ready to analyze
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-background/90 p-3 text-xs text-muted-foreground">
                    Upload your latest mock scorecard. We&apos;ll generate the plan even if the PDF is messy.
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-2xl border border-border/60 bg-background/95 p-3 text-xs">
                  <StatusIcon state={uploadState} />
                  <p className="text-muted-foreground">{statusMessage}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Optional: add context</p>
              <Input
                className="rounded-2xl"
                placeholder="e.g., I ran out of time in DILR set 3"
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
              />
            </div>

            <Button type="submit" className="tap-scale mt-1 rounded-2xl text-sm font-semibold" disabled={uploadState === "uploading"}>
              {uploadState === "uploading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Generating plan
                </>
              ) : (
                <>
                  Generate my plan
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card flex flex-col gap-4 p-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">What you&apos;ll see in under a minute</h2>
            <p className="text-sm text-muted-foreground">No dashboards. Just the fastest path to a higher score on your next mock.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Primary bottleneck",
                detail: "One line on what&apos;s costing the most marks",
              },
              {
                title: "Expected uplift",
                detail: "A believable score lift range tied to effort",
              },
              {
                title: "3 next actions",
                detail: "Exactly what to do today and why it works",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-border/70 bg-background/95 p-4 transition hover:border-primary/35">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Free includes your cognitive summary and first action. Unlock the full plan to track progress and see the complete reasoning.
          </p>
        </div>
        <ShareCard variant="summary" report={state.report} />
      </section>
    </main>
  );
}

function StatusIcon({ state }: { state: UploadState }) {
  if (state === "uploading") return <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-primary" aria-hidden />;
  if (state === "success") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden />;
  if (state === "error") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />;
  return <UploadCloud className="mt-0.5 h-4 w-4 text-primary" aria-hidden />;
}

type SelectFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
};

function SelectField({ label, value, onValueChange, options }: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="rounded-2xl">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
