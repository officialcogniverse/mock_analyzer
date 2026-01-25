"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const authed = status === "authenticated";

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
        <Link href="/" className="text-lg font-semibold">
          Cogniverse
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {/* Only show protected nav links when authenticated */}
          {authed ? (
            <>
              <Link
                href="/app"
                className="text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/history"
                className="text-muted-foreground hover:text-foreground"
              >
                History
              </Link>
              <Link
                href="/account"
                className="text-muted-foreground hover:text-foreground"
              >
                Account
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/about"
                className="text-muted-foreground hover:text-foreground"
              >
                About
              </Link>
            </>
          )}

          {/* Auth button */}
          {status === "loading" ? null : authed ? (
            <Button
              variant="outline"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </Button>
          ) : (
            <Button onClick={() => signIn("google", { callbackUrl: "/app" })}>
              Sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
