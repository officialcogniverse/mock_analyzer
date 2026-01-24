import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Student",
    price: "Free",
    description: "One report at a time with core insights and actions.",
    features: ["Single mock analysis", "Coach-style summary", "Next mock script"],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "₹399 / month",
    description: "Advanced tracking, follow-ups, and streak automation.",
    features: ["Unlimited mocks", "Advanced follow-ups", "Action completion tracking"],
    cta: "Upgrade to Pro",
  },
  {
    name: "Institute",
    price: "Custom",
    description: "Cohort dashboard, exports, and evidence-based plans.",
    features: ["Cohort view", "Exportable JSON/CSV", "Action confidence tracking"],
    cta: "Talk to sales",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-slate-900">Pricing</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Transparent, student-friendly pricing that scales for institutes.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.name} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div>
                <div className="text-lg font-semibold text-slate-900">{tier.name}</div>
                <div className="text-3xl font-bold text-indigo-700">{tier.price}</div>
              </div>
              <p className="text-sm text-muted-foreground">{tier.description}</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {tier.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Button className="w-full" variant={tier.name === "Institute" ? "outline" : "default"}>
                {tier.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
