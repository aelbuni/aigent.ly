import { and, eq, inArray } from "drizzle-orm";

import {
  layer,
  rule,
  ruleLayerMap,
  ruleStack,
  stack,
  summarizedGuardrail,
} from "@aigently/db/schema";
import { db } from "../../lib/db.js";

import { parseRuleIntoAtoms } from "./atoms.js";
import { buildCacheKey } from "./cache.js";
import { resolveConflicts } from "./conflicts.js";
import { deduplicateAtoms } from "./dedup.js";
import { createLLMClient } from "./llm-client.js";
import { buildSummarizerPrompt } from "./prompt.js";

const SUMMARIZER_VERSION = "1.0";

export type SummarizeRequest = {
  stackSlug: string;
  layerSlugs: string[];
  ruleIds?: string[];
  ruleType?: "pattern" | "deps" | "config" | "runtime" | "all";
  targetIDE?: string;
  maxTokens?: number;
};

export type ProvenanceEntry = {
  sourceRuleIds: string[];
  resolution: "kept" | "merged" | "conflict_resolved" | "deduplicated";
};

export type LayerSummary = {
  layerSlug: string;
  layerName: string;
  summarizedContent: string;
  ruleCount: number;
  conflictCount: number;
  provenance: Record<string, ProvenanceEntry>;
  generatedAt: string;
  cacheKey: string;
  cacheHit: boolean;
};

export type SummarizeResponse = {
  layers: LayerSummary[];
  stackSlug: string;
  generatedAt: string;
};

async function fetchRulesForLayer(
  stackSlug: string,
  layerSlug: string,
  ruleType?: string
): Promise<{ id: string; slug: string; bodyMdx: string | null }[]> {
  const rows = await db
    .select({ id: rule.id, slug: rule.slug, bodyMdx: rule.bodyMdx })
    .from(rule)
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId))
    .innerJoin(ruleLayerMap, eq(ruleLayerMap.ruleId, rule.id))
    .innerJoin(layer, eq(layer.id, ruleLayerMap.layerId))
    .where(and(eq(stack.slug, stackSlug), eq(layer.slug, layerSlug)));

  if (!ruleType || ruleType === "all") return rows;
  const typePattern = ruleType === "deps" ? /-security-deps-v\d+$/i : /-security-patterns-v\d+$/i;
  return rows.filter((r) => typePattern.test(r.slug));
}

/** Generate or retrieve a summary for a single (stack, layer) pair. */
export async function runSummarizerForLayer(
  stackSlug: string,
  layerSlug: string,
  ruleType?: string,
  maxTokens?: number
): Promise<LayerSummary> {
  const rules = await fetchRulesForLayer(stackSlug, layerSlug, ruleType);

  const cacheKey = buildCacheKey(
    stackSlug,
    layerSlug,
    ruleType ?? "all",
    rules.map((r) => r.bodyMdx ?? r.id)
  );

  // Cache hit — return without calling LLM
  const [cached] = await db
    .select()
    .from(summarizedGuardrail)
    .where(and(
      eq(summarizedGuardrail.cacheKey, cacheKey),
      // treat as stale if expiresAt is set and in the past
      // (null expiresAt = never expires)
    ))
    .limit(1);

  if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
    const [layerRow] = await db
      .select({ name: layer.name })
      .from(layer)
      .where(eq(layer.slug, layerSlug))
      .limit(1);
    return {
      layerSlug,
      layerName: layerRow?.name ?? layerSlug,
      summarizedContent: cached.content,
      ruleCount: cached.sourceRuleIds.length,
      conflictCount: cached.conflictCount ?? 0,
      provenance: (cached.provenance as Record<string, ProvenanceEntry>) ?? {},
      generatedAt: cached.generatedAt.toISOString(),
      cacheKey,
      cacheHit: true,
    };
  }

  if (rules.length === 0) {
    return {
      layerSlug,
      layerName: layerSlug,
      summarizedContent: "",
      ruleCount: 0,
      conflictCount: 0,
      provenance: {},
      generatedAt: new Date().toISOString(),
      cacheKey,
      cacheHit: false,
    };
  }

  const [layerRow] = await db
    .select({ id: layer.id, slug: layer.slug, name: layer.name, concernStatement: layer.concernStatement })
    .from(layer)
    .where(eq(layer.slug, layerSlug))
    .limit(1);
  if (!layerRow) throw new Error(`layer_not_found:${layerSlug}`);

  const [stackRow] = await db
    .select({ id: stack.id, slug: stack.slug, name: stack.name })
    .from(stack)
    .where(eq(stack.slug, stackSlug))
    .limit(1);
  if (!stackRow) throw new Error("stack_not_found");

  const atoms = rules.flatMap((r) => parseRuleIntoAtoms(r.bodyMdx ?? "", r.id, layerSlug));
  const { resolved, conflictCount } = resolveConflicts(atoms);
  const deduped = deduplicateAtoms(resolved);

  const model =
    process.env.FEATURE_CERTIFIED_SUMMARIES === "true" ? "claude-opus-4-7" : "claude-sonnet-4-6";

  const prompt = buildSummarizerPrompt(deduped, [layerRow], stackRow, "all");

  const client = await createLLMClient();
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens ?? 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const summarizedContent =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  const provenance: Record<string, ProvenanceEntry> = {};
  for (const atom of deduped) {
    const key = atom.content.slice(0, 40);
    if (!provenance[key]) {
      provenance[key] = { sourceRuleIds: [], resolution: atom.conflictResolution ?? "kept" };
    }
    if (!provenance[key].sourceRuleIds.includes(atom.sourceRuleId)) {
      provenance[key].sourceRuleIds.push(atom.sourceRuleId);
    }
  }

  // Delete stale row if present, then insert fresh
  await db.delete(summarizedGuardrail).where(eq(summarizedGuardrail.cacheKey, cacheKey));
  await db.insert(summarizedGuardrail).values({
    stackId: stackRow.id,
    layerId: layerRow.id,
    ideSlug: "all",
    content: summarizedContent,
    sourceRuleIds: rules.map((r) => r.id),
    provenance,
    conflictCount,
    cacheKey,
    summarizerVersion: SUMMARIZER_VERSION,
  });

  return {
    layerSlug,
    layerName: layerRow.name,
    summarizedContent,
    ruleCount: rules.length,
    conflictCount,
    provenance,
    generatedAt: new Date().toISOString(),
    cacheKey,
    cacheHit: false,
  };
}

/** Generate summaries for all requested layers in parallel. */
export async function runSummarizer(req: SummarizeRequest): Promise<SummarizeResponse> {
  const FEATURE_SUMMARIZER = process.env.FEATURE_SUMMARIZER === "true";
  if (!FEATURE_SUMMARIZER) throw new Error("summarizer_disabled");

  const layers = await Promise.all(
    req.layerSlugs.map((slug) =>
      runSummarizerForLayer(req.stackSlug, slug, req.ruleType, req.maxTokens)
    )
  );

  const nonEmpty = layers.filter((l) => l.ruleCount > 0);
  if (nonEmpty.length === 0) throw new Error("no_rules_found");

  return { layers, stackSlug: req.stackSlug, generatedAt: new Date().toISOString() };
}

/** Streaming variant — streams each layer sequentially with layer headers. */
export async function* streamSummarizer(req: SummarizeRequest): AsyncGenerator<string> {
  const FEATURE_SUMMARIZER = process.env.FEATURE_SUMMARIZER === "true";
  if (!FEATURE_SUMMARIZER) throw new Error("summarizer_disabled");

  for (const layerSlug of req.layerSlugs) {
    const rules = await fetchRulesForLayer(req.stackSlug, layerSlug, req.ruleType);
    if (rules.length === 0) continue;

    const [layerRow] = await db
      .select({ id: layer.id, slug: layer.slug, name: layer.name, concernStatement: layer.concernStatement })
      .from(layer)
      .where(eq(layer.slug, layerSlug))
      .limit(1);
    if (!layerRow) continue;

    const [stackRow] = await db
      .select({ id: stack.id, slug: stack.slug, name: stack.name })
      .from(stack)
      .where(eq(stack.slug, req.stackSlug))
      .limit(1);
    if (!stackRow) throw new Error("stack_not_found");

    const atoms = rules.flatMap((r) => parseRuleIntoAtoms(r.bodyMdx ?? "", r.id, layerSlug));
    const { resolved } = resolveConflicts(atoms);
    const deduped = deduplicateAtoms(resolved);

    const model =
      process.env.FEATURE_CERTIFIED_SUMMARIES === "true" ? "claude-opus-4-7" : "claude-sonnet-4-6";
    const prompt = buildSummarizerPrompt(deduped, [layerRow], stackRow, "all");

    // Emit a layer header so the client knows which section is starting
    yield `\x00LAYER:${layerSlug}\x00`;

    const client = await createLLMClient();
    const stream = await client.messages.stream({
      model,
      max_tokens: req.maxTokens ?? 4096,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
