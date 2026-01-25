import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cogniverse Mock Analyzer",
  description:
    "Close the loop on every mock attempt with coach-grade patterns, next-best actions, and a plan that adapts with you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
