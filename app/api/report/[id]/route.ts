import { NextResponse } from "next/server";
import { getAttemptById } from "@/lib/persist";

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
    // ✅ Stable serialization for client + python/debugging
    createdAt:
      rec.createdAt instanceof Date ? rec.createdAt.toISOString() : String(rec.createdAt || ""),
    exam: rec.exam,
    report: rec.report,
  });
}
