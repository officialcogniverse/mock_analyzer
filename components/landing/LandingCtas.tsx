"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LandingCtas() {
  const { data: session } = useSession();
  const userId =
    session?.user?.id ??
    (session?.user?.email ? session.user.email.trim().toLowerCase() : undefined);
  const authed = Boolean(userId);

  return (
    <div className="flex flex-wrap gap-3">
      {authed ? (
        <Button asChild>
          <Link href="/app">Get started</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href="/login">Get started</Link>
        </Button>
      )}

      <Button variant="outline" asChild>
        <Link href={authed ? "/history" : "/login"}>See progress</Link>
      </Button>
    </div>
  );
}
