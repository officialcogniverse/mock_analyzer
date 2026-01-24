import { NextResponse } from "next/server";
import { analyzeMock } from "@/lib/analyzer";
import { extractTextFromPdf } from "@/lib/extractText";
import { detectExamFromText } from "@/lib/examDetect";
import { normalizeExam } from "@/lib/exams";
import { normalizeSectionBreakdown } from "@/lib/examSections";
import type { Exam, Intake } from "@/lib/types";
import {
  upsertUser,
  saveAttempt,
  saveStrategyMemorySnapshot,
  updateUserLearningStateFromReport,
} from "@/lib/persist";
import { analyzeViaPython } from "@/lib/pythonClient";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";
import { z } from "zod";

/**
 * Adaptive intake additions:
 * - These are OPTIONAL booster fields that help us sharpen strategy when scorecard is thin.
 * - Keeping schema strict but allowing these fields prevents "Invalid intake data" crashes.
 */
const intakeSchema = z
  .object({
    goal: z.enum(["score", "accuracy", "speed", "concepts"]),
    hardest: z.enum(["selection", "time", "concepts", "careless", "anxiety"]),
    weekly_hours: z.enum(["<10", "10-20", "20-35", "35+"]),
    section: z.string().optional(),

    // ✅ optional boosters (asked only when missing signals)
    next_mock_days: z.enum(["3", "7", "14", "21", "30+"]).optional(),
    runs_out_of_time: z.enum(["yes", "no"]).optional(),
    tukka_level: z.enum(["low", "medium", "high"]).optional(),
    chaotic_section: z.string().optional(),
  })
  .strict();

// ✅ helper: compute focusXP consistently
function computeFocusXP(reportObj: any) {
  const weaknesses = Array.isArray(reportObj?.weaknesses) ? reportObj.weaknesses : [];
  const raw = weaknesses.reduce(
    (sum: number, w: any) => sum + (Number(w?.severity) || 0) * 10,
    0
  );
  return Math.min(100, Math.max(0, raw));
}

// ✅ helper: unwrap python response if it returns { report: {...} }
function unwrapReport(maybe: any) {
  if (maybe && typeof maybe === "object" && maybe.report && typeof maybe.report === "object") {
    return maybe.report;
  }
  return maybe;
}

/**
 * ========= Adaptive Strategy Scaffolding (exam-agnostic) =========
 * We compute a signal coverage score and ask only the highest ROI questions.
 * This does NOT block output — it only improves strategy confidence.
 */

type ConfidenceBand = "high" | "medium" | "low";

type NextQuestion = {
  id: string;
  question: string;
  type: "boolean" | "single_select" | "text";
  options?: string[];
  unlocks: string[];
};

function hasNumber(x: any) {
  return typeof x === "number" && Number.isFinite(x);
}

function pickMax2<T>(arr: T[]) {
  return arr.slice(0, 2);
}

function computeSignalScaffold({
  exam,
  intake,
  report,
}: {
  exam: Exam;
  intake: any;
  report: any;
}): {
  confidence_score: number;
  confidence_band: ConfidenceBand;
  missing_signals: string[];
  assumptions: string[];
  next_questions: NextQuestion[];
} {
  // Scorecard-derived (likely available)
  const hasSectionTable =
    Array.isArray(report?.sections) ||
    Array.isArray(report?.section_breakdown) ||
    Array.isArray(report?.sectionWise) ||
    (typeof report?.physics === "object" && typeof report?.chemistry === "object") ||
    (typeof report?.maths === "object" || typeof report?.mathematics === "object");

  const hasAttempts =
    hasNumber(report?.attempted) ||
    hasNumber(report?.correct) ||
    hasNumber(report?.incorrect) ||
    hasNumber(report?.accuracy) ||
    hasNumber(report?.accuracy_pct) ||
    hasNumber(report?.percentile);

  const hasTotalMarks =
    hasNumber(report?.total_marks) ||
    hasNumber(report?.marks) ||
    typeof report?.total === "string" ||
    typeof report?.total_marks_str === "string" ||
    typeof report?.summary?.total_marks === "string";

  const hasWeaknessClusters =
    Array.isArray(report?.weaknesses) ||
    Array.isArray(report?.weak_spots) ||
    Array.isArray(report?.topics_to_improve) ||
    Array.isArray(report?.action_plan?.focus_topics);

  // Process signals (usually missing unless asked / hosted mocks)
  const hasTimePressureProxy =
    intake?.runs_out_of_time ||
    String(intake?.hardest || "") === "time" ||
    (typeof report?.remarks === "string" && report.remarks.toLowerCase().includes("time")) ||
    (typeof report?.facultyRemarks === "string" &&
      report.facultyRemarks.toLowerCase().includes("time"));

  const hasGuessingProxy =
    intake?.tukka_level ||
    String(intake?.hardest || "") === "careless" ||
    (typeof report?.remarks === "string" && report.remarks.toLowerCase().includes("negative"));

  const hasTimeline =
    typeof intake?.next_mock_days === "string" && intake.next_mock_days.trim().length > 0;

  // Weighting (tuned for your funnel)
  let score = 0;
  if (hasTotalMarks) score += 20;
  if (hasAttempts) score += 20;
  if (hasSectionTable) score += 15;
  if (hasWeaknessClusters) score += 15;
  if (hasTimePressureProxy) score += 15;
  if (hasGuessingProxy) score += 10;
  if (hasTimeline) score += 5;

  score = Math.max(0, Math.min(100, score));

  let band: ConfidenceBand = "low";
  if (score >= 70) band = "high";
  else if (score >= 45) band = "medium";

  const missing: string[] = [];
  if (!hasTotalMarks) missing.push("total_marks");
  if (!hasAttempts) missing.push("attempts_correct_incorrect_accuracy");
  if (!hasSectionTable) missing.push("section_breakdown");
  if (!hasWeaknessClusters) missing.push("weak_topics_or_errors");
  if (!hasTimePressureProxy) missing.push("time_pressure");
  if (!hasGuessingProxy) missing.push("guessing_risk");
  if (!hasTimeline) missing.push("next_mock_timeline");

  // Assumptions are *helpful*, not scary — used by GPT prompt later
  const assumptions: string[] = [];
  if (!hasTimePressureProxy) {
    assumptions.push(
      "Time pressure is unknown; strategy will include pacing rules that work even if you don’t usually run out of time."
    );
  }
  if (!hasGuessingProxy) {
    assumptions.push(
      "Guessing/tukka level is unknown; strategy will prioritize negative-mark containment and skip rules by default."
    );
  }
  if (!hasTimeline) {
    assumptions.push(
      "Next mock timeline is unknown; we’ll provide a 7-day plan as a default and you can adjust based on your date."
    );
  }

  // Smart question picker: ask ONLY what increases strategy quality most
  const questions: NextQuestion[] = [];

  if (!hasTimeline) {
    questions.push({
      id: "next_mock_days",
      question: "When is your next mock?",
      type: "single_select",
      options: ["3", "7", "14", "21", "30+"],
      unlocks: ["plan_length", "intensity", "revision_schedule"],
    });
  }

  if (!hasTimePressureProxy) {
    questions.push({
      id: "runs_out_of_time",
      question: "Do you usually run out of time in the mock?",
      type: "single_select",
      options: ["yes", "no"],
      unlocks: ["pacing_strategy", "endgame_rules", "section_time_budgeting"],
    });
  }

  if (!hasGuessingProxy) {
    questions.push({
      id: "tukka_level",
      question: "How much tukka/guessing did you do in this mock?",
      type: "single_select",
      options: ["low", "medium", "high"],
      unlocks: ["risk_profile", "negative_mark_containment", "attempt_cap_rules"],
    });
  }

  // If everything else exists but we still want 1 more process signal:
  if (questions.length < 2 && !intake?.chaotic_section) {
    questions.push({
      id: "chaotic_section",
      question: "Which section felt most chaotic or rushed?",
      type: "text",
      unlocks: ["execution_mode", "section_order_strategy"],
    });
  }

  return {
    confidence_score: score,
    confidence_band: band,
    missing_signals: missing,
    assumptions,
    next_questions: pickMax2(questions),
  };
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureUserId(req);
  try {
    const contentType = req.headers.get("content-type") || "";

    let exam: Exam | null = null;
    let intake: Intake;
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      const examRaw = String(form.get("exam") || "");
      const normalizedExam = normalizeExam(examRaw);
      exam = normalizedExam;

      const intakeRaw = JSON.parse(String(form.get("intake") || "{}"));
      const parsedIntake = intakeSchema.safeParse(intakeRaw);
      if (!parsedIntake.success) {
        const res = NextResponse.json({ error: "Invalid intake data." }, { status: 400 });
        if (session.isNew) attachUserIdCookie(res, session.userId);
        return res;
      }
      intake = parsedIntake.data as any;

      const pasted = String(form.get("text") || "").trim();
      const file = form.get("file") as File | null;

      if (pasted) text = pasted;

      if (!text && file) {
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          text = await extractTextFromPdf(buf);

          if (!text || text.trim().length < 30) {
            const res = NextResponse.json(
              {
                error:
                  "We couldn’t extract text from this PDF (it may be scanned or image-based). Please paste the mock text instead.",
              },
              { status: 400 }
            );
            if (session.isNew) attachUserIdCookie(res, session.userId);
            return res;
          }
        } catch (e: any) {
          console.error("PDF parse failed:", e?.message ?? e);
          const res = NextResponse.json(
            {
              error:
                "We couldn’t read this PDF (it may be corrupted — e.g., bad xref — or scanned). Please paste the mock text instead.",
            },
            { status: 400 }
          );
          if (session.isNew) attachUserIdCookie(res, session.userId);
          return res;
        }
      }
    } else {
      const body = await req.json();
      const normalizedExam = normalizeExam(body.exam);
      exam = normalizedExam;

      const parsedIntake = intakeSchema.safeParse(body.intake);
      if (!parsedIntake.success) {
        const res = NextResponse.json({ error: "Invalid intake data." }, { status: 400 });
        if (session.isNew) attachUserIdCookie(res, session.userId);
        return res;
      }
      intake = parsedIntake.data as any;
      text = String(body.text || "").trim();
    }

    if (!exam) {
      const res = NextResponse.json({ error: "Missing exam" }, { status: 400 });
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    if (!text || text.trim().length < 30) {
      const res = NextResponse.json(
        { error: "No usable text found. Paste your mock/scorecard text and try again." },
        { status: 400 }
      );
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    // ✅ ensure user exists
    await upsertUser(session.userId);

    const detected = detectExamFromText(text);
    if (detected && detected !== exam) {
      const res = NextResponse.json(
        {
          error: `Exam mismatch: your selected exam is ${exam}, but this scorecard looks like ${detected}. Please switch exam and try again.`,
          detectedExam: detected,
        },
        { status: 400 }
      );
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    const usePython = process.env.ANALYZER_BACKEND === "python";

    const rawOut = usePython
      ? await analyzeViaPython({ exam, intake, text })
      : await analyzeMock({ exam, intake, text });

    // ✅ normalize the shape to always be the report object
    const report = unwrapReport(rawOut);

    // ✅ exam-specific schema enforcement (section naming + ordering)
    const normalizedReport = normalizeSectionBreakdown(exam, report);

    // ✅ enrich meta (safe, doesn’t affect UI if unused)
    const focusXP = computeFocusXP(normalizedReport);
    normalizedReport.meta = normalizedReport.meta || {};
    normalizedReport.meta.focusXP = focusXP;
    normalizedReport.meta.userExam = exam;
    normalizedReport.meta.generatedAt = new Date().toISOString();
    normalizedReport.meta.analyzer_backend = usePython ? "python" : "ts";

    // ✅ NEW: adaptive strategy scaffold (coverage/confidence/questions)
    const scaffold = computeSignalScaffold({ exam, intake, report: normalizedReport });
    normalizedReport.meta.strategy = {
      confidence_score: scaffold.confidence_score,
      confidence_band: scaffold.confidence_band,
      missing_signals: scaffold.missing_signals,
      assumptions: scaffold.assumptions,
      next_questions: scaffold.next_questions, // max 2
    };

    // ✅ save attempt to Mongo
    const attemptId = await saveAttempt({
      userId: session.userId,
      exam,
      intake,
      rawText: text,
      report: normalizedReport,
    });
    // ✅ Strategy Memory snapshot (Step 5)
try {
      const strategyPlan = normalizedReport?.meta?.strategy_plan;
      if (strategyPlan) {
        await saveStrategyMemorySnapshot({
          userId: session.userId,
          exam,
          attemptId,
          strategyPlan,
        });
      }
} catch (e: any) {
  // never block analyze
  console.warn("Strategy memory snapshot failed:", e?.message ?? e);
}


    try {
      await updateUserLearningStateFromReport({
        userId: session.userId,
        exam,
        report: normalizedReport,
   attemptId,
      });
    } catch (e: any) {
      console.warn(
        "User learning state update failed:",
        e?.message ?? e
      );
    }

    const res = NextResponse.json({ id: attemptId });
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  } catch (e: any) {
    console.error("Analyze API failed:", e?.message ?? e);
    const res = NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }
}
