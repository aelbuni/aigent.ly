import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  db,
  layer,
  rule,
  ruleLayerMap,
  ruleStack,
  ruleThreatMap,
  stack,
  threat,
} from "@/lib/db";
import { createLLMClient, getModelForTask } from "@/lib/summarizer/llm-client";

// ── Config ────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 5;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Batch tool schema ─────────────────────────────────────────────────────────

const amplifyBatchTool = {
  name: "write_threat_guardrails_batch",
  description:
    "Write guardrail atoms for every threat in the list. Return exactly one result per threat ID.",
  input_schema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array",
        description: "One entry per threat in the input list, in the same order.",
        items: {
          type: "object",
          required: ["threatId", "patternLines", "ruleContext"],
          properties: {
            threatId: {
              type: "string",
              description: "Exact threat ID from the input.",
            },
            patternLines: {
              type: "array",
              items: { type: "string" },
              description:
                "2–4 ALWAYS/NEVER statements specific to this vulnerability's attack vector. " +
                "Each line MUST start with ALWAYS or NEVER (uppercase). " +
                "Never mention dependency versions, package names, or upgrade instructions.",
              minItems: 1,
              maxItems: 4,
            },
            ruleContext: {
              type: "string",
              description:
                "One sentence, plain English, ≤120 characters, no markdown. " +
                "Describes the real-world risk a developer needs to understand about this specific CVE.",
            },
          },
        },
        minItems: 1,
      },
    },
    required: ["results"],
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a security guardrail writer for developer IDE rules (Cursor, Claude Code, Windsurf).
You produce concise, actionable content for pattern-level security rules.

PATTERN LINES rules:
- 2 to 4 lines, each starting with ALWAYS or NEVER (uppercase)
- Specific to this vulnerability's attack vector — not generic security advice
- About code structure and safe API usage only
- Never mention package names, version numbers, or upgrade instructions
- Good: "NEVER rely on pathname-only middleware checks for authorization."
- Good: "ALWAYS validate outbound request hostnames against an explicit allowlist."
- Bad: "ALWAYS follow vendor guidance" (too generic)
- Bad: "ALWAYS upgrade to version 9.0.0" (mentions versions)
- NEVER produce a patternLine that would apply to any stack (too generic)
- Each patternLine must reference the specific attack mechanism in the threat description

RULE CONTEXT rules:
- Exactly one sentence, ≤120 characters, no markdown, no backticks
- Names the specific real-world risk of this CVE
- Good: "Redirect handling can forward Authorization and cookie headers to untrusted origins."
- Bad: "This vulnerability affects node-fetch versions before 2.6.7." (describes the patch, not the risk)

Process EVERY threat in the list. Return exactly one result per threat ID, in the same order.`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AmplifyResult {
  patternLines: string[];
  ruleContext: string;
}

// ── Exported pipeline function ────────────────────────────────────────────────

export async function amplifyThreatsForLayer(
  stackSlug: string,
  layerSlug: string
): Promise<number> {
  try {
    const [client, MODEL] = await Promise.all([
      createLLMClient(),
      getModelForTask("threat_amplification"),
    ]);

    // ── Per-chunk amplification ───────────────────────────────────────────────

    async function amplifyChunk(
      threats: (typeof threat.$inferSelect)[]
    ): Promise<Map<string, AmplifyResult>> {
      const threatEntries = threats
        .map((t, i) => {
          const owaspRefs = (t.owaspRefs as string[] | null) ?? [];
          const products = t.affectedProducts as Array<{
            name?: string;
            ecosystem?: string;
          }> | null;
          const pkgNames =
            products
              ?.map((p) => p.name)
              .filter(Boolean)
              .join(", ") ?? "unknown";

          return [
            `[${i + 1}] Threat ID: ${t.publicId}`,
            `    Name: ${t.name}`,
            `    Description: ${t.description?.slice(0, 600) ?? "Not available"}`,
            `    OWASP categories: ${owaspRefs.join(", ") || "unknown"}`,
            `    Affected packages: ${pkgNames}`,
          ].join("\n");
        })
        .join("\n\n");

      const userPrompt = [
        `Write guardrail content for the following ${threats.length} threat(s).`,
        `Return exactly one result per Threat ID listed below.`,
        "",
        threatEntries,
      ].join("\n");

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: CHUNK_SIZE * 400,
        system: SYSTEM_PROMPT,
        tools: [amplifyBatchTool],
        tool_choice: { type: "tool", name: "write_threat_guardrails_batch" },
        messages: [{ role: "user", content: userPrompt }],
      });

      const toolUse = response.content.find((b) => b.type === "tool_use");
      const results = new Map<string, AmplifyResult>();

      if (toolUse?.type === "tool_use") {
        const input = toolUse.input as {
          results: Array<{ threatId: string } & AmplifyResult>;
        };
        for (const item of input.results ?? []) {
          if (item.threatId && item.patternLines?.length && item.ruleContext?.trim()) {
            results.set(item.threatId, {
              patternLines: item.patternLines,
              ruleContext: item.ruleContext.trim(),
            });
          }
        }
      }

      return results;
    }

    // ── Fallback: single-threat amplification ─────────────────────────────────

    async function amplifySingle(
      t: typeof threat.$inferSelect
    ): Promise<AmplifyResult | null> {
      const owaspRefs = (t.owaspRefs as string[] | null) ?? [];
      const products = t.affectedProducts as Array<{
        name?: string;
        ecosystem?: string;
      }> | null;
      const pkgNames =
        products
          ?.map((p) => p.name)
          .filter(Boolean)
          .join(", ") ?? "unknown";

      const userPrompt = [
        `Threat ID: ${t.publicId}`,
        `Name: ${t.name}`,
        `Description: ${t.description?.slice(0, 600) ?? "Not available"}`,
        `OWASP categories: ${owaspRefs.join(", ") || "unknown"}`,
        `Affected packages: ${pkgNames}`,
        "",
        "Write the guardrail content for this threat.",
      ].join("\n");

      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          tools: [
            {
              name: "write_threat_guardrail",
              description: "Write the guardrail content atoms for one security threat",
              input_schema: {
                type: "object" as const,
                properties: {
                  patternLines: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 1,
                    maxItems: 4,
                  },
                  ruleContext: { type: "string" },
                },
                required: ["patternLines", "ruleContext"],
              },
            },
          ],
          tool_choice: { type: "tool", name: "write_threat_guardrail" },
          messages: [{ role: "user", content: userPrompt }],
        });

        const toolUse = response.content.find((b) => b.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") return null;
        const input = toolUse.input as AmplifyResult;
        if (!input.patternLines?.length || !input.ruleContext?.trim()) return null;
        return {
          patternLines: input.patternLines,
          ruleContext: input.ruleContext.trim(),
        };
      } catch (e) {
        console.error(`  ✗ ${t.publicId}:`, (e as Error).message);
        return null;
      }
    }

    // ── Step 1: resolve rule IDs for (stackSlug, layerSlug) ──────────────────

    const stackRow = await db
      .select({ id: stack.id })
      .from(stack)
      .where(eq(stack.slug, stackSlug))
      .limit(1);

    if (stackRow.length === 0) {
      console.error(`amplifyThreatsForLayer: stack not found: ${stackSlug}`);
      return 0;
    }

    const layerRow = await db
      .select({ id: layer.id })
      .from(layer)
      .where(eq(layer.slug, layerSlug))
      .limit(1);

    if (layerRow.length === 0) {
      console.error(`amplifyThreatsForLayer: layer not found: ${layerSlug}`);
      return 0;
    }

    const stackId = stackRow[0].id;
    const layerId = layerRow[0].id;

    // rule → ruleStack (filter by stack) → ruleLayerMap (filter by layer)
    const ruleIdRows = await db
      .selectDistinct({ ruleId: rule.id })
      .from(rule)
      .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
      .innerJoin(ruleLayerMap, eq(ruleLayerMap.ruleId, rule.id))
      .where(and(eq(ruleStack.stackId, stackId), eq(ruleLayerMap.layerId, layerId)));

    if (ruleIdRows.length === 0) {
      return 0;
    }

    const ruleIds = ruleIdRows.map((r) => r.ruleId);

    // ── Step 2: find unamplified threats linked to those rules ────────────────

    const threatIdRows = await db
      .selectDistinct({ threatId: ruleThreatMap.threatId })
      .from(ruleThreatMap)
      .where(inArray(ruleThreatMap.ruleId, ruleIds));

    if (threatIdRows.length === 0) {
      return 0;
    }

    const threatIds = threatIdRows.map((r) => r.threatId);

    const rows = await db
      .select()
      .from(threat)
      .where(and(inArray(threat.publicId, threatIds), isNull(threat.aiAmplification)));

    if (rows.length === 0) {
      return 0;
    }

    // ── Step 3: process in chunks ─────────────────────────────────────────────

    let succeeded = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);

      let chunkResults: Map<string, AmplifyResult>;
      try {
        chunkResults = await amplifyChunk(chunk);
      } catch (e) {
        console.error(
          `amplifyThreatsForLayer: batch failed: ${(e as Error).message} — falling back to individual calls`
        );
        chunkResults = new Map();
      }

      // Fallback for any threats the batch missed
      for (const t of chunk) {
        if (!chunkResults.has(t.publicId)) {
          const single = await amplifySingle(t);
          if (single) chunkResults.set(t.publicId, single);
        }
      }

      // Write results to DB
      for (const t of chunk) {
        const result = chunkResults.get(t.publicId);
        if (!result) continue;

        await db
          .update(threat)
          .set({
            aiAmplification: JSON.stringify({
              patternLines: result.patternLines,
              ruleContext: result.ruleContext,
              generatedAt: new Date().toISOString(),
              model: MODEL,
            }),
          })
          .where(eq(threat.publicId, t.publicId));

        succeeded++;
      }

      if (i + CHUNK_SIZE < rows.length) await sleep(300);
    }

    return succeeded;
  } catch (err) {
    console.error("amplifyThreatsForLayer error:", err);
    return 0;
  }
}
