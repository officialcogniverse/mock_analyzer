"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LandingCtas() {
  const { status } = useSession();
  const authed = status === "authenticated";

  return (
    <div className="flex flex-wrap gap-3">
      {authed ? (
        <Button asChild>
          <Link href="/app">Get started</Link>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/app" })}
        >
          Get started
        </Button>
      )}

      <Button variant="outline" asChild>
        <Link href={authed ? "/history" : "/"}>See progress</Link>
      </Button>
    </div>
  );
}
