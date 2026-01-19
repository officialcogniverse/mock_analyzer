import { NextResponse } from "next/server";
import { upsertUser, getUser, updateUser } from "@/lib/persist";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";

export async function GET(req: Request) {
  const session = ensureUserId(req);

  await upsertUser(session.userId);
  const user = await getUser(session.userId);

  const res = NextResponse.json({ user });
  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}

export async function POST(req: Request) {
  const session = ensureUserId(req);
  const body = await req.json();
  await upsertUser(session.userId);

  // only allow safe fields
  const patch: any = {};
  if (body.displayName !== undefined) patch.displayName = String(body.displayName || "").trim() || null;
  if (body.examDefault !== undefined) patch.examDefault = String(body.examDefault || "").trim() || null;

  if (body.coach?.coach_name) patch["coach.coach_name"] = String(body.coach.coach_name);
  if (body.coach?.tone) patch["coach.tone"] = body.coach.tone;
  if (body.coach?.style) patch["coach.style"] = body.coach.style;

  const user = await updateUser(session.userId, patch);
  const res = NextResponse.json({ user });
  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}
