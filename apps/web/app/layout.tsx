import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const BASE_URL = "https://aigent.ly";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Aigent.ly — Vulnerability Prevention for AI-Generated Code",
    template: "%s | Aigent.ly",
  },
  description:
    "Open-source vulnerability prevention layer for AI-generated code. Daily CVE updates from NVD, GHSA, and CISA KEV — injected directly into Cursor, Claude Code, Windsurf, and Copilot.",
  applicationName: "Aigent.ly",
  keywords: [
    "AI coding security",
    "vulnerability prevention",
    "CVE guardrails",
    "MCP server",
    "vibe coding security",
    "Cursor security rules",
    "Claude Code CLAUDE.md",
    "open source security",
    "context engineering",
  ],
  authors: [{ name: "Aigent.ly", url: BASE_URL }],
  creator: "Aigent.ly",
  publisher: "Aigent.ly",

  // Favicon + icons (handled via <head> below; these populate the Next.js icon manifest)
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      { rel: "mask-icon", url: "/favicon.svg", color: "#161618" },
    ],
  },
  manifest: "/site.webmanifest",

  // Open Graph — LinkedIn, Slack, iMessage, Facebook
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Aigent.ly",
    title: "Aigent.ly — Vulnerability Prevention for AI-Generated Code",
    description:
      "Open-source vulnerability prevention layer for AI-generated code. Daily CVE updates injected directly into Cursor, Claude Code, Windsurf, and Copilot.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Aigent.ly — open-source vulnerability prevention layer",
        type: "image/png",
      },
    ],
    locale: "en_US",
  },

  // Twitter / X Card — large image banner
  twitter: {
    card: "summary_large_image",
    site: "@aigently",
    creator: "@aigently",
    title: "Aigent.ly — Vulnerability Prevention for AI-Generated Code",
    description:
      "Open-source vulnerability prevention layer for AI-generated code. Daily CVE updates injected directly into Cursor, Claude Code, and Copilot.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        alt: "Aigent.ly — white wordmark on dark background",
      },
    ],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161618" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
        {/* PWA manifest + mobile shortcut */}
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Aigent.ly" />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
