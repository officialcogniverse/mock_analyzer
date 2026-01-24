import { NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie, ensureSession, SessionModeSchema } from "@/lib/session";
import {
  createOtpRequest,
  getInstituteByCode,
  migrateUserData,
  updateUser,
  upsertInstituteByCode,
  upsertInstituteMembership,
  verifyOtpCode,
} from "@/lib/persist";
import { fireAndForgetEvent } from "@/lib/events";

export const runtime = "nodejs";

const otpRequestSchema = z
  .object({
    action: z.enum(["send", "verify"]),
    email: z.string().email(),
    code: z.string().trim().min(4).max(8).optional(),
    mode: SessionModeSchema.optional(),
    instituteCode: z.string().trim().min(2).max(64).optional(),
    instituteName: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  const session = ensureSession(req);

  const body = await req.json().catch(() => null);
  const parsed = otpRequestSchema.safeParse(body);

  if (!parsed.success) {
    const res = NextResponse.json({ error: "Invalid OTP payload." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const email = normalizeEmail(parsed.data.email);
  const mode = parsed.data.mode || "student";

  if (parsed.data.action === "send") {
    const code = generateCode();
    const request = await createOtpRequest(email, code);

    const res = NextResponse.json({
      status: "sent",
      email,
      mode,
      expiresAt: request.expiresAt,
      devCode: code,
    });

    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const otp = String(parsed.data.code || "").trim();
  if (!otp) {
    const res = NextResponse.json({ error: "OTP code is required." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const ok = await verifyOtpCode(email, otp);
  if (!ok) {
    const res = NextResponse.json({ error: "Invalid or expired OTP." }, { status: 401 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const newUserId = `email:${email}`;
  if (session.userId !== newUserId) {
    await migrateUserData({ fromUserId: session.userId, toUserId: newUserId });
  }

  let instituteId: string | undefined;
  let role: "student" | "admin" | "mentor" = "student";

  if (mode === "institute") {
    const code = parsed.data.instituteCode?.trim();
    if (!code) {
      const res = NextResponse.json(
        { error: "Institute code is required for institute login." },
        { status: 400 }
      );
      if (session.isNew) attachSessionCookie(res, session);
      return res;
    }

    const existingInstitute = await getInstituteByCode(code);
    const institute =
      existingInstitute ||
      (await upsertInstituteByCode({
        code,
        name: parsed.data.instituteName,
        adminEmail: email,
      }));

    if (!institute?._id) {
      const res = NextResponse.json({ error: "Institute setup failed." }, { status: 500 });
      if (session.isNew) attachSessionCookie(res, session);
      return res;
    }

    instituteId = institute._id.toString();
    role = institute.adminEmail === email ? "admin" : "mentor";

    await upsertInstituteMembership({
      instituteId,
      userId: newUserId,
      email,
      role: role === "admin" ? "admin" : "mentor",
    });
  }

  const user = await updateUser(newUserId, {
    "auth.email": email,
    "auth.verifiedAt": new Date().toISOString(),
    "auth.mode": mode,
    ...(instituteId ? { "auth.instituteId": instituteId, "auth.role": role } : {}),
  });

  fireAndForgetEvent({
    userId: newUserId,
    payload: {
      event_name: "login_success",
      metadata: { mode, instituteId: instituteId ?? null, role },
    },
  });

  const res = NextResponse.json({
    status: "verified",
    mode,
    role,
    instituteId: instituteId ?? null,
    user,
  });

  attachSessionCookie(res, {
    userId: newUserId,
    mode,
    instituteId,
    role,
    issuedAt: new Date().toISOString(),
  });

  return res;
}
