import { NextResponse } from "next/server";
import { getAttemptById } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const rec = await getAttemptById(id);

  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: rec._id.toString(),
    createdAt:
      rec.createdAt instanceof Date ? rec.createdAt.toISOString() : String(rec.createdAt || ""),
    exam: rec.exam,
    report: rec.report,
  });
}
