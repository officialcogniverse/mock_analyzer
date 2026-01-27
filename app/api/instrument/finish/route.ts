import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AnalyzeResponseSchema,
  createDefaultAnalyzeResponse,
  StateSnapshotSchema,
} from "@/lib/contracts";
import { generateNextActionsAndPlan } from "@/lib/engine";
import { normalizeEvent } from "@/lib/events/registry";
import { applyEventToState, createDefaultState } from "@/lib/state/envelope";
import { getUserState, logEvent, saveUserState } from "@/lib/state/persistence";
import { getOrCreateUserId } from "@/lib/state/user";
import type { InstrumentQuestionLog, InstrumentTemplate } from "@/lib/instrument/types";

export const runtime = "nodejs";

const TemplateSchema = z.object({
  sectionCount: z.coerce.number().int().min(1).max(6).default(1),
  questionsPerSection: z.coerce.number().int().min(1).max(120).default(20),
  totalTimeMin: z.coerce.number().int().min(1).max(300).default(60),
});

const QuestionSchema = z.object({
  sectionIndex: z.coerce.number().int().min(0).default(0),
  questionIndex: z.coerce.number().int().min(0).default(0),
  status: z.enum(["attempted", "skipped"]).default("attempted"),
  confidence: z.enum(["low", "med", "high"]).default("med"),
  correctness: z.enum(["correct", "incorrect", "unknown"]).default("unknown"),
  timeSpentSec: z.coerce.number().int().min(0).default(0),
  errorType: z.enum(["concept", "time", "careless", "selection", "unknown"]).default("unknown"),
  updatedAt: z.string().optional(),
});

const FinishSchema = z.object({
  attemptId: z.string().min(1),
  template: TemplateSchema,
  questions: z.union([z.array(QuestionSchema), z.record(QuestionSchema)]).optional(),
  timer: z
    .object({
      remainingSec: z.coerce.number().int().default(0),
      totalTimeSec: z.coerce.number().int().default(0),
    })
    .optional(),
});

function toSnapshot(state: ReturnType<typeof createDefaultState>) {
  return {
    userId: state.userId,
    version: state.version,
    signals: state.signals ?? {},
    facts: state.facts ?? {},
    lastUpdated: state.updatedAt,
  };
}

function stateFromSnapshot(snapshot: z.infer<typeof StateSnapshotSchema>, fallbackUserId: string) {
  const now = new Date().toISOString();
  return {
    userId: snapshot.userId || fallbackUserId,
    version: snapshot.version ?? 1,
    createdAt: snapshot.lastUpdated ?? now,
    updatedAt: snapshot.lastUpdated ?? now,
    signals: snapshot.signals ?? {},
    facts: snapshot.facts ?? {},
    preferences: {},
    history: {
      recentEventIds: [],
    },
  };
}

function normalizeQuestions(input: unknown): InstrumentQuestionLog[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : Object.values(input as Record<string, unknown>);
  return raw
    .map((entry) => {
      const parsed = QuestionSchema.safeParse(entry);
      if (!parsed.success) return null;
      return {
        ...parsed.data,
        updatedAt: parsed.data.updatedAt ?? new Date().toISOString(),
      } satisfies InstrumentQuestionLog;
    })
    .filter(Boolean) as InstrumentQuestionLog[];
}

function buildSummary(input: {
  template: InstrumentTemplate;
  questions: InstrumentQuestionLog[];
  timer?: { remainingSec: number; totalTimeSec: number };
}) {
  const totalQuestions = input.template.sectionCount * input.template.questionsPerSection;
  let attemptedCount = 0;
  let skippedCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unknownCount = 0;
  let totalSpentSec = 0;
  const errorCounts: Record<string, number> = {
    concept: 0,
    time: 0,
    careless: 0,
    selection: 0,
    unknown: 0,
  };

  for (const log of input.questions) {
    totalSpentSec += log.timeSpentSec ?? 0;
    if (log.status === "skipped") {
      skippedCount += 1;
    } else {
      attemptedCount += 1;
    }
    if (log.correctness === "correct") {
      correctCount += 1;
    } else if (log.correctness === "incorrect") {
      incorrectCount += 1;
      const errorType = log.errorType ?? "unknown";
      errorCounts[errorType] = (errorCounts[errorType] ?? 0) + 1;
    } else {
      unknownCount += 1;
    }
  }

  const avgPerAttemptedSec = attemptedCount ? totalSpentSec / attemptedCount : 0;
  const expectedAvgSec = totalQuestions ? (input.timer?.totalTimeSec ?? 0) / totalQuestions : 0;
  const timePressureProxy =
    (input.timer?.remainingSec ?? 0) < 0 ||
    (expectedAvgSec > 0 && avgPerAttemptedSec > expectedAvgSec * 1.25) ||
    ((input.timer?.totalTimeSec ?? 0) > 0 &&
      totalSpentSec > (input.timer?.totalTimeSec ?? 0) * 1.1);

  const dominantErrorType =
    Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .find(([, count]) => count > 0)?.[0] ?? "unknown";

  return {
    attemptedCount,
    skippedCount,
    correctCount,
    incorrectCount,
    unknownCount,
    totalQuestions,
    totalSpentSec,
    avgPerAttemptedSec: Math.round(avgPerAttemptedSec),
    errorCounts,
    dominantErrorType,
    timePressureProxy,
  };
}

function buildSummaryText(summary: ReturnType<typeof buildSummary>) {
  return `Instrumented attempt: ${summary.attemptedCount} attempted, ${summary.skippedCount} skipped, ${summary.correctCount} correct, ${summary.incorrectCount} incorrect, ${summary.unknownCount} unknown. Dominant error type: ${summary.dominantErrorType}. Avg time per attempted question: ${summary.avgPerAttemptedSec}s.`;
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = FinishSchema.safeParse(payload);

  if (!parsed.success) {
    const fallback = createDefaultAnalyzeResponse();
    return NextResponse.json(
      AnalyzeResponseSchema.parse({
        ...fallback,
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Invalid instrumented attempt payload." },
      }),
      { status: 400 }
    );
  }

  const userId = await getOrCreateUserId();
  const isAuthed = !userId.startsWith("anon_");
  const snapshotParsed = StateSnapshotSchema.safeParse(payload?.stateSnapshot);
  const fallbackState = createDefaultState(userId);
  const baseState =
    !isAuthed && snapshotParsed.success
      ? stateFromSnapshot(snapshotParsed.data, userId)
      : fallbackState;
  const state = isAuthed ? await getUserState(userId) : baseState;
  const template = parsed.data.template;
  const questions = normalizeQuestions(parsed.data.questions);
  const summary = buildSummary({
    template,
    questions,
    timer: parsed.data.timer,
  });

  const event = normalizeEvent(userId, {
    type: "instrument_finished",
    payload: {
      attemptId: parsed.data.attemptId,
      template,
      summary,
      dominantErrorType: summary.dominantErrorType,
      errorSignals: summary.errorCounts,
      timePressureProxy: summary.timePressureProxy,
    },
  });

  const nextState = applyEventToState(state, event);

  if (isAuthed) {
    await logEvent(event);
    await saveUserState(nextState);
  }

  const { nextBestActions, executionPlan } = await generateNextActionsAndPlan({
    state: nextState,
    inputSummary: buildSummaryText(summary),
    horizonDays: 7,
  });

  const response = AnalyzeResponseSchema.parse({
    ...createDefaultAnalyzeResponse({
      source: "text",
      extractedChars: 0,
      stateSnapshot: toSnapshot(nextState),
      horizonDays: 7,
    }),
    ok: true,
    error: null,
    nextBestActions,
    executionPlan,
    stateSnapshot: toSnapshot(nextState),
  });

  return NextResponse.json(response);
}
