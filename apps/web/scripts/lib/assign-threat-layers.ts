import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  owaspLayerMapping,
  sourceLayerMapping,
  threat,
  threatLayer,
} from "../../lib/db";

/**
 * Auto-assigns threatLayer rows for a batch of threat publicIds based on:
 * 1. sourceLayerMapping — which DB source maps to which layer
 * 2. owaspLayerMapping — which OWASP ref maps to which layer
 *
 * Called post-upsert in sync-threats.ts Phase 6.
 */
export async function assignThreatLayers(publicIds: string[]): Promise<void> {
  if (publicIds.length === 0) return;

  const [sourceMappings, owaspMappings, threats] = await Promise.all([
    db
      .select({ source: sourceLayerMapping.source, layerId: sourceLayerMapping.layerId, relevance: sourceLayerMapping.relevance })
      .from(sourceLayerMapping)
      .where(eq(sourceLayerMapping.isActive, true)),
    db
      .select({ owaspRef: owaspLayerMapping.owaspRef, layerId: owaspLayerMapping.layerId, relevance: owaspLayerMapping.relevance })
      .from(owaspLayerMapping)
      .where(eq(owaspLayerMapping.isActive, true)),
    db
      .select({ publicId: threat.publicId, source: threat.source, owaspRefs: threat.owaspRefs })
      .from(threat)
      .where(inArray(threat.publicId, publicIds)),
  ]);

  const sourceMap = new Map<string, { layerId: string; relevance: string }[]>();
  for (const m of sourceMappings) {
    const existing = sourceMap.get(m.source) ?? [];
    existing.push({ layerId: m.layerId, relevance: m.relevance ?? "primary" });
    sourceMap.set(m.source, existing);
  }

  const owaspMap = new Map<string, { layerId: string; relevance: string }[]>();
  for (const m of owaspMappings) {
    const existing = owaspMap.get(m.owaspRef) ?? [];
    existing.push({ layerId: m.layerId, relevance: m.relevance ?? "primary" });
    owaspMap.set(m.owaspRef, existing);
  }

  const rows: { threatId: string; layerId: string; relevance: string }[] = [];
  const seen = new Set<string>();

  for (const t of threats) {
    // Source-based mappings
    for (const m of sourceMap.get(t.source ?? "") ?? []) {
      const key = `${t.publicId}:${m.layerId}`;
      if (!seen.has(key)) {
        rows.push({ threatId: t.publicId, layerId: m.layerId, relevance: m.relevance });
        seen.add(key);
      }
    }
    // OWASP-ref-based mappings
    for (const ref of t.owaspRefs ?? []) {
      for (const m of owaspMap.get(ref) ?? []) {
        const key = `${t.publicId}:${m.layerId}`;
        if (!seen.has(key)) {
          rows.push({ threatId: t.publicId, layerId: m.layerId, relevance: m.relevance });
          seen.add(key);
        }
      }
    }
  }

  if (rows.length === 0) return;

  // Batch insert in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(threatLayer)
      .values(rows.slice(i, i + CHUNK).map((r) => ({
        threatId: r.threatId,
        layerId: r.layerId,
        relevance: r.relevance as "primary" | "secondary",
      })))
      .onConflictDoNothing();
  }

  console.log(`  ✓ assignThreatLayers: ${rows.length} threat_layer rows upserted for ${publicIds.length} threats`);
}
