import { NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { getAttemptForUser, upsertActionState } from "@/lib/persist";
import { ActionStateSchema } from "@/lib/domain/schemas";
import { fireAndForgetEvent } from "@/lib/events";

export const runtime = "nodejs";

const markSchema = z.object({
  attemptId: z.string().min(6),
  actionId: z.string().min(2),
  title: z.string().min(2),
  status: z.enum(["pending", "completed", "skipped"]),
  reflection: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Actions are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const body = await req.json().catch(() => null);
  const parsed = markSchema.safeParse(body);
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

  const persistStatus = parsed.data.status === "completed" ? "completed" : "pending";
  const doc = await upsertActionState({
    userId: session.userId,
    attemptId: parsed.data.attemptId,
    actionId: parsed.data.actionId,
    title: parsed.data.title,
    status: persistStatus,
    reflection: parsed.data.reflection,
  });

  if (parsed.data.status === "completed") {
    fireAndForgetEvent({
      userId: session.userId,
      payload: {
        eventName: "mark_action_done",
        payload: {
          attempt_id: parsed.data.attemptId,
          metadata: { actionId: parsed.data.actionId, title: parsed.data.title },
        },
      },
    });
  }

  const actionState = ActionStateSchema.parse({
    user_id: session.userId,
    attempt_id: parsed.data.attemptId,
    action_id: parsed.data.actionId,
    status: parsed.data.status,
    updated_at:
      doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date().toISOString(),
    reflection: doc?.reflection || parsed.data.reflection || undefined,
  });

  const res = NextResponse.json({ actionState });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
