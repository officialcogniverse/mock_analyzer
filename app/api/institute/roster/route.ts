import { NextResponse } from "next/server";
import { ensureSession, attachSessionCookie } from "@/lib/session";
import { getDb } from "@/lib/mongo";
import { z } from "zod";

const rosterSchema = z
  .object({
    name: z.string().min(1),
    notes: z.string().optional(),
    studentUserId: z.string().min(6).optional(),
  })
  .strict();

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "institute" || !session.instituteId) {
    const res = NextResponse.json({ error: "Institute session required." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const db = await getDb();
  const roster = db.collection<any>("institute_roster");

  const rows = await roster
    .find({ instituteId: session.instituteId })
    .sort({ createdAt: -1 })
    .toArray();

  const res = NextResponse.json({
    students: rows.map((row) => ({
      id: row._id?.toString?.() || "",
      name: row.name,
      notes: row.notes || "",
      studentUserId: row.studentUserId || "",
      createdAt: row.createdAt,
    })),
  });

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
  const parsed = rosterSchema.safeParse(body);

  if (!parsed.success) {
    const res = NextResponse.json({ error: "Invalid roster payload" }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const db = await getDb();
  const roster = db.collection<any>("institute_roster");

  const result = await roster.insertOne({
    instituteId: session.instituteId,
    adminUserId: session.userId,
    name: parsed.data.name,
    notes: parsed.data.notes || "",
    studentUserId: parsed.data.studentUserId?.trim() || "",
    createdAt: new Date(),
  });

  const res = NextResponse.json({
    id: result.insertedId.toString(),
    name: parsed.data.name,
    notes: parsed.data.notes || "",
    studentUserId: parsed.data.studentUserId?.trim() || "",
  });

  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
