import { NextResponse } from "next/server";
import { analyzeMock } from "@/lib/analyzer";
import { extractTextFromPdf } from "@/lib/extractText";
import { detectExamFromText } from "@/lib/examDetect";
import { normalizeExam } from "@/lib/exams";
import type { Intake } from "@/lib/types";
import {
  upsertUser,
  saveAttempt,
  saveStrategyMemorySnapshot,
  updateUserLearningStateFromReport,
  getLatestAttemptForExam,
  updateAttemptIdentity,
  getAttemptForUser,
  getUser,
  getUserProfileSignals,
  computePlanDaysFromProfile,
  listAttemptsForInsights,
} from "@/lib/persist";
import { analyzeViaPython } from "@/lib/pythonClient";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { extractTextFromImages } from "@/lib/extractTextFromImages";
import { fireAndForgetEvent } from "@/lib/events";
import { z } from "zod";
import { normalizeReport } from "@/lib/report";
import { buildAttemptBundle } from "@/lib/domain/mappers";
import type { AnalyzeInput } from "@/lib/types";

const intakeSchema = z
  .object({
    goal: z.enum(["score", "accuracy", "speed", "concepts"]),
    hardest: z.enum([
      "selection",
      "time",
      "concepts",
      "careless",
      "anxiety",
      "consistency",
    ]),
    weekly_hours: z.enum(["<10", "10-20", "20-35", "35+"])
      .optional()
      .default("<10"),
    section: z.string().optional(),

    // optional boosters (asked only when missing signals)
    next_mock_days: z.enum(["3", "7", "14", "21", "30+"]).optional(),
    next_mock_date: z.string().optional(),
    runs_out_of_time: z.enum(["yes", "no"]).optional(),
    tukka_level: z.enum(["low", "medium", "high"]).optional(),
    chaotic_section: z.string().optional(),
    daily_minutes: z.string().optional(),
    preferred_topics: z.string().optional(),
  })
  .passthrough();

const DEV_LOG = process.env.NODE_ENV !== "production";

function normalizeTextFromManual(manual?: Record<string, string>) {
  if (!manual) return "";
  const lines: string[] = [];
  Object.entries(manual).forEach(([key, value]) => {
    if (!value) return;
    lines.push(`${key}: ${value}`);
  });
  return lines.join("\n");
}

function computeFocusXP(reportObj: any) {
  const patterns = Array.isArray(reportObj?.patterns) ? reportObj.patterns : [];
  const raw = patterns.length * 12;
  return Math.min(100, Math.max(0, raw));
}

function unwrapReport(maybe: any) {
  if (maybe && typeof maybe === "object" && maybe.report && typeof maybe.report === "object") {
    return maybe.report;
  }
  return maybe;
}

type ConfidenceBand = "high" | "medium" | "low";

type NextQuestion = {
  id: string;
  question: string;
  type: "single" | "text";
  options?: string[];
  unlocks: string[];
};

function pickMax4<T>(arr: T[]) {
  return arr.slice(0, 4);
}

function computeSignalScaffold(params: {
  intake: Intake;
  report: any;
  profile: ReturnType<typeof getUserProfileSignals>;
  planDays: number;
}) {
  const { intake, report, profile, planDays } = params;
  const hasPatterns = Array.isArray(report?.patterns) && report.patterns.length > 0;
  const hasActions = Array.isArray(report?.next_actions) && report.next_actions.length > 0;
  const hasPlan = Array.isArray(report?.plan?.days) && report.plan.days.length > 0;
  const hasProbes = Array.isArray(report?.probes) && report.probes.length > 0;

  const hasTimeline = Boolean(intake?.next_mock_date || profile?.nextMockDate);
  const hasDailyMinutes = Boolean(intake?.daily_minutes || profile?.dailyStudyMinutes);
  const hasStruggle = Boolean(profile?.biggestStruggle || intake?.hardest);
  const hasPlanLength = planDays >= 3;

  let score = 0;
  if (hasPatterns) score += 20;
  if (hasActions) score += 20;
  if (hasPlan) score += 15;
  if (hasProbes) score += 10;
  if (hasTimeline) score += 15;
  if (hasDailyMinutes) score += 10;
  if (hasStruggle) score += 10;

  score = Math.max(0, Math.min(100, score));

  let band: ConfidenceBand = "low";
  if (score >= 70) band = "high";
  else if (score >= 45) band = "medium";

  const missing: string[] = [];
  if (!hasTimeline) missing.push("next_mock_timeline");
  if (!hasDailyMinutes) missing.push("daily_minutes");
  if (!hasStruggle) missing.push("biggest_struggle");

  const assumptions: string[] = [];
  if (!hasTimeline) {
    assumptions.push("Next mock date missing; plan assumes a 7-day cadence.");
  }
  if (!hasDailyMinutes) {
    assumptions.push("Daily study minutes missing; plan assumes ~60 minutes/day.");
  }

  const questions: NextQuestion[] = [];

  if (!hasTimeline) {
    questions.push({
      id: "next_mock_date",
      question: "When is your next mock (approx date)?",
      type: "text",
      unlocks: ["plan_length", "intensity"],
    });
  }

  if (!hasDailyMinutes) {
    questions.push({
      id: "daily_minutes",
      question: "How many minutes can you study daily this week?",
      type: "text",
      unlocks: ["daily_load"],
    });
  }

  if (!hasStruggle) {
    questions.push({
      id: "biggest_struggle",
      question: "What hurts the most right now?",
      type: "single",
      options: ["Time pressure", "Accuracy drops", "Concept gaps", "Panic/tilt"],
      unlocks: ["primary_bottleneck"],
    });
  }

  return {
    confidence_score: score,
    confidence_band: band,
    missing_signals: missing,
    assumptions,
    next_questions: pickMax4(questions),
    hasPlanLength,
  };
}

function computePlanDays(params: {
  intake: Intake;
  profile: ReturnType<typeof getUserProfileSignals>;
}) {
  const { intake, profile } = params;
  const fromProfile = computePlanDaysFromProfile(profile);
  if (fromProfile) return fromProfile;

  if (intake?.next_mock_date) {
    const date = new Date(intake.next_mock_date);
    if (!Number.isNaN(date.getTime())) {
      const diffMs = date.getTime() - Date.now();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (Number.isFinite(diffDays)) return Math.max(3, Math.min(14, diffDays));
    }
  }

  if (intake?.next_mock_days) {
    const parsed = Number(String(intake.next_mock_days).replace(/[^0-9]/g, ""));
    if (Number.isFinite(parsed)) return Math.max(3, Math.min(14, parsed));
  }

  return 7;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json(
      { error: "Institute sessions cannot upload attempts." },
      { status: 403 }
    );
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }
  try {
    const contentType = req.headers.get("content-type") || "";

    let exam: string | null = null;
    let intake: Intake;
    let text = "";
    let manualText = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      const examRaw = String(form.get("exam") || "");
      const normalizedExam = normalizeExam(examRaw);
      exam = normalizedExam;

      const intakeRaw = JSON.parse(String(form.get("intake") || "{}"));
      const parsedIntake = intakeSchema.safeParse(intakeRaw);
      if (!parsedIntake.success) {
        const res = NextResponse.json({ error: "Invalid intake." }, { status: 400 });
        if (session.isNew) attachSessionCookie(res, session);
        return res;
      }
      intake = parsedIntake.data as Intake;

      const legacyFile = form.get("file");
      const imageFiles = form.getAll("images") as File[];
      const uploadedFiles = form.getAll("files") as File[];
      const allFiles = [
        ...(legacyFile instanceof File ? [legacyFile] : []),
        ...uploadedFiles,
        ...imageFiles,
      ];

      if (allFiles.length) {
        const pdfFiles = allFiles.filter((file) => file.type === "application/pdf");
        const imagePayload = await Promise.all(
          allFiles
            .filter((file) => file.type !== "application/pdf")
            .map(async (file) => ({
              mime: file.type || "image/png",
              data: Buffer.from(await file.arrayBuffer()),
            }))
        );

        const pdfText = (
          await Promise.all(
            pdfFiles.map(async (file) => {
              const buf = Buffer.from(await file.arrayBuffer());
              return extractTextFromPdf(buf);
            })
          )
        )
          .filter(Boolean)
          .join("\n\n");

        const imageText = imagePayload.length ? await extractTextFromImages(imagePayload) : "";
        text = [pdfText, imageText].filter(Boolean).join("\n\n").trim();
      }

      const manualRaw = form.get("manual");
      if (manualRaw) {
        try {
          const manualObj = JSON.parse(String(manualRaw));
          manualText = normalizeTextFromManual(manualObj);
        } catch {
          manualText = String(manualRaw || "");
        }
      }
    } else {
      const body = await req.json();
      exam = normalizeExam(body.exam || null);
      const parsedIntake = intakeSchema.safeParse(body.intake || {});
      if (!parsedIntake.success) {
        const res = NextResponse.json({ error: "Invalid intake." }, { status: 400 });
        if (session.isNew) attachSessionCookie(res, session);
        return res;
      }
      intake = parsedIntake.data as Intake;
      text = String(body.text || "").trim();
      manualText = normalizeTextFromManual(body.manual || undefined);
    }

    const examLabel = exam || "GENERIC";

    if (!text || text.trim().length < 10) {
      text = manualText || "Manual entry only. No scorecard text provided.";
    }

    await upsertUser(session.userId);
    const user = await getUser(session.userId);
    const profileSignals = getUserProfileSignals(user);
    const planDays = computePlanDays({ intake, profile: profileSignals });

    const historySignals = await listAttemptsForInsights(session.userId, examLabel, 6);

    const detected = detectExamFromText(text);

    const usePython = process.env.ANALYZER_BACKEND === "python";

    const analyzeInput: AnalyzeInput = {
      exam: examLabel,
      intake,
      text,
      context: {
        profile: profileSignals || undefined,
        history: historySignals,
        plan_days: planDays,
      },
    };

    const rawOut = usePython
      ? await analyzeViaPython(analyzeInput)
      : await analyzeMock(analyzeInput);

    if (DEV_LOG) {
      console.debug("[api.analyze] raw analyzer output", {
        keys: rawOut && typeof rawOut === "object" ? Object.keys(rawOut) : [],
        nextActions: Array.isArray(rawOut?.next_actions) ? rawOut.next_actions.length : 0,
        probes: Array.isArray(rawOut?.probes) ? rawOut.probes.length : 0,
      });
    }

    const nowIso = new Date().toISOString();
    const normalized = normalizeReport(unwrapReport(rawOut), {
      userId: session.userId,
      createdAt: nowIso,
      planDays,
      profile: profileSignals || undefined,
      history: historySignals,
    });

    const focusXP = computeFocusXP(normalized);
    normalized.meta = normalized.meta || {};
    normalized.meta.focusXP = focusXP;
    normalized.meta.userExam = examLabel;
    normalized.meta.detectedExam = detected || null;
    normalized.meta.generatedAt = nowIso;
    normalized.meta.analyzer_backend = usePython ? "python" : "ts";
    normalized.meta.userId = session.userId;

    const scaffold = computeSignalScaffold({
      intake,
      report: normalized,
      profile: profileSignals,
      planDays,
    });
    normalized.meta.strategy = {
      confidence_score: scaffold.confidence_score,
      confidence_band: scaffold.confidence_band,
      missing_signals: scaffold.missing_signals,
      assumptions: scaffold.assumptions,
      next_questions: scaffold.next_questions,
    };

    if (!Array.isArray(normalized.followups) || normalized.followups.length === 0) {
      normalized.followups = scaffold.next_questions.map((question) => ({
        id: question.id,
        question: question.question,
        type: question.type,
        options: question.options,
      }));
    }

    const previousAttempt = await getLatestAttemptForExam({
      userId: session.userId,
      exam: examLabel,
    });

    const attemptId = await saveAttempt({
      userId: session.userId,
      exam: examLabel,
      intake,
      rawText: text,
      report: normalized,
    });

    await updateAttemptIdentity({ attemptId, userId: session.userId });

    const savedAttempt = await getAttemptForUser({
      attemptId,
      userId: session.userId,
      backfillMissingUserId: true,
    });

    if (DEV_LOG) {
      console.debug("[api.analyze] normalized report", {
        planDays,
        signalQuality: normalized.signal_quality,
        nextActionsCount: normalized.next_actions.length,
        probesCount: normalized.probes.length,
      });
      console.debug("[api.analyze] saved attempt report keys", {
        attemptId,
        keys:
          savedAttempt?.report && typeof savedAttempt.report === "object"
            ? Object.keys(savedAttempt.report)
            : [],
      });
    }

    fireAndForgetEvent({
      userId: session.userId,
      payload: {
        event_name: "attempt_uploaded",
        attempt_id: attemptId,
        metadata: {
          exam: examLabel,
          hasFiles: contentType.includes("multipart/form-data"),
          hasManualSignals: Boolean(manualText),
        },
      },
    });

    const strategyMeta = (normalized?.meta?.strategy || {}) as any;

    fireAndForgetEvent({
      userId: session.userId,
      payload: {
        event_name: "report_generated",
        attempt_id: attemptId,
        metadata: {
          exam: examLabel,
          confidence_band: strategyMeta?.confidence_band ?? null,
          confidence_score: strategyMeta?.confidence_score ?? null,
        },
      },
    });

    if (previousAttempt?._id) {
      fireAndForgetEvent({
        userId: session.userId,
        payload: {
          event_name: "next_attempt_uploaded",
          attempt_id: attemptId,
          metadata: {
            exam: examLabel,
            previous_attempt_id: previousAttempt._id.toString(),
          },
        },
      });
    }

    try {
      const strategyPlan = normalized?.meta?.strategy_plan;
      if (strategyPlan) {
        await saveStrategyMemorySnapshot({
          userId: session.userId,
          exam: examLabel,
          attemptId,
          strategyPlan,
        });
      }
    } catch (error) {
      console.warn("[api.analyze] strategy snapshot failed", error);
    }

    try {
      await updateUserLearningStateFromReport({
        userId: session.userId,
        exam: examLabel,
        attemptId,
        report: normalized,
      });
    } catch (error) {
      console.warn("[api.analyze] learning state update failed", error);
    }

    const bundle = savedAttempt
      ? buildAttemptBundle({ doc: savedAttempt, fallbackUserId: session.userId, user })
      : null;

    const res = NextResponse.json({
      id: attemptId,
      attemptId,
      attempt: bundle?.attempt ?? null,
      bundle,
    });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  } catch (err: any) {
    console.error("/api/analyze error", err);
    const res = NextResponse.json({ error: err?.message || "Analysis failed." }, { status: 500 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }
}
