import { NextResponse } from "next/server";
import { upsertUser, getUser, updateUser } from "@/lib/persist";
import { attachSessionCookie, ensureSession } from "@/lib/session";

export const runtime = "nodejs";

function clampMinutes(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(15, Math.min(300, Math.round(numeric)));
}

export async function GET(req: Request) {
  const session = ensureSession(req);

  await upsertUser(session.userId);
  const user = await getUser(session.userId);

  const res = NextResponse.json({ user });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}

export async function POST(req: Request) {
  const session = ensureSession(req);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  await upsertUser(session.userId);

  const patch: any = {};

  if (body.displayName !== undefined) {
    patch.displayName = String(body.displayName || "").trim() || null;
    patch["profile.displayName"] = patch.displayName;
  }
  if (body.examDefault !== undefined) {
    patch.examDefault = String(body.examDefault || "").trim() || null;
  }

  if (body.profile?.targetExamLabel !== undefined) {
    patch["profile.targetExamLabel"] = String(body.profile.targetExamLabel || "").trim() || null;
  }
  if (body.profile?.goal !== undefined) {
    const goal = String(body.profile.goal || "score").trim();
    patch["profile.goal"] =
      goal === "accuracy" || goal === "speed" || goal === "concepts" ? goal : "score";
  }
  if (body.profile?.nextMockDate !== undefined) {
    const raw = String(body.profile.nextMockDate || "").trim();
    patch["profile.nextMockDate"] = raw || null;
  }
  if (body.profile?.dailyStudyMinutes !== undefined) {
    patch["profile.dailyStudyMinutes"] = clampMinutes(body.profile.dailyStudyMinutes);
  }
  if (body.profile?.biggestStruggle !== undefined) {
    patch["profile.biggestStruggle"] = String(body.profile.biggestStruggle || "").trim() || null;
  }
  if (body.profile?.timezone !== undefined) {
    patch["profile.timezone"] = String(body.profile.timezone || "").trim() || "Asia/Kolkata";
  }

  // Backward-compatible writes (no UI branching)
  if (body.profile?.preferredMockDay !== undefined) {
    patch["profile.preferredMockDay"] = String(body.profile.preferredMockDay || "").trim() || null;
  }
  if (body.profile?.examAttempt !== undefined) {
    patch["profile.examAttempt"] = String(body.profile.examAttempt || "").trim() || null;
  }
  if (body.profile?.focusArea !== undefined) {
    patch["profile.focusArea"] = String(body.profile.focusArea || "").trim() || null;
  }
  if (body.profile?.studyGroup !== undefined) {
    patch["profile.studyGroup"] = String(body.profile.studyGroup || "").trim() || null;
  }

  if (body.settings?.targetScore !== undefined) {
    const raw = String(body.settings.targetScore || "").trim();
    patch["settings.targetScore"] = raw ? raw : null;
  }
  if (body.settings?.targetDate !== undefined) {
    const raw = String(body.settings.targetDate || "").trim();
    patch["settings.targetDate"] = raw ? raw : null;
  }
  if (body.settings?.examName !== undefined) {
    const raw = String(body.settings.examName || "").trim();
    patch["settings.examName"] = raw ? raw : null;
  }
  if (body.settings?.tier !== undefined) {
    const raw = String(body.settings.tier || "").trim().toLowerCase();
    patch["settings.tier"] = raw || "free";
  }

  const user = await updateUser(session.userId, patch);

  const res = NextResponse.json({ user });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
