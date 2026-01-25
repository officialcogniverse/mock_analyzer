import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

const SESSION_COOKIE = "cv_session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const SessionDataSchema = z
  .object({
    userId: z.string().min(6),
    issuedAt: z.string().optional(),
  })
  .passthrough();

export type SessionData = z.infer<typeof SessionDataSchema>;

export type SessionResult = SessionData & {
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

function decodeSessionCookie(value: string | undefined | null) {
  if (!value) return null;
  try {
    const json = Buffer.from(String(value), "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    const result = SessionDataSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function encodeSessionCookie(session: SessionData) {
  const payload = {
    ...session,
    issuedAt: session.issuedAt ?? new Date().toISOString(),
  } satisfies SessionData;
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function getSessionFromRequest(req: Request): SessionData | null {
  const header = req.headers.get("cookie") || "";
  const cookies = parseCookies(header);

  const fromSessionCookie = decodeSessionCookie(cookies[SESSION_COOKIE]);
  if (fromSessionCookie) return fromSessionCookie;

  return null;
}

export function ensureSession(req: Request, overrides?: Partial<SessionData>): SessionResult {
  const existing = getSessionFromRequest(req);

  if (existing) {
    const merged = {
      ...existing,
      ...overrides,
    } satisfies SessionData;

    const parsed = SessionDataSchema.safeParse(merged);
    return {
      ...(parsed.success ? parsed.data : existing),
      isNew: false,
    } satisfies SessionResult;
  }

  const fresh: SessionData = {
    userId: overrides?.userId || nanoid(12),
    issuedAt: new Date().toISOString(),
  };

  const parsed = SessionDataSchema.safeParse(fresh);
  return {
    ...(parsed.success ? parsed.data : fresh),
    isNew: true,
  } satisfies SessionResult;
}

export function attachSessionCookie(res: NextResponse, session: SessionData) {
  const encoded = encodeSessionCookie(session);

  res.cookies.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}
