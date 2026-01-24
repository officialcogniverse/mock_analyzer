import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-3xl font-semibold text-slate-900">Trust & privacy</h1>
          <p className="text-sm text-muted-foreground">
            Cogniverse Mock Analyzer is designed to keep student data safe and useful.
          </p>
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <strong>Data usage:</strong> We use uploaded mocks only to generate your report and
              improve your study plan. We do not sell data or share it with third parties.
            </p>
            <p>
              <strong>Storage:</strong> Reports are stored securely and linked to your session or
              account so you can revisit your progress.
            </p>
            <p>
              <strong>Control:</strong> You can export your data at any time from the dashboard. For
              institute use, exports are available in JSON or CSV.
            </p>
            <p>
              <strong>Security:</strong> We apply least-privilege access to data and review activity
              logs for abuse.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
