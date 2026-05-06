import type { Metadata } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

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

export const metadata: Metadata = {
  title: "Aigent.ly",
  description: "Security-first AI coding rules directory",
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
        {/* Material Symbols: not bundled via next/font (variable font from Google). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=optional"
        />
      </head>
      {/* suppressHydrationWarning: extensions often inject body attrs (e.g. style zoom) before React loads */}
      <body
        className="flex min-h-full flex-col bg-background font-sans text-on-surface"
        suppressHydrationWarning
      >
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-background pt-14">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
