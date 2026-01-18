"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type ApiOk = {
  id: string;
  createdAt: string;
  exam: string;
  report: any;
};

type ApiErr = { error: string };

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<ApiOk | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/report/${id}`);
        const json = (await res.json()) as ApiOk | ApiErr;

        if (!res.ok) {
          setError((json as ApiErr).error || "Failed to load report");
          setData(null);
          return;
        }

        if (!(json as ApiOk).report) {
          setError("Report missing (try analyzing again).");
          setData(null);
          return;
        }

        setData(json as ApiOk);
        setError("");
      } catch {
        setError("Network error while loading report");
        setData(null);
      }
    })();
  }, [id]);

  const r = data?.report;

  const vibe = useMemo(() => {
    const conf = r?.estimated_score?.confidence;
    if (conf === "high") return "🔥 Locked in";
    if (conf === "medium") return "⚡ On the rise";
    return "🌱 Building momentum";
  }, [r]);

  // 🔥 Focus XP derived from weaknesses severity (simple + fun)
  const focusXP = useMemo(() => {
    const weaknesses = Array.isArray(r?.weaknesses) ? r.weaknesses : [];
    const raw = weaknesses.reduce(
      (sum: number, w: any) => sum + (Number(w?.severity) || 0) * 10,
      0
    );
    return Math.min(100, Math.max(0, raw));
  }, [r]);

  // 🚫 Trap chips derived from weakness topics
  const traps = useMemo(() => {
    const weaknesses = Array.isArray(r?.weaknesses) ? r.weaknesses : [];
    return weaknesses
      .map((w: any) => String(w?.topic || "").trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [r]);

  // ⚡ Daily streak UI only (no accounts); optional: save locally
  const [streakDone, setStreakDone] = useState<boolean[]>(() => {
    if (typeof window === "undefined") return Array(7).fill(false);
    try {
      const saved = localStorage.getItem("cogniverse_streak_7");
      if (!saved) return Array(7).fill(false);
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 7) return parsed;
      return Array(7).fill(false);
    } catch {
      return Array(7).fill(false);
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("cogniverse_streak_7", JSON.stringify(streakDone));
    } catch {}
  }, [streakDone]);

  function toggleStreak(i: number) {
    setStreakDone((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  if (error) {
    return (
      <main className="min-h-screen p-6 flex justify-center items-center">
        <Card className="p-6 w-full max-w-xl space-y-4">
          <div className="text-lg font-semibold">Couldn’t load report</div>
          <div className="text-sm text-muted-foreground">{error}</div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/")}>Back</Button>
            <Button variant="secondary" onClick={() => location.reload()}>
              Retry
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Note: reports are stored in-memory right now. If you restarted the dev
            server, old links can 404.
          </div>
        </Card>
      </main>
    );
  }

  if (!data) return <div className="p-6">Loading...</div>;

  return (
    <main className="min-h-screen p-6 flex justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-4xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-3xl font-bold">Your Cogniverse Report</div>
            <div className="text-sm text-muted-foreground">
              Exam: <span className="font-medium">{data.exam}</span> •{" "}
              <span className="font-medium">{vibe}</span>
            </div>
          </div>
          <Button variant="secondary" onClick={() => router.push("/")}>
            Analyze another
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="snapshot" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="snapshot" className="flex-1">
              Snapshot
            </TabsTrigger>
            <TabsTrigger value="weakspots" className="flex-1">
              Weak Spots
            </TabsTrigger>
            <TabsTrigger value="quest" className="flex-1">
              14-Day Quest
            </TabsTrigger>
          </TabsList>

          {/* SNAPSHOT */}
          <TabsContent value="snapshot" className="space-y-4">
            <Card className="p-5 space-y-3 rounded-2xl">
              <div className="text-lg font-semibold">Summary (from report)</div>
              <div className="text-sm">{r.summary}</div>

              {r.estimated_score ? (
                <div className="pt-2 text-sm text-muted-foreground">
                  Confidence:{" "}
                  <Badge variant="secondary">
                    {r.estimated_score.confidence ?? "unknown"}
                  </Badge>
                  {Array.isArray(r.estimated_score.range) &&
                  r.estimated_score.range.length === 2 ? (
                    <span className="ml-2">
                      Range:{" "}
                      <span className="font-medium">
                        {r.estimated_score.range[0]}–{r.estimated_score.range[1]}
                      </span>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5 rounded-2xl space-y-3">
                <div className="font-semibold">Strengths ✅</div>
                <div className="flex flex-wrap gap-2">
                  {(r.strengths || []).map((s: string, i: number) => (
                    <Badge key={i} className="rounded-full">
                      {s}
                    </Badge>
                  ))}
                </div>
              </Card>

              <Card className="p-5 rounded-2xl space-y-3">
                <div className="font-semibold">Top Actions (AI suggestions)</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {(r.top_actions || []).map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </TabsContent>

          {/* WEAK SPOTS */}
          <TabsContent value="weakspots" className="space-y-4">
            <Card className="p-5 rounded-2xl space-y-3">
              <div className="text-lg font-semibold">Weak Spots 🎯</div>
              <div className="text-sm text-muted-foreground">
                These come from the report + light reasoning. No fake certainty.
              </div>

              <div className="space-y-3">
                {(r.weaknesses || []).map((w: any, i: number) => (
                  <div key={i} className="rounded-xl border p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{w.topic}</div>
                      <Badge variant="secondary">Severity {w.severity}/5</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {w.reason}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {r.error_types ? (
              <Card className="p-5 rounded-2xl space-y-4">
                <div className="text-lg font-semibold">Error Pattern Map 🧠</div>

                {(
                  ["conceptual", "careless", "time", "comprehension"] as const
                ).map((k) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{k}</span>
                      <span className="text-muted-foreground">
                        {r.error_types[k]}%
                      </span>
                    </div>
                    <Progress value={r.error_types[k]} />
                  </div>
                ))}
              </Card>
            ) : null}
          </TabsContent>

          {/* QUEST */}
          <TabsContent value="quest" className="space-y-4">
            {/* NEW: Focus XP */}
            <Card className="p-5 rounded-2xl space-y-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">🔥 Focus XP</div>
                  <div className="text-sm text-muted-foreground">
                    Earned by fixing high-impact weaknesses
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{focusXP}</div>
                  <div className="text-xs text-muted-foreground">XP</div>
                </div>
              </div>
              <Progress value={focusXP} />
              <div className="text-xs text-muted-foreground">
                Pro tip: move the highest-severity weakness first = fastest ROI.
              </div>
            </Card>

            {/* NEW: Avoid These Traps */}
            <Card className="p-5 rounded-2xl space-y-3">
              <div className="text-lg font-semibold">🚫 Avoid These Traps</div>
              <div className="flex flex-wrap gap-2">
                {traps.length ? (
                  traps.map((t, i) => (
                    <Badge
                      key={i}
                      variant="destructive"
                      className="rounded-full"
                    >
                      {t}
                    </Badge>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No trap topics detected. Nice.
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                These are the “easy-to-lose marks” zones. Don’t go autopilot here.
              </div>
            </Card>

            {/* NEW: Daily Streak (no accounts) */}
            <Card className="p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">⚡ Daily Streak</div>
                  <div className="text-sm text-muted-foreground">
                    Tap a dot when you complete at least one task today.
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setStreakDone(Array(7).fill(false))}
                >
                  Reset
                </Button>
              </div>

              <div className="flex gap-2">
                {streakDone.map((done, i) => (
                  <button
                    key={i}
                    onClick={() => toggleStreak(i)}
                    className={`h-7 w-7 rounded-full transition ${
                      done ? "bg-indigo-500" : "bg-indigo-500/20"
                    }`}
                    title={`Day ${i + 1}`}
                  />
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                No account needed. This is saved locally in your browser.
              </div>
            </Card>

            {/* Existing Quest intro */}
            <Card className="p-5 rounded-2xl space-y-2">
              <div className="text-lg font-semibold">14-Day Questline 🗺️</div>
              <div className="text-sm text-muted-foreground">
                Small daily wins → compounding confidence.
              </div>
            </Card>

            <Card className="p-3 rounded-2xl">
              <Accordion type="single" collapsible className="w-full">
                {(r.fourteen_day_plan || []).map((d: any) => (
                  <AccordionItem key={d.day} value={`day-${d.day}`}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <Badge className="rounded-full">Day {d.day}</Badge>
                        <span className="font-medium">{d.focus}</span>
                        <span className="text-xs text-muted-foreground">
                          • {d.time_minutes} min
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc pl-6 text-sm space-y-1">
                        {(d.tasks || []).map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>

            <Card className="p-5 rounded-2xl space-y-2">
              <div className="font-semibold">Next Mock Strategy 🧪</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {(r.next_mock_strategy || []).map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
