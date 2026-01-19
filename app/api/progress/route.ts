import { NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertUser,
  getUserProgress,
  upsertUserProgress,
  toggleProbe,
  type Probe,
} from "@/lib/persist";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";

export const runtime = "nodejs";

const examSchema = z.enum(["CAT", "NEET", "JEE"]);

const probeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  done: z.boolean().optional(),
  doneAt: z.string().optional().nullable(),
});

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
  })
  .strict();

/**
 * GET /api/progress?exam=CAT
 */
export async function GET(req: Request) {
  const session = ensureUserId(req);
  const url = new URL(req.url);

  const examRaw = url.searchParams.get("exam") || "";
  const parsed = examSchema.safeParse(String(examRaw).toUpperCase());

  if (!parsed.success) {
    const res = NextResponse.json(
      { error: "Missing/invalid exam. Use ?exam=CAT|NEET|JEE" },
      { status: 400 }
    );
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }

  const exam = parsed.data;

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

  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}

/**
 * POST /api/progress
 */
export async function POST(req: Request) {
  const session = ensureUserId(req);

  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      const res = NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 }
      );
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    const { exam, probe, done, probes, ...rest } = parsed.data;

    await upsertUser(session.userId);

    // Case A: probe toggle
    if (probe && typeof done === "boolean") {
      const out = await toggleProbe({
        userId: session.userId,
        exam,
        probe: probe as Probe,
        done,
      });

      const res = NextResponse.json({ progress: out });
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    // Case B: patch/seed
    const patch: any = {};
    if (typeof rest.nextMockInDays === "number")
      patch.nextMockInDays = rest.nextMockInDays;
    if (typeof rest.minutesPerDay === "number")
      patch.minutesPerDay = rest.minutesPerDay;
    if (typeof rest.confidence === "number") patch.confidence = rest.confidence;

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
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    const out = await upsertUserProgress({
      userId: session.userId,
      exam,
      patch,
    });

    const res = NextResponse.json({ progress: out });
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  } catch (e: any) {
    const res = NextResponse.json(
      { error: e?.message || "Progress API failed" },
      { status: 500 }
    );
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }
}
