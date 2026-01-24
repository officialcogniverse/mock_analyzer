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
} from "@/lib/persist";
import { analyzeViaPython } from "@/lib/pythonClient";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { extractTextFromImages } from "@/lib/extractTextFromImages";
import { fireAndForgetEvent } from "@/lib/events";
import { z } from "zod";

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

    // ✅ optional boosters (asked only when missing signals)
    next_mock_days: z.enum(["3", "7", "14", "21", "30+"]).optional(),
    next_mock_date: z.string().optional(),
    runs_out_of_time: z.enum(["yes", "no"]).optional(),
    tukka_level: z.enum(["low", "medium", "high"]).optional(),
    chaotic_section: z.string().optional(),
    daily_minutes: z.string().optional(),
    preferred_topics: z.string().optional(),
  })
  .strict();

function normalizeTextFromManual(manual?: Record<string, string>) {
  if (!manual) return "";
  const lines: string[] = [];
  Object.entries(manual).forEach(([key, value]) => {
    if (!value) return;
    lines.push(`${key}: ${value}`);
  });
  return lines.join("\n");
}

// ✅ helper: compute focusXP consistently
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

/**
 * ========= Adaptive Strategy Scaffolding (exam-agnostic) =========
 */

type ConfidenceBand = "high" | "medium" | "low";

type NextQuestion = {
  id: string;
  question: string;
  type: "boolean" | "single_select" | "text";
  options?: string[];
  unlocks: string[];
};

function pickMax4<T>(arr: T[]) {
  return arr.slice(0, 4);
}

function computeSignalScaffold({
  intake,
  report,
}: {
  intake: any;
  report: any;
}): {
  confidence_score: number;
  confidence_band: ConfidenceBand;
  missing_signals: string[];
  assumptions: string[];
  next_questions: NextQuestion[];
} {
  const hasMetrics = Array.isArray(report?.facts?.metrics) && report.facts.metrics.length > 0;
  const hasPatterns = Array.isArray(report?.patterns) && report.patterns.length > 0;
  const hasActions = Array.isArray(report?.next_actions) && report.next_actions.length > 0;

  const hasTimeline =
    typeof intake?.next_mock_date === "string" ||
    typeof intake?.next_mock_days === "string";

  const hasDailyMinutes = typeof intake?.daily_minutes === "string";

  const hasStruggle = typeof intake?.hardest === "string";

  const hasTimePressureProxy =
    intake?.runs_out_of_time ||
    String(intake?.hardest || "") === "time" ||
    report?.summary?.toLowerCase?.().includes("time");

  let score = 0;
  if (hasMetrics) score += 30;
  if (hasPatterns) score += 20;
  if (hasActions) score += 15;
  if (hasTimeline) score += 15;
  if (hasDailyMinutes) score += 10;
  if (hasStruggle) score += 10;

  score = Math.max(0, Math.min(100, score));

  let band: ConfidenceBand = "low";
  if (score >= 70) band = "high";
  else if (score >= 45) band = "medium";

  const missing: string[] = [];
  if (!hasMetrics) missing.push("key_metrics");
  if (!hasPatterns) missing.push("execution_patterns");
  if (!hasTimeline) missing.push("next_mock_timeline");
  if (!hasDailyMinutes) missing.push("daily_minutes");
  if (!hasStruggle) missing.push("biggest_struggle");
  if (!hasTimePressureProxy) missing.push("time_pressure");

  const assumptions: string[] = [];
  if (!hasTimeline) {
    assumptions.push(
      "Next mock date is unknown; plan assumes a 7-day cadence unless you set a date."
    );
  }
  if (!hasDailyMinutes) {
    assumptions.push(
      "Daily study minutes are unknown; plan assumes 45–60 minutes/day baseline."
    );
  }
  if (!hasTimePressureProxy) {
    assumptions.push(
      "Time pressure is unknown; strategy will include pacing rules that work even if timing is usually okay."
    );
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
      question: "How many minutes can you study per day?",
      type: "text",
      unlocks: ["daily_load"],
    });
  }

  if (!hasStruggle) {
    questions.push({
      id: "hardest",
      question: "Biggest struggle right now?",
      type: "single_select",
      options: ["time", "accuracy", "concepts", "anxiety", "consistency"],
      unlocks: ["primary_bottleneck"],
    });
  }

  if (!hasTimePressureProxy) {
    questions.push({
      id: "runs_out_of_time",
      question: "Do you usually run out of time?",
      type: "single_select",
      options: ["yes", "no"],
      unlocks: ["pacing_strategy"],
    });
  }

  return {
    confidence_score: score,
    confidence_band: band,
    missing_signals: missing,
    assumptions,
    next_questions: pickMax4(questions),
  };
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
        const res = NextResponse.json({ error: "Invalid intake data." }, { status: 400 });
        if (session.isNew) attachSessionCookie(res, session);
        return res;
      }
      intake = parsedIntake.data as any;

      const pasted = String(form.get("text") || "").trim();
      const manualRaw = String(form.get("manual") || "");
      manualText = normalizeTextFromManual(
        manualRaw ? (JSON.parse(manualRaw) as Record<string, string>) : undefined
      );

      const files = form.getAll("files").filter(Boolean) as File[];

      if (pasted) text = pasted;

      if (!text && files.length) {
        const pdfs = files.filter((file) => file.type === "application/pdf");
        const images = files.filter((file) => file.type.startsWith("image/"));

        for (const pdf of pdfs) {
          try {
            const buf = Buffer.from(await pdf.arrayBuffer());
            const extracted = await extractTextFromPdf(buf);
            if (extracted && extracted.trim().length > 10) {
              text += `${extracted}\n`;
            }
          } catch (e: any) {
            console.error("PDF parse failed:", e?.message ?? e);
          }
        }

        if (images.length) {
          try {
            const imagePayloads = await Promise.all(
              images.map(async (image) => ({
                mime: image.type,
                data: Buffer.from(await image.arrayBuffer()),
              }))
            );
            const imageText = await extractTextFromImages(imagePayloads);
            if (imageText) text += `${imageText}\n`;
          } catch (e: any) {
            console.error("Image parse failed:", e?.message ?? e);
          }
        }
      }
    } else {
      const body = await req.json();
      const normalizedExam = normalizeExam(body.exam);
      exam = normalizedExam;

      const parsedIntake = intakeSchema.safeParse(body.intake);
      if (!parsedIntake.success) {
        const res = NextResponse.json({ error: "Invalid intake data." }, { status: 400 });
        if (session.isNew) attachSessionCookie(res, session);
        return res;
      }
      intake = parsedIntake.data as any;
      text = String(body.text || "").trim();
      manualText = normalizeTextFromManual(body.manual || undefined);
    }

    const examLabel = exam || "GENERIC";

    if (!text || text.trim().length < 10) {
      text = manualText || "Manual entry only. No scorecard text provided.";
    }

    // ✅ ensure user exists
    await upsertUser(session.userId);

    const detected = detectExamFromText(text);

    const usePython = process.env.ANALYZER_BACKEND === "python";

    const rawOut = usePython
      ? await analyzeViaPython({ exam: examLabel, intake, text })
      : await analyzeMock({ exam: examLabel, intake, text });

    const report = unwrapReport(rawOut);

    const focusXP = computeFocusXP(report);
    report.meta = report.meta || {};
    report.meta.focusXP = focusXP;
    report.meta.userExam = examLabel;
    report.meta.detectedExam = detected || null;
    report.meta.generatedAt = new Date().toISOString();
    report.meta.analyzer_backend = usePython ? "python" : "ts";

    const scaffold = computeSignalScaffold({ intake, report });
    report.meta.strategy = {
      confidence_score: scaffold.confidence_score,
      confidence_band: scaffold.confidence_band,
      missing_signals: scaffold.missing_signals,
      assumptions: scaffold.assumptions,
      next_questions: scaffold.next_questions,
    };

    if (!Array.isArray(report.followups) || report.followups.length === 0) {
      report.followups = scaffold.next_questions.map((question) => ({
        id: question.id,
        question: question.question,
        type: question.type,
        options: question.options,
        reason: `Missing signal: ${question.unlocks.join(", ")}`,
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
      report,
    });

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

    fireAndForgetEvent({
      userId: session.userId,
      payload: {
        event_name: "report_generated",
        attempt_id: attemptId,
        metadata: {
          exam: examLabel,
          confidence_band: report?.meta?.strategy?.confidence_band,
          confidence_score: report?.meta?.strategy?.confidence_score,
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
      const strategyPlan = report?.meta?.strategy_plan;
      if (strategyPlan) {
        await saveStrategyMemorySnapshot({
          userId: session.userId,
          exam: examLabel,
          attemptId,
          strategyPlan,
        });
      }
    } catch (e: any) {
      console.warn("Strategy memory snapshot failed:", e?.message ?? e);
    }

    try {
      await updateUserLearningStateFromReport({
        userId: session.userId,
        exam: examLabel,
        report,
        attemptId,
      });
    } catch (e: any) {
      console.warn("User learning state update failed:", e?.message ?? e);
    }

    const res = NextResponse.json({ id: attemptId });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  } catch (e: any) {
    console.error("Analyze API failed:", e?.message ?? e);
    const res = NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }
}
