import type { ZodError } from "zod";

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
