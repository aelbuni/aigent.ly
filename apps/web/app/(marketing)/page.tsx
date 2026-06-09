import type { Metadata } from "next";

import { HomeView } from "@/components/home/HomeView";
import {
  countDistinctThreatsOnLaunchStacks,
  listLaunchStacksFromDb,
  listTopThreatsForHomepage,
} from "@/lib/catalog-from-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "Aigent.ly — Vulnerability Prevention for AI-Generated Code",
  },
  description:
    "Open-source vulnerability prevention layer for AI-generated code. Daily CVE updates from NVD, GHSA, and CISA KEV — injected directly into Cursor, Claude Code, Windsurf, and Copilot.",
  openGraph: {
    title: "Aigent.ly — Vulnerability Prevention for AI-Generated Code",
    description:
      "Open-source vulnerability prevention layer for AI-generated code. Daily CVE updates from NVD, GHSA, and CISA KEV — injected directly into Cursor, Claude Code, Windsurf, and Copilot.",
    url: "https://aigent.ly",
    images: [
      {
        url: "https://aigent.ly/og-image.png",
        width: 1200,
        height: 630,
        alt: "Aigent.ly — open-source vulnerability prevention layer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aigent.ly — Vulnerability Prevention for AI-Generated Code",
    description:
      "Open-source vulnerability prevention layer for AI-generated code. Daily CVE updates injected into Cursor, Claude Code, and Copilot.",
    images: ["https://aigent.ly/og-image.png"],
  },
};

export default async function Home() {
  const [launchStacks, topThreats] = await Promise.all([
    listLaunchStacksFromDb().catch(() => []),
    listTopThreatsForHomepage(10).catch(() => []),
  ]);
  let verifiedThreatCount: number | null = null;
  try {
    verifiedThreatCount = await countDistinctThreatsOnLaunchStacks();
  } catch {
    verifiedThreatCount = null;
  }

  return (
    <HomeView
      launchStacks={launchStacks}
      verifiedThreatCount={verifiedThreatCount}
      topThreats={topThreats}
    />
  );
}
