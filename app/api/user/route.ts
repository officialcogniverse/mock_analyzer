import { NextResponse } from "next/server";
import { upsertUser, getUser, updateUser } from "@/lib/persist";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = String(searchParams.get("userId") || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  await upsertUser(userId);
  const user = await getUser(userId);

  return NextResponse.json({ user });
}

export async function POST(req: Request) {
  const body = await req.json();
  const userId = String(body.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  await upsertUser(userId);

  // only allow safe fields
  const patch: any = {};
  if (body.displayName !== undefined) patch.displayName = String(body.displayName || "").trim() || null;
  if (body.examDefault !== undefined) patch.examDefault = String(body.examDefault || "").trim() || null;

  if (body.coach?.coach_name) patch["coach.coach_name"] = String(body.coach.coach_name);
  if (body.coach?.tone) patch["coach.tone"] = body.coach.tone;
  if (body.coach?.style) patch["coach.style"] = body.coach.style;

  const user = await updateUser(userId, patch);
  return NextResponse.json({ user });
}
