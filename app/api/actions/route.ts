import { NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import {
  getAttemptForUser,
  listActionStatesForAttempt,
  upsertActionState,
} from "@/lib/persist";
import { fireAndForgetEvent } from "@/lib/events";

export const runtime = "nodejs";

const postSchema = z
  .object({
    attemptId: z.string().min(6),
    actionId: z.string().min(2),
    title: z.string().min(2),
    status: z.enum(["pending", "completed"]),
    reflection: z.string().max(2000).optional(),
  })
  .passthrough();

export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Actions are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const url = new URL(req.url);
  const attemptId = String(url.searchParams.get("attemptId") || "").trim();
  if (!attemptId) {
    const res = NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const attempt = await getAttemptForUser({
    attemptId,
    userId: session.userId,
    backfillMissingUserId: true,
  });
  if (!attempt) {
    const res = NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const actionRefs = Array.isArray(attempt.report?.next_actions)
    ? attempt.report.next_actions
        .map((action: any) => ({
          id: action?.id ? String(action.id) : undefined,
          title: String(action?.title || "").trim(),
        }))
        .filter((action: any) => action.title)
    : [];

  const states = await listActionStatesForAttempt({
    userId: session.userId,
    attemptId,
    actionRefs,
  });

  const res = NextResponse.json({ states });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}

export async function POST(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Actions are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    const res = NextResponse.json({ error: "Invalid action payload." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const attempt = await getAttemptForUser({
    attemptId: parsed.data.attemptId,
    userId: session.userId,
    backfillMissingUserId: true,
  });
  if (!attempt) {
    const res = NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const doc = await upsertActionState({
    userId: session.userId,
    attemptId: parsed.data.attemptId,
    actionId: parsed.data.actionId,
    title: parsed.data.title,
    status: parsed.data.status,
    reflection: parsed.data.reflection,
  });

  if (parsed.data.status === "completed") {
    fireAndForgetEvent({
      userId: session.userId,
      payload: {
        event_name: "action_completed",
        attempt_id: parsed.data.attemptId,
        metadata: { actionId: parsed.data.actionId, title: parsed.data.title },
      },
    });
  }

  const res = NextResponse.json({
    actionId: doc?.actionId || parsed.data.actionId,
    status: doc?.status || parsed.data.status,
    reflection: doc?.reflection || "",
    completedAt:
      doc?.completedAt instanceof Date ? doc.completedAt.toISOString() : doc?.completedAt || null,
  });

  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
