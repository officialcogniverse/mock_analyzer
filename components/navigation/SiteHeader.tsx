"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const userId =
    session?.user?.id ??
    (session?.user?.email ? session.user.email.trim().toLowerCase() : undefined);
  const authed = Boolean(userId);

  const { theme, resolvedTheme, setTheme } = useTheme();

  // Prevent hydration mismatch: theme is unknown on server, known on client after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // resolvedTheme turns "system" into "light" | "dark"
  const currentTheme = useMemo(() => resolvedTheme ?? theme, [resolvedTheme, theme]);

  const toggleTheme = () => {
    const t = currentTheme === "dark" ? "light" : "dark";
    setTheme(t);
  };

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            CV
          </div>
          <div>
            <p className="text-sm font-semibold">Cogniverse</p>
            <p className="text-xs text-muted-foreground">Mock Analyzer</p>
          </div>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {/* Nav links */}
          {authed ? (
            <>
              <Link href="/app" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/history" className="text-muted-foreground hover:text-foreground">
                History
              </Link>
              <Link href="/account" className="text-muted-foreground hover:text-foreground">
                Account
              </Link>

              <Button
                type="button"
                variant="ghost"
                onClick={() => window.dispatchEvent(new Event("open-bot-widget"))}
              >
                Help
              </Button>
            </>
          ) : (
            <>
              <Link href="/about" className="text-muted-foreground hover:text-foreground">
                About
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Login
              </Link>
            </>
          )}

          {/* Theme toggle always visible (hydration-safe) */}
          <Button type="button" variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">
            {mounted ? (
              currentTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <span className="h-4 w-4" />
            )}
          </Button>

          {/* Auth button */}
          {status === "loading" ? null : authed ? (
            <Button type="button" variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </Button>
          ) : (
            <Button asChild type="button">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
