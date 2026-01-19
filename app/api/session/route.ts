import { NextResponse } from "next/server";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";
import { upsertUser } from "@/lib/persist";

export async function POST(req: Request) {
  const session = ensureUserId(req);
  await upsertUser(session.userId);

  const res = NextResponse.json({ userId: session.userId });
  if (session.isNew) {
    attachUserIdCookie(res, session.userId);
  }

  return res;
}
