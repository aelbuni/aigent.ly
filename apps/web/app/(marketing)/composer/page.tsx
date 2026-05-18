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

  return (
    <ComposerPageClient
      initialStacks={stacks}
      initialIdes={ides}
      initialLayers={layerRows}
    />
  );
}
