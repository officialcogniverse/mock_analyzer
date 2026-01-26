// lib/state/user.ts
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const USER_COOKIE = "cv_uid";

export async function getOrCreateUserId(): Promise<string> {
  const cookieStore = await cookies(); // ✅ IMPORTANT: await

  const existing = cookieStore.get(USER_COOKIE)?.value;
  if (existing) return existing;

  const id = `anon_${randomUUID()}`;

  cookieStore.set(USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return id;
}
