import { createHash } from "crypto";

/**
 * Builds a cache key for a single (stack, layer) summary.
 * IDE dimension excluded — content is the same regardless of IDE.
 */
export function buildCacheKey(
  stackSlug: string,
  layerSlug: string,
  ruleType: string,
  ruleContents: string[]
): string {
  const contentHash = ruleContents
    .map((c) => createHash("sha256").update(c).digest("hex").slice(0, 8))
    .sort()
    .join("|");
  return `summarize:${stackSlug}:${layerSlug}:${ruleType}:${contentHash}`;
}

/**
 * Builds per-layer cache keys for a multi-layer batch call.
 * Each layer still gets its own individual key (same format as buildCacheKey)
 * so results can be stored and invalidated independently — no schema change needed.
 *
 * Returns a map of layerSlug → cache key.
 */
export function buildBatchCacheKeys(
  stackSlug: string,
  ruleType: string,
  layerRuleContents: Record<string, string[]> // layerSlug → rule body array
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [layerSlug, contents] of Object.entries(layerRuleContents)) {
    result[layerSlug] = buildCacheKey(stackSlug, layerSlug, ruleType, contents);
  }
  return result;
}
