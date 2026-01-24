import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

const USER_COOKIE = "cv_uid";
const SESSION_COOKIE = "cv_session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const SessionModeSchema = z.enum(["student", "institute"]);
export const SessionRoleSchema = z.enum(["student", "admin", "mentor"]);

export type SessionMode = z.infer<typeof SessionModeSchema>;
export type SessionRole = z.infer<typeof SessionRoleSchema>;

export const SessionDataSchema = z
  .object({
    userId: z.string().min(6),
    mode: SessionModeSchema.default("student"),
    instituteId: z.string().min(6).optional(),
    role: SessionRoleSchema.default("student"),
    issuedAt: z.string().optional(),
  })
  .strict();

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

  const legacyUserId = cookies[USER_COOKIE];
  if (legacyUserId) {
    return {
      userId: String(legacyUserId).trim(),
      mode: "student",
      role: "student",
      issuedAt: new Date().toISOString(),
    } satisfies SessionData;
  }

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
    mode: overrides?.mode || "student",
    instituteId: overrides?.instituteId,
    role: overrides?.role || (overrides?.mode === "institute" ? "mentor" : "student"),
    issuedAt: new Date().toISOString(),
  };

  const parsed = SessionDataSchema.safeParse(fresh);
  return {
    ...(parsed.success ? parsed.data : fresh),
    isNew: true,
  } satisfies SessionResult;
}

// Backwards-compatible helper for existing routes
export function ensureUserId(req: Request) {
  const session = ensureSession(req);
  return { userId: session.userId, isNew: session.isNew };
}

export function attachSessionCookie(res: NextResponse, session: SessionData) {
  const encoded = encodeSessionCookie(session);

  res.cookies.set(USER_COOKIE, session.userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  res.cookies.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}
