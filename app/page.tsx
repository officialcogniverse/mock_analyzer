"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type IntakeState = {
  goal: "score" | "accuracy" | "speed" | "concepts";
  hardest: "selection" | "time" | "concepts" | "careless" | "anxiety" | "consistency";
  weekly_hours: "<10" | "10-20" | "20-35" | "35+";
  next_mock_date: string;
  preferred_topics: string;
};

const DEFAULT_INTAKE: IntakeState = {
  goal: "score",
  hardest: "selection",
  weekly_hours: "10-20",
  next_mock_date: "",
  preferred_topics: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const [intake, setIntake] = useState<IntakeState>(DEFAULT_INTAKE);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (text.trim()) formData.append("text", text.trim());
      formData.append("intake", JSON.stringify(intake));

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message || json?.error || "Failed to generate plan.");
        return;
      }
      const attemptId = json?.id || json?.attempt?._id;
      if (attemptId) {
        router.push(`/report/${attemptId}`);
      } else {
        setError("Plan created, but no attempt id was returned.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cogniverse Mock Analyzer</p>
        <h1 className="text-3xl font-semibold tracking-tight">Turn your mock into a focused plan.</h1>
        <p className="text-muted-foreground">
          Upload a PDF or paste your mock summary. We will generate next-best actions, drills, and a mock-day
          strategy.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 grid gap-6 rounded-3xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Goal</Label>
            <Select
              value={intake.goal}
              onValueChange={(value: IntakeState["goal"]) =>
                setIntake((prev) => ({ ...prev, goal: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="accuracy">Accuracy</SelectItem>
                <SelectItem value="speed">Speed</SelectItem>
                <SelectItem value="concepts">Concepts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Hardest bottleneck</Label>
            <Select
              value={intake.hardest}
              onValueChange={(value: IntakeState["hardest"]) =>
                setIntake((prev) => ({ ...prev, hardest: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick the hardest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selection">Question selection</SelectItem>
                <SelectItem value="time">Time management</SelectItem>
                <SelectItem value="concepts">Concept clarity</SelectItem>
                <SelectItem value="careless">Careless errors</SelectItem>
                <SelectItem value="anxiety">Anxiety</SelectItem>
                <SelectItem value="consistency">Consistency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Weekly hours</Label>
            <Select
              value={intake.weekly_hours}
              onValueChange={(value: IntakeState["weekly_hours"]) =>
                setIntake((prev) => ({ ...prev, weekly_hours: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Weekly hours" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="<10">&lt;10</SelectItem>
                <SelectItem value="10-20">10-20</SelectItem>
                <SelectItem value="20-35">20-35</SelectItem>
                <SelectItem value="35+">35+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="next-mock">Next mock date (optional)</Label>
            <Input
              id="next-mock"
              type="date"
              value={intake.next_mock_date}
              onChange={(event) => setIntake((prev) => ({ ...prev, next_mock_date: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topics">Preferred topics (optional)</Label>
            <Input
              id="topics"
              placeholder="e.g., algebra, probability"
              value={intake.preferred_topics}
              onChange={(event) => setIntake((prev) => ({ ...prev, preferred_topics: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file">Upload mock PDF (optional)</Label>
          <Input
            id="file"
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Images are accepted but OCR is not enabled yet. For images, paste text instead.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="text">Paste mock summary (optional)</Label>
          <Textarea
            id="text"
            rows={6}
            placeholder="Paste your mock scorecard, metrics, and notes here."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>

        {error ? <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Generating plan..." : "Generate my plan"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setText("");
              setFile(null);
              setIntake(DEFAULT_INTAKE);
            }}
          >
            Reset
          </Button>
        </div>
      </form>
    </main>
  );
}
