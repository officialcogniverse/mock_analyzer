import type { AnalyzeInput } from "./types";

function safeJson(x: any, max = 5000) {
  let s = "";
  try {
    s = typeof x === "string" ? x : JSON.stringify(x ?? {});
  } catch {
    s = String(x ?? "");
  }
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeIntake(intake: any) {
  if (!intake || typeof intake !== "object") return {};
  const keep = [
    "goal",
    "hardest",
    "weekly_hours",
    "section",
    "next_mock_days",
    "next_mock_date",
    "daily_minutes",
    "preferred_topics",
    "runs_out_of_time",
    "tukka_level",
  ];
  const out: any = {};
  for (const k of keep) if (k in intake) out[k] = intake[k];
  return out;
}

function normalizeContext(context: AnalyzeInput["context"]) {
  if (!context) return {};
  return {
    profile: context.profile || null,
    history: Array.isArray(context.history) ? context.history.slice(0, 6) : [],
    plan_days: context.plan_days ?? null,
  };
}

export function buildPrompt(input: AnalyzeInput): string {
  const { exam, intake, text, context } = input;
  const intakeCompact = normalizeIntake(intake);
  const contextCompact = normalizeContext(context);
  const planDays = Number(contextCompact.plan_days || 0) || 7;

  return `
ROLE:
You are Cogniverse Mock Analyzer — an elite exam performance coach.
You produce personalized, execution-safe reports for competitive-exam students.

PRIMARY OBJECTIVE:
Maximize expected score uplift in the NEXT mock while keeping advice resilient to missing data.

REPORT CONTRACT (MUST FOLLOW):
Return VALID JSON matching this structure and key names exactly:
{
  "signal_quality": "low|medium|high",
  "confidence": number 0-100,
  "primary_bottleneck": string,
  "summary": string,
  "patterns": [
    {"title","evidence","impact","fix","severity"}
  ],
  "next_actions": [
    {"title","why","duration_min","difficulty","steps","success_metric"}
  ],
  "plan": {
    "days": [
      {"day_index","label","focus","tasks":[{"action_id?","title","duration_min","note?"}]}
    ]
  },
  "probes": [
    {"title","duration_min","instructions","success_check"}
  ],
  "next_mock_strategy": {
    "rules": string[],
    "time_checkpoints": string[],
    "skip_policy": string[]
  },
  "overall_exam_strategy": {
    "weekly_rhythm": string[],
    "revision_loop": string[],
    "mock_schedule": string[]
  },
  "followups": [
    {"id","question","type":"single|text","options?"}
  ]
}

NON-NEGOTIABLE CONTENT RULES:
1) Coach-style summary:
- 1 short paragraph.
- Mention primary bottleneck and what to do next.
- If data is thin, explicitly say signal quality is low but still give a baseline plan.

2) Patterns:
- Max 6 patterns.
- Each must cite evidence from SOURCE TEXT or clearly reference missing data.
- severity must be 1-5.

3) Next actions:
- Max 3 actions.
- Each must be decision-level and verifiable in the next mock.
- duration_min must be realistic (10-90).
- steps must be specific, not generic.

4) Day-wise plan:
- Generate EXACTLY ${planDays} days.
- Balance intensity based on plan_days and daily minutes if provided.
- Tasks should map to next_actions when possible via action_id.

5) Probe pack:
- Provide 3-5 probes.
- Each probe validates whether the bottleneck is improving.

6) Strategies:
- next_mock_strategy must include rules, time checkpoints, and skip policy.
- overall_exam_strategy must include weekly cadence, revision loop, and mock schedule.
- Use history signals if present to show learning across attempts.

7) Missing data resilience:
- Never leave sections empty.
- If signal_quality is low, include 2-4 followups but still return full actions, plan, probes, and strategies.

ANTI-GENERIC FILTER:
Disallow vague advice like “revise more” or “practice more” unless turned into a mechanism.

TRACEABILITY:
- Any number taken from the scorecard must appear in SOURCE TEXT.
- If you need numbers for planning, use safe defaults without pretending they came from the scorecard.

STUDENT CONTEXT (INTAKE):
${safeJson(intakeCompact, 2500)}

PROFILE + HISTORY CONTEXT:
${safeJson(contextCompact, 2500)}

EXAM METADATA (if known):
${String(exam || "Unknown")}

SOURCE TEXT (ONLY SOURCE OF TRUTH FOR FACTS):
"""
${String(text ?? "")}
"""

Return ONLY valid JSON.
`.trim();
}
