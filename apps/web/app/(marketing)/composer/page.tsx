import { listIdesAction, listStacksAction } from "@/app/actions/api-data";
import { listLayersWithStatsFromDb } from "@/lib/catalog-from-db";
import { ComposerPageClient } from "@/components/composer/ComposerPageClient";

export const metadata = {
  title: "Rule Composer — Aigent.ly",
  description: "Build your AI security ruleset in seconds. Select stack, IDE, and protection layers to generate a ready-to-use rules file.",
};

export default async function ComposerPage() {
  const [stacks, ides, layerRows] = await Promise.all([
    listStacksAction(),
    listIdesAction(),
    listLayersWithStatsFromDb().catch(() => []),
  ]);

  // Only show launch stacks — coming_soon stacks have no rules and produce empty output
  const launchStacks = stacks.filter((s) => s.catalogStatus === "launch");

  return (
    <ComposerPageClient
      initialStacks={launchStacks}
      initialIdes={ides}
      initialLayers={layerRows}
    />
  );
}
