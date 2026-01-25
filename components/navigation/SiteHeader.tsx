"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const isAuthed = status === "authenticated";
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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
          {isAuthed ? (
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
                variant="ghost"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("open-bot-widget"));
                  }
                }}
              >
                Help
              </Button>
            </>
          ) : null}
          <Button variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {status === "loading" ? null : session ? (
            <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </Button>
          ) : (
            <Button onClick={() => signIn("google", { callbackUrl: "/app" })}>Sign in</Button>
          )}
        </nav>
      </div>
    </header>
  );
}
