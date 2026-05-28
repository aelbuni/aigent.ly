import { listIdesAction, listStacksAction } from "@/app/actions/api-data";
import { ComposerPageClient } from "@/components/composer/ComposerPageClient";

export const metadata = {
  title: "Rule Composer — Aigent.ly",
  description: "Build your AI security ruleset in seconds. Select stack, IDE, and rule type to generate a ready-to-use rules file.",
};

export default async function ComposerPage() {
  const [stacks, ides] = await Promise.all([
    listStacksAction(),
    listIdesAction(),
  ]);

  const launchStacks = stacks.filter((s) => s.catalogStatus === "launch");

  return (
    <ComposerPageClient
      initialStacks={launchStacks}
      initialIdes={ides}
    />
  );
}
