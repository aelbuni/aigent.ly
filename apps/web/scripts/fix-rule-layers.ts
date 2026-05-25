/**
 * Reassign all existing stack rules to the correct layers based on rule type.
 * - patterns rules → auth_session, input_validation, authz_access, secrets_credentials
 * - deps rules    → dependency_supply, auth_session
 *
 * Run: npx tsx scripts/fix-rule-layers.ts
 */
import "../lib/load-web-env";
import { db, layer, rule, ruleLayerMap, pool } from "../lib/db";
import { eq, inArray } from "drizzle-orm";

async function main() {
  // Load all layers
  const allLayers = await db.select({ id: layer.id, slug: layer.slug }).from(layer);
  const layerBySlug = new Map(allLayers.map(l => [l.slug, l.id]));

  const patternLayerSlugs = ["auth_session", "input_validation", "authz_access", "secrets_credentials"];
  const depsLayerSlugs = ["dependency_supply", "auth_session"];

  // Load all rules
  const allRules = await db.select({ id: rule.id, slug: rule.slug }).from(rule);
  console.log(`Found ${allRules.length} rules`);

  let updated = 0;
  for (const r of allRules) {
    const isPatterns = /-security-patterns-v\d+$/i.test(r.slug);
    const isDeps = /-security-deps-v\d+$/i.test(r.slug);
    if (!isPatterns && !isDeps) {
      console.log(`  Skipping non-stack rule: ${r.slug}`);
      continue;
    }

    const targetSlugs = isPatterns ? patternLayerSlugs : depsLayerSlugs;

    // Delete existing layer assignments
    await db.delete(ruleLayerMap).where(eq(ruleLayerMap.ruleId, r.id));

    // Insert new assignments one by one (sequential to avoid pooler limits)
    for (const slug of targetSlugs) {
      const layerId = layerBySlug.get(slug);
      if (!layerId) {
        console.warn(`  Layer not found: ${slug}`);
        continue;
      }
      await db.insert(ruleLayerMap).values({ ruleId: r.id, layerId }).onConflictDoNothing();
    }

    console.log(`  ${r.slug} → [${targetSlugs.join(", ")}]`);
    updated++;
  }

  console.log(`\nDone: updated ${updated} rules across ${patternLayerSlugs.length + 1} layer types`);

  // Verify
  const counts = await db
    .select({ slug: rule.slug, cnt: db.$count(ruleLayerMap, eq(ruleLayerMap.ruleId, rule.id)) })
    .from(rule);
  for (const c of counts) {
    console.log(`  ${c.slug}: ${c.cnt} layers`);
  }
}

main()
  .catch(err => { console.error("Fatal:", err.message); process.exitCode = 1; })
  .finally(() => pool.end());
