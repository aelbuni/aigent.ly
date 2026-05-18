import type { DirectiveAtom } from "./atoms.js";

type LayerInfo = { slug: string; name: string; concernStatement: string };
type StackInfo = { slug: string; name: string };

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function buildSummarizerPrompt(
  atoms: DirectiveAtom[],
  layers: LayerInfo[],
  stack: StackInfo,
  targetIDE: string
): string {
  const layerNames = layers.map((l) => l.name).join(" + ");
  const concerns = layers.map((l) => l.concernStatement).join("; ");
  const sourceRuleIds = unique(atoms.map((a) => a.sourceRuleId));
  const allCwes = unique(atoms.flatMap((a) => a.cweRefs));
  const conflicted = atoms.filter((a) => a.conflictResolution === "conflict_resolved");

  return `You are a principal security engineer synthesizing guardrail rules for AI coding assistants.

STACK: ${stack.name}
LAYER(S): ${layerNames}
TARGET IDE: ${targetIDE}
CONCERN: ${concerns}

You have been given ${atoms.length} directive atoms extracted from ${sourceRuleIds.length} community-contributed rules.
Each atom is tagged with its source rule, severity, and any CVE/CWE references.

DIRECTIVE ATOMS:
${atoms.map((a) => `[${a.severity.toUpperCase()}] ${a.content} (Source: ${a.sourceRuleId}${a.cweRefs.length ? `, CWE: ${a.cweRefs.join(", ")}` : ""})`).join("\n")}

${conflicted.length > 0 ? `CONFLICTS RESOLVED:\n${conflicted.map((a) => `- "${a.content}" was chosen over conflicting variant (reason: higher severity)`).join("\n")}\n` : ""}

YOUR TASK:
Write a single, unified guardrail rule for the ${layerNames} layer(s) of a ${stack.name} project,
formatted for use in ${targetIDE}.

Rules:
1. Write as direct instructions TO the AI coding assistant (imperative voice)
2. Cover all unique CVE/CWE concerns present in the input atoms
3. Be specific — name exact functions, packages, patterns to avoid or prefer
4. Use WHEN/THEN structure for context-dependent directives
5. Open with a comment block:
   # aigently: ${stack.slug}-${layers.map((l) => l.slug).join("+")}-guardrails v1.0 [summarized]
   # Merged from ${sourceRuleIds.length} rules
   # Protects: ${allCwes.length ? allCwes.join(", ") : "multiple threat vectors"}
6. End with a DO NOT section listing the most dangerous patterns

Return ONLY the guardrail rule content. No preamble, no explanation, no markdown wrapper.`.trim();
}
