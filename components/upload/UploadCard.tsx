"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AnalyzeResult = {
  attempt: Record<string, any>;
  recommendation: Record<string, any>;
  progressSummary: Record<string, any>;
  recentEvents: Array<Record<string, any>>;
};

type UploadCardProps = {
  onAnalyzed: (result: AnalyzeResult) => void;
};

export function UploadCard({ onAnalyzed }: UploadCardProps) {
  const [tab, setTab] = React.useState("file");
  const [file, setFile] = React.useState<File | null>(null);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    if (tab === "text" && !text.trim()) return;
    setLoading(true);
    try {
      const form = new FormData();
      if (tab === "file" && file) {
        form.append("file", file);
      }
      if (tab === "text") {
        form.append("text", text);
      }
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (json.ok) {
        onAnalyzed(json.data);
        toast.success("Analysis ready");
      } else {
        toast.error(json.error?.message || "Analyze failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h2 className="text-lg font-semibold">Upload mock</h2>
      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="file">Upload PDF/Image</TabsTrigger>
          <TabsTrigger value="text">Paste Text</TabsTrigger>
        </TabsList>
        <TabsContent value="file" className="mt-4 space-y-3">
          <Label htmlFor="file-upload">Choose file</Label>
          <Input
            id="file-upload"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </TabsContent>
        <TabsContent value="text" className="mt-4 space-y-3">
          <Label htmlFor="text-upload">Paste text</Label>
          <textarea
            id="text-upload"
            className="min-h-[120px] w-full rounded-lg border border-border bg-background p-3 text-sm"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Minimum 80 characters for reliable analysis.</p>
        </TabsContent>
      </Tabs>
      <Button
        className="mt-4"
        onClick={handleSubmit}
        disabled={
          loading ||
          (tab === "file" && !file) ||
          (tab === "text" && text.trim().length < 80)
        }
      >
        {loading ? "Analyzing..." : "Analyze"}
      </Button>
    </div>
  );
}
