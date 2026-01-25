"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LandingActions() {
  const { data: session } = useSession();
  const isAuthed = Boolean(session?.user?.id);

  return (
    <div className="flex flex-wrap gap-3">
      {isAuthed ? (
        <Button asChild>
          <Link href="/app">Get started</Link>
        </Button>
      ) : (
        <Button onClick={() => signIn("google", { callbackUrl: "/app" })}>Get started</Button>
      )}
      {isAuthed ? (
        <Button variant="outline" asChild>
          <Link href="/history">See progress</Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          See progress
        </Button>
      )}
    </div>
  );
}
