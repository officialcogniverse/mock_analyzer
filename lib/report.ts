import { z } from "zod";

const DEV_LOG = process.env.NODE_ENV !== "production";

const ReportMetaSchema = z.object({
  strategy: z
    .object({
      confidence_score: z.number().optional(),
      confidence_band: z.string().optional(),
      missing_signals: z.array(z.string()).optional(),
    })
    .optional(),
  strategy_plan: z
    .object({
      confidence: z
        .object({
          score: z.number().optional(),
          band: z.string().optional(),
          assumptions: z.array(z.string()).optional(),
        })
        .optional(),
      plan_days: z.array(z.any()).optional(),
      top_levers: z.array(z.any()).optional(),
      if_then_rules: z.array(z.any()).optional(),
    })
    .optional(),
  probes: z.array(z.any()).optional(),
  signal_quality: z
    .object({
      score: z.number().optional(),
      band: z.string().optional(),
      missing_signals: z.array(z.string()).optional(),
    })
    .optional(),
  primary_bottleneck: z.string().optional(),
  userId: z.string().optional(),
  attemptId: z.string().optional(),
});

const NextActionSchema = z.object({
  title: z.string().min(2).catch("Untitled action"),
  duration: z.string().optional().catch("~20 min"),
  expected_impact: z.string().optional().catch("Medium"),
  steps: z.array(z.string()).optional(),
});

const NormalizedReportSchema = z.object({
  summary: z.string().catch("No summary available yet."),
  patterns: z.array(z.any()).optional(),
  next_actions: z.array(NextActionSchema).default([]),
  probes: z.array(z.any()).optional(),
  plan: z
    .object({
      days: z.array(z.any()).optional(),
      levers: z.array(z.any()).optional(),
      rules: z.array(z.any()).optional(),
      assumptions: z.array(z.string()).optional(),
    })
    .optional(),
  confidence: z
    .object({
      score: z.number().optional(),
      band: z.string().optional(),
    })
    .optional(),
  signal_quality: z
    .object({
      score: z.number().optional(),
      band: z.string().optional(),
      missing_signals: z.array(z.string()).optional(),
    })
    .optional(),
  primary_bottleneck: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export type NormalizedReport = z.infer<typeof NormalizedReportSchema>;

function normalizeMissingSignals(meta: any) {
  return Array.isArray(meta?.strategy?.missing_signals)
    ? meta.strategy.missing_signals
    : Array.isArray(meta?.signal_quality?.missing_signals)
    ? meta.signal_quality.missing_signals
    : [];
}

function computeSignalQuality(meta: any) {
  const missingSignals = normalizeMissingSignals(meta);
  const totalSignals = 6;
  const missing = Math.min(totalSignals, missingSignals.length);
  const score = Math.max(0, Math.round(100 - (missing / totalSignals) * 100));
  const band = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
  return { score, band, missing_signals: missingSignals };
}

function pickPrimaryBottleneck(raw: any, meta: any) {
  const fromMeta = String(meta?.primary_bottleneck || "").trim();
  if (fromMeta) return fromMeta;
  const fromPatterns = Array.isArray(raw?.patterns) ? raw.patterns : [];
  const topTitle = String(fromPatterns?.[0]?.title || "").trim();
  return topTitle || null;
}

function actionTemplate(title: string, duration: string, expectedImpact: string, steps: string[]) {
  return {
    title,
    duration,
    expected_impact: expectedImpact,
    steps,
  } satisfies z.infer<typeof NextActionSchema>;
}

export function deriveFallbackActions(primaryBottleneck: string | null | undefined) {
  const bottleneck = String(primaryBottleneck || "").toLowerCase();

  if (bottleneck.includes("time") || bottleneck.includes("pace")) {
    return [
      actionTemplate("Run a 2-pass pacing drill", "25 min", "High", [
        "Set a 25-minute timer for one section.",
        "First pass: attempt only medium-easy questions.",
        "Second pass: return to flagged questions with remaining time.",
      ]),
      actionTemplate("Create a section time budget", "15 min", "Medium", [
        "Write the ideal time per section.",
        "Add a hard stop time for each section.",
        "Keep the budget visible during practice.",
      ]),
      actionTemplate("Practice deliberate skipping", "20 min", "Medium", [
        "Do a 10-question set.",
        "Skip any question that exceeds 90 seconds on first read.",
        "Review if the skips were good decisions.",
      ]),
    ];
  }

  if (bottleneck.includes("careless") || bottleneck.includes("silly")) {
    return [
      actionTemplate("Add a 20-second verification rule", "15 min", "High", [
        "Before submitting, check units/sign and one key constraint.",
        "Circle the value you will verify for each question.",
        "Log every miss that would have been caught by verification.",
      ]),
      actionTemplate("Run a calm accuracy set", "20 min", "Medium", [
        "Pick 12 medium-difficulty questions.",
        "Prioritize clean setup over speed.",
        "Stop and write why each wrong answer happened.",
      ]),
      actionTemplate("Create an error checklist", "10 min", "Medium", [
        "List your top 3 recurring mistakes.",
        "Turn each into a one-line rule.",
        "Read the checklist before every set.",
      ]),
    ];
  }

  if (bottleneck.includes("concept") || bottleneck.includes("fundamental")) {
    return [
      actionTemplate("Run a concept-rebuild block", "30 min", "High", [
        "Choose one weak topic.",
        "Review the core idea and 2 canonical examples.",
        "Solve 6 targeted problems immediately after review.",
      ]),
      actionTemplate("Make a 1-page formula sheet", "20 min", "Medium", [
        "Capture only the formulas you actually used today.",
        "Add one example trigger for each formula.",
        "Revisit the sheet before your next timed set.",
      ]),
      actionTemplate("Do a teach-back drill", "15 min", "Medium", [
        "Explain one tricky question out loud.",
        "Focus on why each step is valid.",
        "Write the 2 key cues you missed initially.",
      ]),
    ];
  }

  if (bottleneck.includes("anxiety") || bottleneck.includes("panic")) {
    return [
      actionTemplate("Run a pre-section reset", "8 min", "Medium", [
        "Take 3 slow breaths before each section.",
        "Write one line: 'Calm is fast.'",
        "Start with two confidence builders.",
      ]),
      actionTemplate("Practice a low-stakes timed set", "20 min", "Medium", [
        "Set a timer but remove score pressure.",
        "Focus on clean decisions, not attempts.",
        "Note the moment you start rushing and what triggered it.",
      ]),
      actionTemplate("Create an if-then recovery rule", "10 min", "High", [
        "If you feel stuck for 60 seconds, then skip immediately.",
        "If you rush, then slow down for the next 2 questions.",
        "Keep the rule visible while practicing.",
      ]),
    ];
  }

  return [
    actionTemplate("Run a focused accuracy sprint", "20 min", "High", [
      "Pick 15 questions from one topic.",
      "Aim for clean setup and decision-making.",
      "Review every miss and categorize the cause.",
    ]),
    actionTemplate("Create a next-mock rules card", "15 min", "Medium", [
      "Write 3 rules you will follow in the next mock.",
      "Include one pacing rule and one accuracy rule.",
      "Read the card immediately before starting.",
    ]),
    actionTemplate("Log 3 leverage insights", "10 min", "Medium", [
      "Write the top 3 things that would most improve your score.",
      "Turn each insight into a specific behavior.",
      "Track whether you executed it in your next session.",
    ]),
  ];
}

export function normalizeReport(rawReport: any) {
  const raw = rawReport && typeof rawReport === "object" ? rawReport : {};
  const metaCandidate = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const metaParsed = ReportMetaSchema.safeParse(metaCandidate);
  const meta = metaParsed.success ? metaParsed.data : metaCandidate;

  const strategyPlan = meta?.strategy_plan || raw?.strategy_plan || raw?.strategyPlan || {};
  const confidenceFromStrategy = meta?.strategy || {};
  const confidenceFromPlan = strategyPlan?.confidence || {};

  const confidenceScoreRaw =
    confidenceFromStrategy?.confidence_score ?? confidenceFromPlan?.score ?? raw?.confidence_score;
  const confidenceBandRaw =
    confidenceFromStrategy?.confidence_band ?? confidenceFromPlan?.band ?? raw?.confidence_band;

  const confidence = {
    score: Number.isFinite(Number(confidenceScoreRaw)) ? Number(confidenceScoreRaw) : undefined,
    band: confidenceBandRaw ? String(confidenceBandRaw) : undefined,
  };

  const signalQuality = meta?.signal_quality || computeSignalQuality(meta);

  const nextActionsSource =
    raw?.next_actions ?? raw?.nextActions ?? raw?.actions ?? meta?.next_actions ?? [];

  const nextActionsParsed = z.array(NextActionSchema).safeParse(nextActionsSource);
  const nextActions = nextActionsParsed.success ? nextActionsParsed.data : [];

  const primaryBottleneck = pickPrimaryBottleneck(raw, meta);

  const planDays = Array.isArray(strategyPlan?.plan_days)
    ? strategyPlan.plan_days
    : Array.isArray(strategyPlan?.days)
    ? strategyPlan.days
    : [];

  const normalized = NormalizedReportSchema.parse({
    ...raw,
    next_actions: nextActions,
    probes: raw?.probes ?? meta?.probes,
    plan: {
      days: planDays,
      levers: Array.isArray(strategyPlan?.top_levers) ? strategyPlan.top_levers : [],
      rules: Array.isArray(strategyPlan?.if_then_rules) ? strategyPlan.if_then_rules : [],
      assumptions: Array.isArray(strategyPlan?.confidence?.assumptions)
        ? strategyPlan.confidence.assumptions
        : [],
    },
    confidence,
    signal_quality: signalQuality,
    primary_bottleneck: primaryBottleneck || undefined,
    meta: {
      ...raw?.meta,
      strategy_plan: strategyPlan,
      signal_quality: signalQuality,
    },
  });

  if (DEV_LOG) {
    // minimal instrumentation for debugging identity/report gaps
    console.debug("[report.normalize]", {
      hasSummary: Boolean(normalized.summary),
      nextActionsCount: normalized.next_actions.length,
      primaryBottleneck: normalized.primary_bottleneck || null,
      confidenceScore: normalized.confidence?.score ?? null,
    });
  }

  return normalized;
}
