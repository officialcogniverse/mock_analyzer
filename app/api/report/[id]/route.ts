import { NextResponse } from "next/server";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { getAttemptForUser, updateAttemptIdentity } from "@/lib/persist";
import { normalizeReport } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Reports are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const { id } = await context.params;

  const rec = await getAttemptForUser({
    attemptId: id,
    userId: session.userId,
    backfillMissingUserId: true,
  });

  if (!rec) {
    const res = NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const attemptId = rec._id.toString();
  await updateAttemptIdentity({ attemptId, userId: session.userId });

  const createdAtIso = rec.createdAt instanceof Date ? rec.createdAt.toISOString() : String(rec.createdAt || new Date().toISOString());
  const normalizedReport = rec.report
    ? normalizeReport(rec.report, { userId: session.userId, attemptId, createdAt: createdAtIso })
    : null;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[api.report] report lookup", {
      userId: session.userId,
      attemptId,
      reportFound: Boolean(normalizedReport),
      nextActionsCount: normalizedReport?.next_actions?.length ?? 0,
    });
  }

  const res = NextResponse.json({
    id: attemptId,
    createdAt: createdAtIso,
    exam: rec.exam,
    report: normalizedReport,
  });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
