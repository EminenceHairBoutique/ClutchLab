import type { Metadata, Viewport } from "next";

import { BottomNav } from "@/components/nav/bottom-nav";
import { TopNav } from "@/components/nav/top-nav";
import { PwaRegister } from "@/components/pwa-register";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { siteStructuredData } from "@/lib/seo/structured-data";

import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ClutchLab — PUBG Mobile training companion",
    template: "%s · ClutchLab",
  },
  description:
    "Independent PUBG Mobile companion: verified pro settings, personalized sensitivity calibration, versioned meta, deliberate training, and post-match AI coaching.",
  applicationName: "ClutchLab",
  // iPhone install support (Add to Home Screen → real standalone app).
  appleWebApp: {
    capable: true,
    title: "ClutchLab",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        <JsonLd data={siteStructuredData()} />
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <TopNav />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
          {children}
        </main>
        <SiteFooter />
        <BottomNav />
        <PwaRegister />
      </body>
    </html>
  );
}
