import { NextResponse } from "next/server";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";
import { createOtpRequest, migrateUserData, updateUser, verifyOtpCode } from "@/lib/persist";

export const runtime = "nodejs";

function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  const session = ensureUserId(req);
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const email = normalizeEmail(body.email);
  const action = String(body.action || "").trim().toLowerCase();

  if (!email) {
    const res = NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }

  if (action === "send") {
    const code = generateCode();
    const request = await createOtpRequest(email, code);

    const res = NextResponse.json({
      status: "sent",
      email,
      expiresAt: request.expiresAt,
      devCode: code,
    });
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }

  if (action === "verify") {
    const otp = String(body.code || "").trim();
    if (!otp) {
      const res = NextResponse.json({ error: "OTP code is required." }, { status: 400 });
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    const ok = await verifyOtpCode(email, otp);
    if (!ok) {
      const res = NextResponse.json({ error: "Invalid or expired OTP." }, { status: 401 });
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    const newUserId = `email:${email}`;
    if (session.userId !== newUserId) {
      await migrateUserData({ fromUserId: session.userId, toUserId: newUserId });
    }

    const user = await updateUser(newUserId, {
      "auth.email": email,
      "auth.verifiedAt": new Date().toISOString(),
    });

    const res = NextResponse.json({ status: "verified", user });
    attachUserIdCookie(res, newUserId);
    return res;
  }

  const res = NextResponse.json({ error: "Invalid action." }, { status: 400 });
  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}
