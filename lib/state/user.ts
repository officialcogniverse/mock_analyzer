import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const USER_COOKIE = "cogniverse_user";

export function getOrCreateUserId(): string {
  const cookieStore = cookies();
  const existing = cookieStore.get(USER_COOKIE)?.value;
  if (existing) return existing;
  const id = `anon_${randomUUID()}`;
  cookieStore.set(USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}
