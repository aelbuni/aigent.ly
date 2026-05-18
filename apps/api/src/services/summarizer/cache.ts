import { createHash } from "node:crypto";

/**
 * Builds a cache key for a single (stack, layer) summary.
 * IDE dimension is intentionally excluded — content is the same regardless of IDE;
 * formatting is applied at render time.
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
