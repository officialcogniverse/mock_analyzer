"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { useAttempts } from "@/lib/hooks/useAttempts";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function HistoryPage() {
  const router = useRouter();
  const { attempts, loading, error, refresh } = useAttempts(30);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          eyebrow="History"
          title="Attempt history"
          description="Every attempt should connect back to a report, checklist, and delta."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/")}>
            Upload attempt
          </Button>
          <Button variant="ghost" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? <LoadingState lines={10} /> : null}

      {!loading && error ? (
        <EmptyState
          title="Could not load history"
          description={error}
          action={<Button onClick={() => router.push("/")}>Back to upload</Button>}
        />
      ) : null}

      {!loading && !error && attempts.length ? (
        <div className="space-y-3">
          {attempts.map((attempt, index) => (
            <Card key={attempt.id} className="rounded-2xl border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Attempt #{attempts.length - index}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(attempt.createdAt)} · {attempt.sourceType}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => router.push(`/attempt/${attempt.id}`)}>
                    View report
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && !error && !attempts.length ? (
        <EmptyState
          title="No attempts yet"
          description="Upload your first attempt to generate a report and start closing the loop."
          action={<Button onClick={() => router.push("/")}>Upload attempt</Button>}
        />
      ) : null}
    </main>
  );
}
