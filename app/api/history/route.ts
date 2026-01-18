import { NextResponse } from "next/server";
import { listAttempts, upsertUser } from "@/lib/persist";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = String(searchParams.get("userId") || "").trim();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await upsertUser(userId);
  const items = await listAttempts(userId, 20);

  return NextResponse.json({ items });
}
