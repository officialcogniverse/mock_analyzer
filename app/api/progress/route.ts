import { NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertUser,
  getUserProgress,
  upsertUserProgress,
  toggleProbe,
  type Probe,
} from "@/lib/persist";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { normalizeExam } from "@/lib/exams";

export const runtime = "nodejs";

const examSchema = z.string().optional();

const probeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  done: z.boolean().optional(),
  doneAt: z.string().optional().nullable(),
});

const probeMetricsSchema = z.record(z.string(),
  z.object({
    accuracy: z.number().optional(),
    time_min: z.number().optional(),
    self_confidence: z.number().optional(),
    notes: z.string().optional(),
  })
);

const practiceMetricsSchema = z.record(z.string(),
  z.object({
    accuracy: z.number().optional(),
    time_min: z.number().optional(),
    score: z.number().optional(),
    notes: z.string().optional(),
  })
);

const sectionTimingSchema = z.object({
  section: z.string().min(1),
  minutes: z.number().nullable(),
  order: z.number().nullable().optional(),
  source: z.enum(["manual", "ocr"]).optional(),
});

const reminderSchema = z.object({
  time: z.string().optional().nullable(),
  channel: z.enum(["whatsapp", "email", "sms", "push", "none"]).optional(),
});

const adherenceSchema = z.array(
  z.object({
    date: z.string().min(1),
    done: z.boolean(),
  })
);

const postSchema = z
  .object({
    exam: examSchema,

    // planner patch (optional)
    nextMockInDays: z.number().optional(),
    minutesPerDay: z.number().optional(),

    // probe toggle (optional)
    probe: probeSchema.optional(),
    done: z.boolean().optional(),

    // seed/replace probes (optional) — for initializing probe list once
    probes: z.array(probeSchema).optional(),

    // allow direct confidence patch (optional)
    confidence: z.number().optional(),

    // optional per-probe metrics (accuracy, time, etc.)
    probeMetrics: probeMetricsSchema.optional(),

    // optional practice set metrics (accuracy, time, score)
    practiceMetrics: practiceMetricsSchema.optional(),

    // optional timing + reminders
    sectionTimings: z.array(sectionTimingSchema).optional(),
    reminder: reminderSchema.optional(),
    planAdherence: adherenceSchema.optional(),
  })
  .strict();

/**
 * GET /api/progress?exam=CAT
 */
export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Progress is student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }
  const url = new URL(req.url);

  const examRaw = url.searchParams.get("exam") || "";
  const parsed = examSchema.safeParse(examRaw);
  const exam = normalizeExam(parsed.success ? parsed.data : examRaw) || "GENERIC";

  await upsertUser(session.userId);

  const doc = await getUserProgress(session.userId, exam);

  const res = NextResponse.json({
    progress: doc || {
      userId: session.userId,
      exam,
      nextMockInDays: 7,
      minutesPerDay: 40,
      probes: [],
      confidence: 0,
    },
  });

  if (session.isNew) attachSessionCookie(res, session);
  return res;
}

/**
 * POST /api/progress
 */
export async function POST(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Progress is student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      const res = NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 }
      );
      if (session.isNew) attachSessionCookie(res, session);
      return res;
    }

    const {
      exam,
      probe,
      done,
      probes,
      probeMetrics,
      practiceMetrics,
      sectionTimings,
      reminder,
      planAdherence,
      ...rest
    } = parsed.data;

    await upsertUser(session.userId);

    const examLabel = normalizeExam(exam) || "GENERIC";

    // Case A: probe toggle
    if (probe && typeof done === "boolean") {
      const out = await toggleProbe({
        userId: session.userId,
        exam: examLabel,
        probe: probe as Probe,
        done,
      });

      const res = NextResponse.json({ progress: out });
      if (session.isNew) attachSessionCookie(res, session);
      return res;
    }

    // Case B: patch/seed
    const patch: any = {};
    if (typeof rest.nextMockInDays === "number")
      patch.nextMockInDays = rest.nextMockInDays;
    if (typeof rest.minutesPerDay === "number")
      patch.minutesPerDay = rest.minutesPerDay;
    if (typeof rest.confidence === "number") patch.confidence = rest.confidence;
    if (probeMetrics) patch.probeMetrics = probeMetrics;
    if (practiceMetrics) patch.practiceMetrics = practiceMetrics;
    if (sectionTimings) patch.sectionTimings = sectionTimings;
    if (reminder) patch.reminder = reminder;
    if (planAdherence) patch.planAdherence = planAdherence;

    // ✅ allow seeding probes list
    if (Array.isArray(probes)) {
      patch.probes = probes.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        tags: p.tags,
        done: !!p.done,
        doneAt: p.doneAt ?? (p.done ? new Date().toISOString() : undefined),
      }));
    }

    if (!Object.keys(patch).length) {
      const res = NextResponse.json(
        { error: "Nothing to update. Provide planner fields or probe+done." },
        { status: 400 }
      );
      if (session.isNew) attachSessionCookie(res, session);
      return res;
    }

    const out = await upsertUserProgress({
      userId: session.userId,
      exam: examLabel,
      patch,
    });

    const res = NextResponse.json({ progress: out });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  } catch (e: any) {
    const res = NextResponse.json(
      { error: e?.message || "Progress API failed" },
      { status: 500 }
    );
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }
}
