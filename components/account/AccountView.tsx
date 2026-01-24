"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const themes = ["light", "dark", "system"];

export function AccountView() {
  const [profile, setProfile] = React.useState<any>(null);
  const [form, setForm] = React.useState({
    displayName: "",
    examGoal: "",
    targetDate: "",
    weeklyHours: 0,
    baselineLevel: "",
    theme: "system",
  });

  React.useEffect(() => {
    async function loadProfile() {
      const res = await fetch("/api/user");
      const json = await res.json();
      if (json.ok) {
        setProfile(json.data);
        setForm({
          displayName: json.data.displayName || "",
          examGoal: json.data.examGoal || "",
          targetDate: json.data.targetDate || "",
          weeklyHours: json.data.weeklyHours ?? 0,
          baselineLevel: json.data.baselineLevel || "",
          theme: json.data.preferences?.theme || "system",
        });
      }
    }
    void loadProfile();
  }, []);

  const handleSave = async () => {
    const res = await fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName,
        examGoal: form.examGoal,
        targetDate: form.targetDate || null,
        weeklyHours: Number(form.weeklyHours) || 0,
        baselineLevel: form.baselineLevel || null,
        preferences: { theme: form.theme },
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setProfile(json.data);
      toast.success("Profile saved");
    } else {
      toast.error(json.error?.message || "Unable to save");
    }
  };

  const handleExport = () => {
    window.location.href = "/api/account/export";
  };

  const handleDelete = async () => {
    const res = await fetch("/api/account/delete", { method: "POST" });
    const json = await res.json();
    if (json.ok) {
      toast.success("Account deleted");
      window.location.href = "/";
    } else {
      toast.error(json.error?.message || "Unable to delete account");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <h1 className="text-3xl font-semibold">Account</h1>
      <div className="rounded-2xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Exam goal</Label>
            <Input
              value={form.examGoal}
              onChange={(event) => setForm((prev) => ({ ...prev, examGoal: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Target date</Label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(event) => setForm((prev) => ({ ...prev, targetDate: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Weekly hours</Label>
            <Input
              type="number"
              value={form.weeklyHours}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, weeklyHours: Number(event.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Baseline level</Label>
            <Input
              value={form.baselineLevel}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, baselineLevel: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={form.theme} onValueChange={(value) => setForm((prev) => ({ ...prev, theme: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme} value={theme}>
                    {theme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-4" onClick={handleSave}>
          Save changes
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">Account actions</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {profile?.email || ""} via {profile?.provider || "google"}.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport}>
            Export data
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete account
          </Button>
        </div>
      </div>
    </main>
  );
}
