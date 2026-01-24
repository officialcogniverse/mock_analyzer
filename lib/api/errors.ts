import type { ZodError } from "zod";
import type { Session } from "next-auth";

export function ok<T>(data: T) {
  return { ok: true as const, data };
}

export function fail(code: string, message: string, details?: unknown) {
  return { ok: false as const, error: { code, message, details } };
}

export function mapZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function assertAuthed(session: Session | null) {
  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }
  return session.user.id;
}
