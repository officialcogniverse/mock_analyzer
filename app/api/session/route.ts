import { NextResponse } from "next/server";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";
import { upsertUser } from "@/lib/persist";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureUserId(req);

  await upsertUser(session.userId);

  const res = NextResponse.json({
    userId: session.userId,
    isNew: session.isNew,
  });

  if (session.isNew) {
    attachUserIdCookie(res, session.userId);
  }

  return res;
}
