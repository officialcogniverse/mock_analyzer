import { NextResponse } from "next/server";
import { ensureUserId } from "@/lib/session";
import { getDb } from "@/lib/mongo";
import { z } from "zod";

const rosterSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = ensureUserId(req);
  const db = await getDb();
  const roster = db.collection<any>("institute_roster");

  const rows = await roster
    .find({ adminUserId: session.userId })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({
    students: rows.map((row) => ({
      id: row._id?.toString?.() || "",
      name: row.name,
      notes: row.notes || "",
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = ensureUserId(req);
  const body = await req.json().catch(() => null);
  const parsed = rosterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid roster payload" }, { status: 400 });
  }

  const db = await getDb();
  const roster = db.collection<any>("institute_roster");

  const result = await roster.insertOne({
    adminUserId: session.userId,
    name: parsed.data.name,
    notes: parsed.data.notes || "",
    createdAt: new Date(),
  });

  return NextResponse.json({
    id: result.insertedId.toString(),
    name: parsed.data.name,
    notes: parsed.data.notes || "",
  });
}
