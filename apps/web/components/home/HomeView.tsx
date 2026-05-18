import type { components } from "@aigently/api-client";

import { HomeComposerTeaser } from "@/components/home/HomeComposerTeaser";
import { HomeDifferentiators } from "@/components/home/HomeDifferentiators";
import { HomeHeroValue } from "@/components/home/HomeHeroValue";
import { HomeLaunchStacks } from "@/components/home/HomeLaunchStacks";
import { HomeJtbdSteps } from "@/components/home/HomeJtbdSteps";
import { HomeMarqueeStrip } from "@/components/home/HomeMarqueeStrip";
import { HomePersonaGrid } from "@/components/home/HomePersonaGrid";
import { HomeStatBand } from "@/components/home/HomeStatBand";

type Stack = components["schemas"]["Stack"];

export function HomeView({
  launchStacks,
  verifiedThreatCount,
}: {
  launchStacks: Stack[];
  verifiedThreatCount: number | null;
}) {
  return (
    <main className="flex flex-col overflow-x-clip bg-background font-body-base text-on-surface">
      <HomeHeroValue />
      <HomeMarqueeStrip />
      <HomeLaunchStacks stacks={launchStacks} />
      <HomePersonaGrid />
      <HomeJtbdSteps />
      <HomeStatBand verifiedThreatCount={verifiedThreatCount} />
      <HomeDifferentiators />
      <HomeComposerTeaser />
    </main>
  );
}
