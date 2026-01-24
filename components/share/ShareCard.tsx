import { Button } from "@/components/ui/button";

export function ShareCard({ summary }: { summary?: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h2 className="text-lg font-semibold">Share snapshot</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {summary || "Run an analysis to generate a shareable summary."}
      </p>
      <Button className="mt-4" variant="outline">
        Copy summary
      </Button>
    </div>
  );
}
