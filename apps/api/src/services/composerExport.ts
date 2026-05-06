import { listRulesForComposerExport, type RuleLayerValue } from "../repos/rulesRepo.js";

export type ComposerExportInput = {
  stackSlug: string;
  ideSlug: string;
  layers: RuleLayerValue[];
};

export async function buildComposerMarkdownExport(input: ComposerExportInput) {
  const rules = await listRulesForComposerExport(
    input.stackSlug,
    input.ideSlug,
    input.layers
  );

  const header = [
    `<!-- Aigent.ly composer export -->`,
    `Stack: ${input.stackSlug}`,
    `IDE: ${input.ideSlug}`,
    input.layers.length ? `Layers: ${input.layers.join(", ")}` : `Layers: (all)`,
    ``,
    `---`,
    ``,
  ].join("\n");

  if (rules.length === 0) {
    return {
      format: "markdown" as const,
      content: `${header}_No matching rules in the catalog for this configuration._\n`,
      filename: `aigently-rules-${input.stackSlug}-${input.ideSlug}.md`,
    };
  }

  const blocks = rules.map((r) => {
    const body = (r.bodyMdx ?? "").trim() || `_No body for **${r.slug}**._`;
    return [`## ${r.name}`, `**Slug:** \`${r.slug}\` · **Version:** ${r.version}`, ``, body, ``, `---`, ``].join(
      "\n"
    );
  });

  return {
    format: "markdown" as const,
    content: `${header}${blocks.join("\n")}`,
    filename: `aigently-rules-${input.stackSlug}-${input.ideSlug}.md`,
  };
}
