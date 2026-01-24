import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { CogniverseProvider } from "@/lib/domain/mockData";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <CogniverseProvider>
            {children}
            <Toaster richColors position="top-right" />
          </CogniverseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
