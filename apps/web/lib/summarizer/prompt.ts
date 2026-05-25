import type { DirectiveAtom } from "./atoms";

type LayerInfo = { slug: string; name: string; concernStatement: string };
type StackInfo = { slug: string; name: string };

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// ── Single-layer prompt (used by runSummarizerForLayer and per-pair regenerate) ──

export function buildSummarizerPrompt(
  atoms: DirectiveAtom[],
  layers: LayerInfo[],
  stack: StackInfo,
  previousScore?: number,
): string {
  const layerNames = layers.map((l) => l.name).join(" + ");
  const concerns = layers.map((l) => l.concernStatement).join("; ");
  const sourceRuleIds = unique(atoms.map((a) => a.sourceRuleId));
  const allCwes = unique(atoms.flatMap((a) => a.cweRefs));
  const conflicted = atoms.filter((a) => a.conflictResolution === "conflict_resolved");

  return `You are a principal security engineer writing guardrail rules that an AI coding assistant (Cursor, Claude Code, Copilot, Windsurf) will read and enforce while generating code.

STACK: ${stack.name}
LAYER(S): ${layerNames}
CONCERN: ${concerns}

You have been given ${atoms.length} directive atoms extracted from ${sourceRuleIds.length} community-contributed rules.

DIRECTIVE ATOMS:
${atoms.map((a) => `[${a.severity.toUpperCase()}] ${a.content} (Source: ${a.sourceRuleId}${a.cweRefs.length ? `, CWE: ${a.cweRefs.join(", ")}` : ""})`).join("\n")}

${conflicted.length > 0 ? `CONFLICTS RESOLVED:\n${conflicted.map((a) => `- "${a.content}" was chosen over conflicting variant (reason: higher severity)`).join("\n")}\n` : ""}
YOUR TASK:
Write a single, unified guardrail rule for the ${layerNames} layer(s) of a ${stack.name} project.
Keep the guardrail to 400 words maximum.

Rules:
1. Write as direct instructions TO the AI coding assistant — imperative voice, present tense.
   The assistant reads this file before generating every line of code. You are interrupting its generation flow.

2. Name the specific CWE-NNN or CVE each directive addresses — never say "injection" or "security issue" alone.
   Always say "SQL injection (CWE-89)" or "CVE-2024-34351 — SSRF via Host header".

3. Be specific — use exact ${stack.name} API names, package names, and function signatures.
   Say "call req.session.regenerate() after login" not "regenerate the session".
   If you cannot name the exact API, say "consult [package] docs for the secure equivalent."

4. Write WHEN/THEN/ELSE behavioral contracts, not passive reminders.
   The assistant must know exactly when to apply each rule and what to do if it cannot comply.
   BAD:  "ALWAYS use parameterized queries."
   GOOD: "WHEN generating any SQL or database query, THEN use parameterized syntax only.
         If the framework does not support parameterization, STOP and tell the developer
         why rather than generating an unsafe string-concatenated version."

5. Open with this exact comment block:
   # aigently: ${stack.slug}-${layers.map((l) => l.slug).join("+")}-guardrails v1.0 [summarized]
   # Merged from ${sourceRuleIds.length} rules
   # Protects: ${allCwes.length ? allCwes.join(", ") : "multiple threat vectors"}

6. End with a DO NOT section listing the most dangerous anti-patterns as named code constructs.

7. Group directives by attack vector (e.g., "### Session Fixation", "### SSRF via Redirects"),
   not by CVE number. One attack vector per heading, 3-5 directives each.

EXAMPLE — ideal output structure for an auth_session guardrail:

# aigently: express-auth_session-guardrails v1.0 [summarized]
# Merged from 1 rules | Protects: CWE-287, CWE-384

## Session Fixation After Authentication

WHEN a user successfully authenticates (login, OAuth callback, password reset),
THEN call req.session.regenerate() immediately to issue a new session ID.
If the framework does not expose session ID regeneration, STOP and tell the developer
to upgrade to a session library that does (e.g., express-session >=1.17.0).

NEVER reuse a pre-authentication session token for an authenticated request — this
allows an attacker who planted the session ID to hijack the authenticated session (CWE-384).

## DO NOT
- DO NOT persist session IDs across authentication state changes
- DO NOT store session tokens in localStorage or sessionStorage — use HttpOnly Secure cookies

Output the guardrail text only — no preamble, no markdown fencing, no explanation.${previousScore !== undefined && previousScore < 8 ? `

QUALITY FEEDBACK (previous score: ${previousScore}/10):
This guardrail needs improvement. Address the following before rewriting:
${previousScore <= 3 ? "- Content is too sparse — expand with WHEN/THEN/ELSE contracts citing each CWE and exact API names." : ""}
${atoms.filter((a) => a.conflictResolution === "conflict_resolved").length > 2 ? "- High conflict count — merge overlapping directives into one clear stance per attack vector." : ""}
${unique(atoms.map((a) => a.sourceRuleId)).length < 2 ? "- Thin coverage — ensure every atom's CWE is addressed with a named code pattern and WHEN/THEN framing." : ""}
- Target: 8/10 or higher. Every directive must tell the AI assistant exactly when to act and what to generate (or not generate).` : ""}`.trim();
}

// ── Multi-layer batch tool schema (used by runSummarizerForStack) ──────────────

export const MULTI_LAYER_TOOL = {
  name: "produce_stack_guardrails",
  description: "Write one complete guardrail section per security layer for a single stack. Each section is stored and served independently.",
  input_schema: {
    type: "object" as const,
    properties: {
      guardrails: {
        type: "array",
        description: "One entry per layer that had directive atoms. Preserve the layer order from the prompt.",
        items: {
          type: "object",
          required: ["layerSlug", "content", "conflictCount"],
          properties: {
            layerSlug: {
              type: "string",
              description: "Exact slug from the === LAYER === header in the prompt.",
            },
            content: {
              type: "string",
              description: "Complete guardrail text for this layer (300-500 words). Imperative voice, starts with the # aigently comment block, uses WHEN/THEN/ELSE behavioral contracts grouped by attack vector, ends with DO NOT section listing named anti-patterns.",
            },
            conflictCount: {
              type: "number",
              description: "Number of conflict-resolved atoms in this layer (can be 0).",
            },
          },
        },
        minItems: 1,
      },
    },
    required: ["guardrails"],
  },
};

// ── Multi-layer batch prompt (used by runSummarizerForStack) ───────────────────

export type BatchLayerInput = {
  layer: LayerInfo;
  atoms: DirectiveAtom[];
  sourceRuleIds: string[];
};

export function buildMultiLayerBatchPrompt(
  layers: BatchLayerInput[],
  stack: StackInfo,
  previousScoresByLayer?: Record<string, number>,
): string {
  const layerSections = layers.map(({ layer, atoms, sourceRuleIds }) => {
    const allCwes = unique(atoms.flatMap((a) => a.cweRefs));
    const conflicted = atoms.filter((a) => a.conflictResolution === "conflict_resolved");
    const prevScore = previousScoresByLayer?.[layer.slug];

    const atomLines = atoms
      .map((a) => `[${a.severity.toUpperCase()}] ${a.content} (Source: ${a.sourceRuleId}${a.cweRefs.length ? `, CWE: ${a.cweRefs.join(", ")}` : ""})`)
      .join("\n");

    const conflictBlock = conflicted.length > 0
      ? `CONFLICTS RESOLVED (${conflicted.length}):\n${conflicted.map((a) => `- "${a.content}" chosen over conflicting variant (higher severity)`).join("\n")}\n`
      : "";

    const feedbackBlock = prevScore !== undefined && prevScore < 8
      ? [
          `QUALITY FEEDBACK (previous score: ${prevScore}/10):`,
          prevScore <= 3 ? `- Too sparse — expand with specific WHEN/THEN patterns citing each CWE.` : "",
          conflicted.length > 2 ? `- High conflict count — consolidate overlapping directives.` : "",
          sourceRuleIds.length < 2 ? `- Thin coverage — address every CWE with a named code pattern.` : "",
          `- Target 8/10. Prioritise specificity, completeness, zero redundancy.`,
        ].filter(Boolean).join("\n")
      : "";

    return [
      `=== LAYER: ${layer.name} | slug: ${layer.slug} ===`,
      `CONCERN: ${layer.concernStatement}`,
      `DIRECTIVE ATOMS: ${atoms.length} atoms from ${sourceRuleIds.length} rules | Protects: ${allCwes.length ? allCwes.join(", ") : "multiple threat vectors"}`,
      atomLines,
      conflictBlock,
      feedbackBlock,
      `Expected comment block header for this layer:`,
      `# aigently: ${stack.slug}-${layer.slug}-guardrails v1.0 [summarized]`,
      `# Merged from ${sourceRuleIds.length} rules | Protects: ${allCwes.length ? allCwes.join(", ") : "multiple threat vectors"}`,
    ].filter(Boolean).join("\n");
  });

  return `You are a principal security engineer writing guardrail rules that an AI coding assistant (Cursor, Claude Code, Copilot, Windsurf) will read and enforce while generating code.

STACK: ${stack.name} (${stack.slug})
LAYERS TO PROCESS: ${layers.length}

You will produce one independent guardrail section per security layer below.
Each section is stored and served to IDEs separately — do not cross-reference layers in your output.
Keep each section to 300-500 words.

${layerSections.join("\n\n")}

YOUR TASK:
Call the produce_stack_guardrails tool with one entry per layer above.

Rules for every section:

1. Write as direct instructions TO the AI coding assistant — imperative, present tense.
   The assistant reads this file before generating every line of code. You are interrupting its generation flow.

2. Name the specific CWE-NNN or CVE each directive addresses — never say "injection" or "security issue" alone.
   Always say "SQL injection (CWE-89)" or "prototype pollution (CWE-1321)".

3. Be specific — use exact ${stack.name} API names, package names, and function signatures.
   Say the actual function call, not a description. If you cannot name it, say "consult [package] docs."

4. Write WHEN/THEN/ELSE behavioral contracts, not passive reminders.
   The assistant must know exactly when a rule fires and what to do if it cannot comply.
   BAD:  "ALWAYS validate outbound request URLs."
   GOOD: "WHEN generating any code that makes an outbound HTTP request with a URL derived from
         user input or an environment variable, THEN validate the hostname against an explicit
         allowlist before the request is made. If an allowlist is not configured, STOP and ask
         the developer to define one — do not generate the fetch call with an unvalidated URL."

5. Open with the exact comment block header shown above for each layer.

6. End with a DO NOT block listing the highest-severity anti-patterns as named code constructs
   (e.g., "DO NOT pass req.body directly into a Sequelize where clause").

7. Group directives by attack vector (e.g., "### Session Fixation", "### Prototype Pollution"),
   not by CVE number. One attack vector per heading, 3-5 WHEN/THEN directives each.

Output ALL ${layers.length} layers using the tool. Do not skip any.`.trim();
}
