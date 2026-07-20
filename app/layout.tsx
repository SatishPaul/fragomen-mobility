import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    "Turn photos and short clips into a narrated, ready-to-post video — right in your browser.",
};

const brandVars = {
  "--brand-background": brand.colors.background,
  "--brand-surface": brand.colors.surface,
  "--brand-surface-raised": brand.colors.surfaceRaised,
  "--brand-border": brand.colors.border,
  "--brand-accent": brand.colors.accent,
  "--brand-accent-foreground": brand.colors.accentForeground,
  "--brand-heading": brand.colors.heading,
  "--brand-text": brand.colors.text,
  "--brand-muted": brand.colors.muted,
  "--brand-success": brand.colors.success,
} as React.CSSProperties;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. focus-visible
    // polyfills) inject attributes into <html> before React hydrates; the
    // mismatch is harmless but the dev overlay it triggers blocks clicks.
    <html
      lang="en"
      style={brandVars}
      className={`${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body className="page-glow min-h-screen">{children}</body>
    </html>
  );
}
