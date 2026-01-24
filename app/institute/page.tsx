"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/section-header";
import { Download, UserPlus } from "lucide-react";

type InstituteStudent = {
  userId: string;
  latestAttemptId: string;
  createdAt: string;
  exam: string;
  confidence: string;
  primaryBottleneck: string;
  actionCompletionRate: number;
};

type RosterStudent = {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
};

export default function InstitutePage() {
  const [students, setStudents] = useState<InstituteStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [res, rosterRes] = await Promise.all([
        fetch("/api/institute"),
        fetch("/api/institute/roster"),
      ]);
      const data = await res.json();
      const rosterJson = await rosterRes.json();

      if (res.ok) setStudents(data.students || []);
      if (rosterRes.ok) setRoster(rosterJson.students || []);
    } catch {
      toast.error("Failed to load institute data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const exportData = useMemo(() => ({ students, roster }), [students, roster]);

  function download(format: "json" | "csv") {
    try {
      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "cogniverse_institute_export.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return;
      }

      const headers = [
        "userId",
        "latestAttemptId",
        "createdAt",
        "exam",
        "confidence",
        "primaryBottleneck",
        "actionCompletionRate",
      ];
      const rows = students.map((s) =>
        headers
          .map((h) => JSON.stringify(String((s as any)[h] ?? "")))
          .join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cogniverse_institute_export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  async function addStudent() {
    if (!name.trim()) {
      toast.error("Enter a student name");
      return;
    }

    const res = await fetch("/api/institute/roster", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, notes }),
    });
    const json = await res.json();

    if (!res.ok) {
      toast.error(json?.error || "Failed to add student");
      return;
    }

    setName("");
    setNotes("");
    await loadData();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Institute dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track cohort performance and export evidence-based reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download("json")} className="gap-2">
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <Button variant="outline" onClick={() => download("csv")} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader title="Latest attempts" description="Most recent attempt per student" />
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : students.length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2">Student ID</th>
                      <th className="py-2">Latest attempt</th>
                      <th className="py-2">Confidence</th>
                      <th className="py-2">Bottleneck</th>
                      <th className="py-2">Actions done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.userId} className="border-t">
                        <td className="py-2 pr-2 text-xs text-muted-foreground">
                          {student.userId.slice(0, 10)}…
                        </td>
                        <td className="py-2">{new Date(student.createdAt).toLocaleDateString()}</td>
                        <td className="py-2">
                          <Badge variant="secondary">{student.confidence}</Badge>
                        </td>
                        <td className="py-2 max-w-[200px] truncate" title={student.primaryBottleneck}>
                          {student.primaryBottleneck}
                        </td>
                        <td className="py-2">{student.actionCompletionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No attempts yet. Upload student mock reports to populate this view.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <SectionHeader
              title="Manual roster"
              description="Add students without CSV (MVP)"
            />
            <div className="grid gap-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Student name"
              />
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
              <Button onClick={addStudent} className="gap-2">
                <UserPlus className="h-4 w-4" /> Add student
              </Button>
            </div>
            {roster.length ? (
              <div className="space-y-2 text-sm">
                {roster.map((student) => (
                  <div key={student.id} className="rounded-lg border px-3 py-2">
                    <div className="font-semibold">{student.name}</div>
                    <div className="text-xs text-muted-foreground">{student.notes}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No manual roster entries yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
