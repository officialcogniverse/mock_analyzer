import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TrustPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Trust, data use, and AI ethics</h1>
        <p className="text-sm text-muted-foreground">
          Mock Analyzer is an evidence coach. We do not run open-ended chat. Every insight is
          tied to stored reports, actions, and progress signals.
        </p>
      </div>

      <div className="grid gap-4">
        {[
          {
            title: "Evidence-bound AI",
            body:
              "The coach cannot answer without a report context. Responses reference patterns, actions, and metrics pulled from your stored attempts.",
          },
          {
            title: "Data minimization",
            body:
              "We store mock attempts, reports, completed actions, and mentor notes. We avoid storing raw PDFs beyond what is needed for analysis workflows.",
          },
          {
            title: "Institute visibility",
            body:
              "Institutes see aggregation layers: latest attempt status, action adherence, and risk flags. They do not get a separate analyzer product.",
          },
        ].map((item) => (
          <Card key={item.title} className="rounded-2xl border border-slate-200">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
          </Card>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        For the full policy, see <Link href="/privacy" className="underline">privacy</Link>.
      </div>
    </div>
  );
}
