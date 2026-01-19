import { NextResponse } from "next/server";
import { listAttempts, upsertUser } from "@/lib/persist";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";

export async function GET(req: Request) {
  const session = ensureUserId(req);

  await upsertUser(session.userId);
  const items = await listAttempts(session.userId, 20);

  const res = NextResponse.json({ items });
  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}
