"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ensureSession } from "@/lib/userClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function generatePayload(params: {
  action: "send" | "verify";
  email: string;
  code?: string;
  mode: "student" | "institute";
  instituteCode?: string;
  instituteName?: string;
}) {
  return {
    action: params.action,
    email: params.email,
    code: params.code,
    mode: params.mode,
    instituteCode: params.instituteCode || undefined,
    instituteName: params.instituteName || undefined,
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);

  const [studentEmail, setStudentEmail] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [studentDevCode, setStudentDevCode] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);

  const [instEmail, setInstEmail] = useState("");
  const [instCode, setInstCode] = useState("");
  const [instInstituteCode, setInstInstituteCode] = useState("");
  const [instInstituteName, setInstInstituteName] = useState("");
  const [instDevCode, setInstDevCode] = useState("");
  const [instLoading, setInstLoading] = useState(false);

  useEffect(() => {
    ensureSession()
      .then(() => setSessionReady(true))
      .catch((err) => toast.error(err?.message || "Could not start session."));
  }, []);

  async function sendStudentOtp() {
    if (!studentEmail) return toast.error("Enter your student email.");
    if (!sessionReady) return toast.error("Session not ready yet.");
    setStudentLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          generatePayload({ action: "send", email: studentEmail, mode: "student" })
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to send OTP.");
      setStudentDevCode(json?.devCode || "");
      toast.success("Student OTP sent ✅");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally {
      setStudentLoading(false);
    }
  }

  async function verifyStudentOtp() {
    if (!studentEmail || !studentCode) return toast.error("Enter email + OTP.");
    if (!sessionReady) return toast.error("Session not ready yet.");
    setStudentLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          generatePayload({
            action: "verify",
            email: studentEmail,
            code: studentCode,
            mode: "student",
          })
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "OTP verification failed.");
      toast.success("Signed in as student ✅");
      router.push("/history");
    } catch (err: any) {
      toast.error(err?.message || "OTP verification failed.");
    } finally {
      setStudentLoading(false);
    }
  }

  async function sendInstituteOtp() {
    if (!instEmail) return toast.error("Enter institute email.");
    if (!instInstituteCode) return toast.error("Institute code is required.");
    if (!sessionReady) return toast.error("Session not ready yet.");
    setInstLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          generatePayload({
            action: "send",
            email: instEmail,
            mode: "institute",
            instituteCode: instInstituteCode,
            instituteName: instInstituteName,
          })
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to send OTP.");
      setInstDevCode(json?.devCode || "");
      toast.success("Institute OTP sent ✅");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally {
      setInstLoading(false);
    }
  }

  async function verifyInstituteOtp() {
    if (!instEmail || !instCode) return toast.error("Enter email + OTP.");
    if (!instInstituteCode) return toast.error("Institute code is required.");
    if (!sessionReady) return toast.error("Session not ready yet.");
    setInstLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          generatePayload({
            action: "verify",
            email: instEmail,
            code: instCode,
            mode: "institute",
            instituteCode: instInstituteCode,
            instituteName: instInstituteName,
          })
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "OTP verification failed.");
      toast.success("Signed in to institute ✅");
      router.push("/institute");
    } catch (err: any) {
      toast.error(err?.message || "OTP verification failed.");
    } finally {
      setInstLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Choose your login path</h1>
        <p className="text-sm text-muted-foreground">
          One analyzer engine. Two monetizable surfaces: student coaching and institute oversight.
        </p>
        <div className="text-xs text-muted-foreground">
          New here? <Link href="/onboarding" className="underline">See onboarding</Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle>Student login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="student@cogniverse.ai"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="6-digit OTP"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
              />
              <Button variant="outline" onClick={sendStudentOtp} disabled={studentLoading}>
                Send
              </Button>
            </div>
            {studentDevCode ? (
              <div className="text-xs text-muted-foreground">Dev OTP: {studentDevCode}</div>
            ) : null}
            <Button className="w-full" onClick={verifyStudentOtp} disabled={studentLoading}>
              Continue as student
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle>Institute login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="mentor@institute.edu"
              value={instEmail}
              onChange={(e) => setInstEmail(e.target.value)}
            />
            <Input
              placeholder="institute-code"
              value={instInstituteCode}
              onChange={(e) => setInstInstituteCode(e.target.value)}
            />
            <Input
              placeholder="Institute name (admin first login)"
              value={instInstituteName}
              onChange={(e) => setInstInstituteName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="6-digit OTP"
                value={instCode}
                onChange={(e) => setInstCode(e.target.value)}
              />
              <Button variant="outline" onClick={sendInstituteOtp} disabled={instLoading}>
                Send
              </Button>
            </div>
            {instDevCode ? (
              <div className="text-xs text-muted-foreground">Dev OTP: {instDevCode}</div>
            ) : null}
            <Button className="w-full" onClick={verifyInstituteOtp} disabled={instLoading}>
              Continue as institute
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
