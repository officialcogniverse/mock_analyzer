import { NextResponse } from "next/server";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { CoachRequestSchema, CoachResponseSchema } from "@/lib/contracts";
import {
  appendCoachMessage,
  createCoachConversation,
  getAttemptForUser,
  getCoachConversation,
  getLatestAttemptForExam,
  listActionStatesForAttempt,
  listCoachMessages,
} from "@/lib/persist";
import { buildCoachContext, generateCoachReply } from "@/lib/coach";
import { fireAndForgetEvent } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Coach is student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const body = await req.json().catch(() => null);
  const parsed = CoachRequestSchema.safeParse(body);

  if (!parsed.success) {
    const res = NextResponse.json({ error: "Invalid coach payload." }, { status: 400 });
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

  const exam = String(attempt.exam || "GENERIC");
  const actionRefs = Array.isArray(attempt.report?.next_actions)
    ? attempt.report.next_actions
        .map((action: any) => ({ id: action?.id ? String(action.id) : undefined, title: String(action?.title || "").trim() }))
        .filter((action: any) => action.title)
    : [];

  const actionStates = await listActionStatesForAttempt({
    userId: session.userId,
    attemptId: parsed.data.attemptId,
    actionRefs,
  });

  const previousAttempt = await getLatestAttemptForExam({
    userId: session.userId,
    exam,
    excludeAttemptId: parsed.data.attemptId,
  });

  const existingConversation = parsed.data.conversationId
    ? await getCoachConversation({ conversationId: parsed.data.conversationId, userId: session.userId })
    : null;

  const conversation =
    existingConversation ||
    (await createCoachConversation({
      userId: session.userId,
      exam,
      attemptId: parsed.data.attemptId,
      linkedAttemptIds: [
        parsed.data.attemptId,
        previousAttempt?._id ? previousAttempt._id.toString() : "",
      ].filter(Boolean),
      referencedPatterns: (Array.isArray(attempt.report?.patterns) ? attempt.report.patterns : [])
        .slice(0, 3)
        .map((pattern: any, idx: number) => String(pattern?.id || `pattern-${idx + 1}`)),
    }));

  if (!conversation) {
    const res = NextResponse.json({ error: "Conversation context missing." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const context = buildCoachContext({
    attemptId: parsed.data.attemptId,
    exam,
    report: attempt.report,
    actionStates,
    previousAttempt: previousAttempt
      ? { id: previousAttempt._id.toString(), report: previousAttempt.report }
      : null,
  });

  if (parsed.data.message) {
    await appendCoachMessage({
      conversationId: conversation.conversationId,
      userId: session.userId,
      attemptId: parsed.data.attemptId,
      role: "user",
      mode: parsed.data.mode,
      content: parsed.data.message,
      citations: [
        {
          type: "pattern",
          ref: context.patterns[0]?.id || "pattern-1",
          label: context.patterns[0]?.title || "Report context",
        },
      ],
      createdAt: new Date(),
    });
  }

  const reply = await generateCoachReply({
    mode: parsed.data.mode,
    message: parsed.data.message,
    context,
  });

  await appendCoachMessage({
    conversationId: conversation.conversationId,
    userId: session.userId,
    attemptId: parsed.data.attemptId,
    role: "coach",
    mode: parsed.data.mode,
    content: reply.answer,
    citations: reply.citations as any,
    createdAt: new Date(),
  });

  fireAndForgetEvent({
    userId: session.userId,
    payload: {
      event_name: "coach_message_sent",
      attempt_id: parsed.data.attemptId,
      metadata: { mode: parsed.data.mode, conversationId: conversation.conversationId },
    },
  });

  const messages = await listCoachMessages({
    conversationId: conversation.conversationId,
    userId: session.userId,
  });

  const responsePayload = {
    conversation: {
      conversationId: conversation.conversationId,
      userId: session.userId,
      attemptId: parsed.data.attemptId,
      exam,
      linkedAttemptIds: conversation.linkedAttemptIds,
      referencedPatterns: conversation.referencedPatterns,
    },
    messages,
    groundedIn: reply.citations,
  };

  const validated = CoachResponseSchema.safeParse(responsePayload);
  const res = NextResponse.json(validated.success ? validated.data : responsePayload);
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
