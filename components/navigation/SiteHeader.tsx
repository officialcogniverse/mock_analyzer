"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
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
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>

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
        </nav>
      </div>
    </header>
  );
}
