import { NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { addMentorNote, listMentorNotes } from "@/lib/persist";

export const runtime = "nodejs";

const noteSchema = z
  .object({
    studentUserId: z.string().min(6),
    note: z.string().min(2).max(2000),
  })
  .strict();

export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "institute" || !session.instituteId) {
    const res = NextResponse.json({ error: "Institute session required." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const url = new URL(req.url);
  const studentUserId = String(url.searchParams.get("studentUserId") || "").trim();
  if (!studentUserId) {
    const res = NextResponse.json({ error: "studentUserId is required." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const notes = await listMentorNotes({ instituteId: session.instituteId, studentUserId });
  const res = NextResponse.json({ notes });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}

export async function POST(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "institute" || !session.instituteId) {
    const res = NextResponse.json({ error: "Institute session required." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const body = await req.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);

  if (!parsed.success) {
    const res = NextResponse.json({ error: "Invalid mentor note payload." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const doc = await addMentorNote({
    instituteId: session.instituteId,
    studentUserId: parsed.data.studentUserId,
    authorUserId: session.userId,
    authorRole: session.role === "admin" ? "admin" : "mentor",
    note: parsed.data.note,
  });

  const res = NextResponse.json({
    note: doc.note,
    authorRole: doc.authorRole,
    createdAt: doc.createdAt,
  });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
