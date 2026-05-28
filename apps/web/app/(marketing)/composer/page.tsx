import { listIdesAction, listStacksAction } from "@/app/actions/api-data";
import { ComposerPageClient } from "@/components/composer/ComposerPageClient";

export const metadata = {
  title: "Rule Composer — Aigent.ly",
  description: "Generate a stack-matched security guardrail file for Cursor, Claude Code, Windsurf, or Copilot in under a minute. Free, no sign-up required.",
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
