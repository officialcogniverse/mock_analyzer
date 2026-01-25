import Link from "next/link";

export function SiteHeader() {
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

        <nav className="flex items-center gap-3 text-sm text-muted-foreground">
          One-page MVP
        </nav>
      </div>
    </header>
  );
}
