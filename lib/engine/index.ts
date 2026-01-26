import { callOpenAiChat } from "@/lib/ai/openai";
import { AnalyzeRequestSchema, type IntakeAnswers } from "@/lib/engine/schemas";
import {
  createDefaultAnalyzeResponse,
  createDefaultBotResponse,
  ExecutionPlanSchema,
  type AnalyzeResponse,
  type BotResponse,
  type ExecutionPlan,
  type NextBestAction,
  NextBestActionSchema,
  type StateSnapshot,
  safeParseOrDefault,
} from "@/lib/contracts";
import { getUserState, logEvent, saveUserState } from "@/lib/state/persistence";
import { applyEventToState, type EventRecord, type UserState } from "@/lib/state/envelope";
import { normalizeEvent } from "@/lib/events/registry";

const DEFAULT_ACTIONS: NextBestAction[] = [
  {
    id: "accuracy-audit",
    title: "30-minute error audit",
    category: "academic",
    why: "Identify the top three mistakes that cost you the most marks.",
    instructions: {
      when: "Today, right after your next break",
      what: "Review your mock, label each error type, and write one fix per type.",
      durationMin: 30,
      stoppingCondition: "Stop after three clear fixes are written.",
      successCriteria: "You can name the top 3 patterns and a fix for each.",
      materials: ["Mock scorecard", "Notebook"],
      commonMistakeToAvoid: "Skipping the why behind each error.",
    },
    difficulty: "easy",
    estimatedImpact: "high",
  },
  {
    id: "pace-checkpoint",
    title: "Pacing checkpoint drill",
    category: "execution",
    why: "Build a repeatable rhythm to avoid rushing late sections.",
    instructions: {
      when: "Next practice block",
      what: "Run a 20-question timed set with a mid-way time checkpoint.",
      durationMin: 35,
      stoppingCondition: "Stop after reviewing 5 mistakes.",
      successCriteria: "You stay within the checkpoint window.",
      materials: ["Timer", "Question set"],
      commonMistakeToAvoid: "Continuing past the checkpoint even when behind.",
    },
    difficulty: "medium",
    estimatedImpact: "medium",
  },
  {
    id: "confidence-reset",
    title: "Confidence reset loop",
    category: "confidence",
    why: "Rebuild calm momentum with a clean, low-pressure rep.",
    instructions: {
      when: "Any evening block",
      what: "Attempt 12 easy questions, verifying each answer aloud.",
      durationMin: 25,
      stoppingCondition: "Stop after a perfect clean run or two small slips.",
      successCriteria: "You finish with 90%+ accuracy.",
      materials: ["Easy question set"],
    },
    difficulty: "easy",
    estimatedImpact: "medium",
  },
];

function createPlanFromActions(actions: NextBestAction[], horizonDays: 7 | 14): ExecutionPlan {
  const days = Array.from({ length: horizonDays }, (_, idx) => {
    const action = actions[idx % actions.length];
    return {
      day: idx + 1,
      theme: action.category === "confidence" ? "Confidence + calm" : "Accuracy + pacing",
      steps: [
        {
          id: `step-${action.id}-${idx + 1}`,
          title: action.title,
          timeboxMin: action.instructions.durationMin,
          instructions: action.instructions.what,
          successCriteria: action.instructions.successCriteria,
          linkToActionId: action.id,
        },
      ],
      totalMin: action.instructions.durationMin,
      confidenceNote: "Keep it slow and repeatable.",
    };
  });

  return {
    horizonDays,
    days,
  };
}

function toStateSnapshot(state: UserState): StateSnapshot {
  return {
    userId: state.userId,
    version: state.version,
    signals: state.signals ?? {},
    facts: state.facts ?? {},
    lastUpdated: state.updatedAt,
  };
}

function safeSummaryFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Mock summary unavailable yet.";
  const preview = trimmed.slice(0, 220);
  return `Mock data captured: ${preview}${trimmed.length > 220 ? "…" : ""}`;
}

async function callLlmJson(system: string, user: string): Promise<unknown | null> {
  try {
    const raw = await callOpenAiChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 1300,
      }
    );
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const json = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function buildFallbackActions(text: string): NextBestAction[] {
  if (text.length < 400) {
    return DEFAULT_ACTIONS.slice(0, 3);
  }
  return DEFAULT_ACTIONS;
}

export async function analyzeMockAndPlan(input: {
  userId: string;
  text: string;
  source: "pdf" | "text";
  intake?: IntakeAnswers;
  horizonDays?: 7 | 14;
  extractedChars?: number;
  scannedPdf?: boolean;
}): Promise<AnalyzeResponse> {
  const parsedRequest = AnalyzeRequestSchema.safeParse({
    intake: input.intake,
    source: input.source,
    text: input.text,
    horizonDays: input.horizonDays,
  });

  const state = await getUserState(input.userId);
  const requestId = `req_${Math.random().toString(36).slice(2, 10)}`;
  const horizonDays = input.horizonDays ?? 7;

  const fallback = createDefaultAnalyzeResponse({
    source: input.source,
    scannedPdf: input.scannedPdf,
    extractedChars: input.extractedChars,
    requestId,
    stateSnapshot: toStateSnapshot(state),
    horizonDays,
  });

  if (!parsedRequest.success) {
    return {
      ...fallback,
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Please check your input and try again.",
      },
    };
  }

  const actions = buildFallbackActions(input.text);
  const executionPlan = createPlanFromActions(actions, horizonDays);

  let nextState = state;
  const events: EventRecord[] = [];
  const mockEvent = normalizeEvent(input.userId, {
    type: "mock_analyzed",
    payload: {
      source: input.source,
      extractedChars: input.extractedChars ?? input.text.length,
      summary: safeSummaryFromText(input.text),
    },
  });
  events.push(mockEvent);

  const planEvent = normalizeEvent(input.userId, {
    type: "plan_generated",
    payload: { horizonDays, actionCount: actions.length },
  });
  events.push(planEvent);

  for (const event of events) {
    nextState = applyEventToState(nextState, event);
    await logEvent(event);
  }
  await saveUserState(nextState);

  let llmActions: NextBestAction[] | null = null;
  let llmPlan: ExecutionPlan | null = null;

  const llmPayload = await callLlmJson(
    "You are a calm study coach returning JSON only.",
    `Generate 5 next best actions and a ${horizonDays}-day plan for this mock summary.\n${input.text.slice(0, 1200)}`
  );

  if (llmPayload && typeof llmPayload === "object") {
    const maybeActions = (llmPayload as any).nextBestActions;
    const maybePlan = (llmPayload as any).executionPlan;
    if (Array.isArray(maybeActions)) {
      llmActions = safeParseOrDefault(
        NextBestActionSchema.array(),
        maybeActions,
        actions
      );
    }
    if (maybePlan && typeof maybePlan === "object") {
      llmPlan = safeParseOrDefault(ExecutionPlanSchema, maybePlan, executionPlan);
    }
  }

  return {
    ...fallback,
    ok: true,
    error: null,
    meta: {
      ...fallback.meta,
      extractedChars: input.extractedChars ?? input.text.length,
      scannedPdf: input.scannedPdf ?? false,
    },
    nextBestActions: llmActions ?? actions,
    executionPlan: llmPlan ?? executionPlan,
    stateSnapshot: toStateSnapshot(nextState),
  };
}

export async function respondBot(input: {
  userId: string;
  message: string;
}): Promise<BotResponse> {
  const state = await getUserState(input.userId);
  const fallback = createDefaultBotResponse(toStateSnapshot(state));

  const llmPayload = await callLlmJson(
    "You are a calm, supportive execution companion.",
    `State: ${JSON.stringify({ signals: state.signals, facts: state.facts })}\nUser: ${input.message}\nReturn JSON with message and directives array.`
  );

  let message = "I’m here with you. Tell me what feels most urgent right now.";
  let directives: BotResponse["directives"] = [];

  if (llmPayload && typeof llmPayload === "object") {
    const maybeMessage = (llmPayload as any).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      message = maybeMessage;
    }
    if (Array.isArray((llmPayload as any).directives)) {
      directives = (llmPayload as any).directives as BotResponse["directives"];
    }
  }

  const chatEvent = normalizeEvent(input.userId, {
    type: "chat_message",
    payload: { role: "user", content: input.message },
  });

  const nextState = applyEventToState(state, chatEvent);
  await logEvent(chatEvent);
  await saveUserState(nextState);

  return {
    ...fallback,
    ok: true,
    message,
    directives,
    stateSnapshot: toStateSnapshot(nextState),
    error: null,
  };
}

export function generatePlanFromState(state: UserState): ExecutionPlan {
  const actions = buildFallbackActions(JSON.stringify(state.facts ?? {}));
  return createPlanFromActions(actions, 7);
}
