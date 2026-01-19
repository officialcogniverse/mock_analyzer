import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

const COOKIE_NAME = "cv_uid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type SessionResult = {
  userId: string;
  isNew: boolean;
};

function parseCookies(header: string) {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.split("=");
      if (!key) return acc;
      acc[key] = decodeURIComponent(rest.join("=") || "");
      return acc;
    }, {});
}

export function getUserIdFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie") || "";
  const cookies = parseCookies(header);
  const value = cookies[COOKIE_NAME];
  return value ? String(value).trim() : null;
}

export function ensureUserId(req: Request): SessionResult {
  const existing = getUserIdFromRequest(req);
  if (existing) {
    return { userId: existing, isNew: false };
  }

  return { userId: nanoid(12), isNew: true };
}

export function attachUserIdCookie(res: NextResponse, userId: string) {
  res.cookies.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
