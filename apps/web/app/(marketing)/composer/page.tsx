import { listIdesAction, listStacksAction } from "@/app/actions/api-data";
import { ComposerPageClient } from "@/components/composer/ComposerPageClient";

export const metadata = {
  title: "Rule Composer",
  description: "Generate a stack-matched security guardrail file for Claude Code, Cline, Cursor, GitHub Copilot, or Windsurf in under a minute. Free, no sign-up required.",
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
