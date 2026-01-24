"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetScore, setTargetScore] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [examName, setExamName] = useState("");
  const [tier, setTier] = useState("free");

  useEffect(() => {
    let active = true;
    fetch("/api/user")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const settings = json?.user?.settings || {};
        setTargetScore(String(settings.targetScore || ""));
        setTargetDate(String(settings.targetDate || ""));
        setExamName(String(settings.examName || ""));
        setTier(String(settings.tier || "free"));
      })
      .catch(() => toast.error("Could not load settings."))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: { targetScore, targetDate, examName, tier },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save settings.");
      toast.success("Settings saved ✅");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Set goals and exam metadata so coaching can reason about improvement deltas.
        </p>
      </div>

      <Card className="rounded-2xl border border-slate-200">
        <CardHeader>
          <CardTitle>Goals and exam context</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Input
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            placeholder="Exam metadata (e.g., CAT 2026 / Mock Series A)"
            disabled={loading}
          />
          <Input
            value={targetScore}
            onChange={(e) => setTargetScore(e.target.value)}
            placeholder="Target score / percentile"
            disabled={loading}
          />
          <Input
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            placeholder="Target date (YYYY-MM-DD)"
            disabled={loading}
          />
          <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-700">Plan tier</label>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              disabled={loading}
            >
              <option value="free">Free · limited reports</option>
              <option value="pro">Pro · history + deltas + deeper coach</option>
              <option value="institute">Institute · cohort oversight</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
