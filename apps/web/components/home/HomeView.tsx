import type { components } from "@aigently/api-client";

import { HomeComposerTeaser } from "@/components/home/HomeComposerTeaser";
import { HomeDifferentiators } from "@/components/home/HomeDifferentiators";
import { HomeHeroValue } from "@/components/home/HomeHeroValue";
import { HomeLaunchStacks } from "@/components/home/HomeLaunchStacks";
import { HomeJtbdSteps } from "@/components/home/HomeJtbdSteps";
import { HomeLiveThreatFeed } from "@/components/home/HomeLiveThreatFeed";
import { HomeMcpSection } from "@/components/home/HomeMcpSection";
import { HomeMarqueeStrip } from "@/components/home/HomeMarqueeStrip";
import { HomePersonaGrid } from "@/components/home/HomePersonaGrid";
import { HomeStatBand } from "@/components/home/HomeStatBand";
import { HomeTerminalDemo } from "@/components/home/HomeTerminalDemo";
import type { HomeThreatRow } from "@/lib/catalog-from-db";

type Stack = components["schemas"]["Stack"];

export function HomeView({
  launchStacks,
  verifiedThreatCount,
  topThreats,
}: {
  launchStacks: Stack[];
  verifiedThreatCount: number | null;
  topThreats: HomeThreatRow[];
}) {
  return (
    <main className="flex flex-col overflow-x-clip bg-background font-body-base text-on-surface">
      <HomeHeroValue />
      <HomeTerminalDemo />
      <HomeMarqueeStrip />
      <HomeLaunchStacks stacks={launchStacks} />
      <HomePersonaGrid />
      <HomeJtbdSteps />
      <HomeMcpSection />
      <HomeStatBand verifiedThreatCount={verifiedThreatCount} />
      <HomeLiveThreatFeed threats={topThreats} />
      <HomeDifferentiators />
      <HomeComposerTeaser />
    </main>
  );
}
