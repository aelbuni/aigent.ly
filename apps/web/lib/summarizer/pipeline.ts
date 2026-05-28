import { and, eq } from "drizzle-orm";
import { db, layer, rule, ruleLayerMap, ruleStack, stack, summarizedGuardrail } from "@/lib/db";
import { computeQualityScore } from "@/lib/admin-queries";
import { parseRuleIntoAtoms } from "./atoms";
import { buildCacheKey, buildBatchCacheKeys } from "./cache";
import { resolveConflicts } from "./conflicts";
import { deduplicateAtoms } from "./dedup";
import { createLLMClient, getModelForTask } from "./llm-client";
import { buildSummarizerPrompt, buildMultiLayerBatchPrompt, MULTI_LAYER_TOOL, type BatchLayerInput } from "./prompt";

const SUMMARIZER_VERSION = "1.0";

type ProvenanceEntry = {
  sourceRuleIds: string[];
  resolution: "kept" | "merged" | "conflict_resolved" | "deduplicated";
};

export type LayerSummaryResult = {
  layerSlug: string;
  layerName: string;
  summarizedContent: string;
  ruleCount: number;
  conflictCount: number;
  cacheHit: boolean;
  cacheKey: string;
};

async function fetchRulesForLayer(
  stackSlug: string,
  layerSlug: string,
  ruleType?: string
) {
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

// ---------------------------------------------------------------------------
// Private helpers shared by runSummarizerForLayer and runSummarizerForStack
// ---------------------------------------------------------------------------

function buildProvenance(
  atoms: ReturnType<typeof deduplicateAtoms>
): Record<string, ProvenanceEntry> {
  const provenance: Record<string, ProvenanceEntry> = {};
  for (const atom of atoms) {
    const key = atom.content.slice(0, 40);
    if (!provenance[key]) {
      provenance[key] = { sourceRuleIds: [], resolution: atom.conflictResolution ?? "kept" };
    }
    if (!provenance[key].sourceRuleIds.includes(atom.sourceRuleId)) {
      provenance[key].sourceRuleIds.push(atom.sourceRuleId);
    }
  }
  return provenance;
}

async function persistGuardrail(params: {
  stackId: number;
  contentType: "patterns" | "deps";
  content: string;
  sourceRuleIds: string[];
  provenance: Record<string, ProvenanceEntry>;
  conflictCount: number;
  qualityScore: number;
  cacheKey: string;
  summarizerVersion: string;
}): Promise<void> {
  const { cacheKey, stackId, contentType, content, sourceRuleIds, provenance, conflictCount, qualityScore, summarizerVersion } = params;
  await db.delete(summarizedGuardrail).where(eq(summarizedGuardrail.cacheKey, cacheKey));
  await db.insert(summarizedGuardrail).values({
    stackId,
    contentType,
    content,
    sourceRuleIds,
    provenance,
    conflictCount,
    qualityScore,
    cacheKey,
    summarizerVersion,
  });
}

/** Generate or retrieve a cached summary for a single (stack, layer) pair.
 *  Pass `force: true` to bypass the cache and always regenerate. */
export async function runSummarizerForLayer(
  stackSlug: string,
  layerSlug: string,
  ruleType = "all",
  previousScore?: number,
  force = false,
): Promise<LayerSummaryResult> {
  const rules = await fetchRulesForLayer(stackSlug, layerSlug, ruleType);

  const cacheKey = buildCacheKey(
    stackSlug,
    layerSlug,
    ruleType,
    rules.map((r) => r.bodyMdx ?? r.id)
  );

  // Check for a valid cached row (skipped when force=true)
  if (!force) {
    const [cached] = await db
      .select()
      .from(summarizedGuardrail)
      .where(eq(summarizedGuardrail.cacheKey, cacheKey))
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
        cacheHit: true,
        cacheKey,
      };
    }
  }

  // No rules → return empty result (don't call LLM)
  if (rules.length === 0) {
    return {
      layerSlug,
      layerName: layerSlug,
      summarizedContent: "",
      ruleCount: 0,
      conflictCount: 0,
      cacheHit: false,
      cacheKey,
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

  const [model, client] = await Promise.all([
    getModelForTask("guardrail_summarization"),
    createLLMClient(),
  ]);

  const prompt = buildSummarizerPrompt(deduped, [layerRow], stackRow, previousScore);
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const summarizedContent =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  const provenance = buildProvenance(deduped);

  const qualityScore = computeQualityScore({
    conflictCount,
    sourceRuleCount: rules.length,
    contentLength: summarizedContent.length,
    generatedAt: new Date(),
  });

  // Delete stale row if present, then insert fresh
  const contentType: "patterns" | "deps" = ruleType === "deps" ? "deps" : "patterns";
  await persistGuardrail({
    stackId: stackRow.id,
    contentType,
    content: summarizedContent,
    sourceRuleIds: rules.map((r) => r.id),
    provenance,
    conflictCount,
    qualityScore,
    cacheKey,
    summarizerVersion: SUMMARIZER_VERSION,
  });

  return {
    layerSlug,
    layerName: layerRow.name,
    summarizedContent,
    ruleCount: rules.length,
    conflictCount,
    cacheHit: false,
    cacheKey,
  };
}

/**
 * Batch summarizer for all layers of a single stack in one LLM call.
 * Falls back to runSummarizerForLayer() for any layer the model omits.
 *
 * Yields progress via an optional callback so the SSE route can stream events
 * without waiting for the whole stack to complete.
 */
export async function runSummarizerForStack(
  stackSlug: string,
  layerSlugs: string[],
  ruleType = "all",
  onLayerComplete?: (result: LayerSummaryResult) => void,
  force = false,
): Promise<LayerSummaryResult[]> {
  if (layerSlugs.length === 0) return [];

  const [stackRow] = await db
    .select({ id: stack.id, slug: stack.slug, name: stack.name })
    .from(stack)
    .where(eq(stack.slug, stackSlug))
    .limit(1);
  if (!stackRow) throw new Error(`stack_not_found:${stackSlug}`);

  // Fetch rules and layer info for all layers in parallel
  const layerData = await Promise.all(
    layerSlugs.map(async (layerSlug) => {
      const [rules, layerRow] = await Promise.all([
        fetchRulesForLayer(stackSlug, layerSlug, ruleType),
        db.select({ id: layer.id, slug: layer.slug, name: layer.name, concernStatement: layer.concernStatement })
          .from(layer).where(eq(layer.slug, layerSlug)).limit(1).then((r) => r[0]),
      ]);
      return { layerSlug, rules, layerRow };
    })
  );

  // Build cache keys and check which layers need generation
  const layerRuleContents: Record<string, string[]> = {};
  for (const { layerSlug, rules } of layerData) {
    layerRuleContents[layerSlug] = rules.map((r) => r.bodyMdx ?? r.id);
  }
  const cacheKeys = buildBatchCacheKeys(stackSlug, ruleType, layerRuleContents);

  const results: LayerSummaryResult[] = [];
  const toGenerate: typeof layerData = [];

  for (const ld of layerData) {
    const { layerSlug, rules, layerRow } = ld;
    const cacheKey = cacheKeys[layerSlug];

    // Empty layer — return immediately without LLM
    if (rules.length === 0) {
      const result: LayerSummaryResult = {
        layerSlug,
        layerName: layerRow?.name ?? layerSlug,
        summarizedContent: "",
        ruleCount: 0,
        conflictCount: 0,
        cacheHit: false,
        cacheKey,
      };
      results.push(result);
      onLayerComplete?.(result);
      continue;
    }

    // Cache hit — return immediately (skipped when force=true)
    if (!force) {
      const [cached] = await db
        .select()
        .from(summarizedGuardrail)
        .where(eq(summarizedGuardrail.cacheKey, cacheKey))
        .limit(1);

      if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
        const result: LayerSummaryResult = {
          layerSlug,
          layerName: layerRow?.name ?? layerSlug,
          summarizedContent: cached.content,
          ruleCount: cached.sourceRuleIds.length,
          conflictCount: cached.conflictCount ?? 0,
          cacheHit: true,
          cacheKey,
        };
        results.push(result);
        onLayerComplete?.(result);
        continue;
      }
    }

    toGenerate.push(ld);
  }

  // All layers already cached
  if (toGenerate.length === 0) return results;

  // Build atoms for all layers that need generation
  const batchInputs: BatchLayerInput[] = toGenerate
    .filter((ld) => ld.layerRow !== undefined)
    .map(({ layerSlug, rules, layerRow }) => {
      const atoms = rules.flatMap((r) => parseRuleIntoAtoms(r.bodyMdx ?? "", r.id, layerSlug));
      const { resolved } = resolveConflicts(atoms);
      const deduped = deduplicateAtoms(resolved);
      return {
        layer: layerRow!,
        atoms: deduped,
        sourceRuleIds: [...new Set(rules.map((r) => r.id))],
      };
    });

  const [model, client] = await Promise.all([
    getModelForTask("guardrail_summarization"),
    createLLMClient(),
  ]);

  const prompt = buildMultiLayerBatchPrompt(batchInputs, stackRow);

  let toolResponse: { layerSlug: string; content: string; conflictCount: number }[] = [];

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 8192,
      tools: [MULTI_LAYER_TOOL],
      tool_choice: { type: "tool", name: "produce_stack_guardrails" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (toolUse?.type === "tool_use") {
      const input = toolUse.input as { guardrails: { layerSlug: string; content: string; conflictCount: number }[] };
      toolResponse = input.guardrails ?? [];
    }
  } catch {
    // LLM call failed — fall back entirely to per-layer calls below
  }

  // Process tool response: store each returned layer
  const respondedSlugs = new Set<string>();

  for (const item of toolResponse) {
    const ld = toGenerate.find((d) => d.layerSlug === item.layerSlug);
    if (!ld || !ld.layerRow) continue;

    const { layerSlug, rules, layerRow } = ld;
    const cacheKey = cacheKeys[layerSlug];
    respondedSlugs.add(layerSlug);

    const atoms = rules.flatMap((r) => parseRuleIntoAtoms(r.bodyMdx ?? "", r.id, layerSlug));
    const { resolved, conflictCount } = resolveConflicts(atoms);
    const deduped = deduplicateAtoms(resolved);
    const provenance = buildProvenance(deduped);

    const batchQualityScore = computeQualityScore({
      conflictCount: item.conflictCount ?? conflictCount,
      sourceRuleCount: rules.length,
      contentLength: item.content.length,
      generatedAt: new Date(),
    });

    const batchContentType: "patterns" | "deps" = ruleType === "deps" ? "deps" : "patterns";
    await persistGuardrail({
      stackId: stackRow.id,
      contentType: batchContentType,
      content: item.content,
      sourceRuleIds: rules.map((r) => r.id),
      provenance,
      conflictCount: item.conflictCount ?? conflictCount,
      qualityScore: batchQualityScore,
      cacheKey,
      summarizerVersion: SUMMARIZER_VERSION,
    });

    const result: LayerSummaryResult = {
      layerSlug,
      layerName: layerRow.name,
      summarizedContent: item.content,
      ruleCount: rules.length,
      conflictCount: item.conflictCount ?? conflictCount,
      cacheHit: false,
      cacheKey,
    };
    results.push(result);
    onLayerComplete?.(result);
  }

  // Fallback: any layer the model skipped → individual call
  const skippedLayers = toGenerate.filter((ld) => !respondedSlugs.has(ld.layerSlug));
  for (const { layerSlug } of skippedLayers) {
    const result = await runSummarizerForLayer(stackSlug, layerSlug, ruleType);
    results.push(result);
    onLayerComplete?.(result);
  }

  return results;
}

/** Bulk generate for all active (stack, layer) pairs matching the requested mode. */
export async function bulkRunSummarizer(
  mode: "empty" | "stale" | "all"
): Promise<{ generated: number; skipped: number; errors: string[] }> {
  // Guardrails are now keyed by (stack, contentType). Discover stacks that have rules.
  const stackRows = await db
    .selectDistinct({ stackSlug: stack.slug, stackId: stack.id })
    .from(rule)
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId));

  const CONTENT_TYPES: Array<"patterns" | "deps"> = ["patterns", "deps"];
  const now = new Date();
  let generated = 0;
  const errors: string[] = [];

  for (const { stackSlug, stackId } of stackRows) {
    const ruleTypesToProcess: Array<"patterns" | "deps"> = [];

    for (const contentType of CONTENT_TYPES) {
      const ruleType = contentType; // "patterns" | "deps"
      const shouldGenerate = await (async () => {
        if (mode === "all") return true;
        const [existing] = await db
          .select({ id: summarizedGuardrail.id, expiresAt: summarizedGuardrail.expiresAt })
          .from(summarizedGuardrail)
          .where(
            and(
              eq(summarizedGuardrail.stackId, stackId),
              eq(summarizedGuardrail.contentType, ruleType)
            )
          )
          .limit(1);
        if (mode === "empty") return !existing;
        return !existing || (existing.expiresAt !== null && existing.expiresAt < now);
      })();
      if (shouldGenerate) ruleTypesToProcess.push(contentType);
    }

    if (ruleTypesToProcess.length === 0) continue;

    // Use a representative layer slug for summarizer calls (patterns → auth_session, deps → dependency_supply)
    const layerSlugForType = (ct: "patterns" | "deps") =>
      ct === "deps" ? "dependency_supply" : "auth_session";

    try {
      const layerSlugsToProcess = ruleTypesToProcess.map(layerSlugForType);
      const stackResults = await runSummarizerForStack(stackSlug, layerSlugsToProcess);
      for (const r of stackResults) {
        if (r.ruleCount > 0) generated++;
      }
    } catch (e) {
      errors.push(`${stackSlug}: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Rate-limit between stack batches
    await new Promise((r) => setTimeout(r, 300));
  }

  const totalPossible = stackRows.length * CONTENT_TYPES.length;
  return { generated, skipped: totalPossible - generated - errors.length, errors };
}
