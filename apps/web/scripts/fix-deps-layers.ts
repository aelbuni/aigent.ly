import "../lib/load-web-env";
import { db, rule, layer, ruleLayerMap, pool } from "../lib/db";
import { eq, inArray, like } from "drizzle-orm";

async function main() {
  const authLayer = await db.select({ id: layer.id }).from(layer).where(eq(layer.slug, "auth_session")).then(r => r[0]);
  if (!authLayer) { console.error("auth_session layer not found"); return; }

  const depsRules = await db.select({ id: rule.id, slug: rule.slug }).from(rule).where(like(rule.slug, "%-security-deps-v%"));
  console.log("Deps rules found:", depsRules.map(r => r.slug));

  const ids = depsRules.map(r => r.id);
  if (ids.length === 0) { console.log("No deps rules found"); return; }

  const deleted = await db.delete(ruleLayerMap)
    .where(inArray(ruleLayerMap.ruleId, ids))
    .returning({ ruleId: ruleLayerMap.ruleId, layerId: ruleLayerMap.layerId });

  const authSessionRemovals = deleted.filter(d => d.layerId === authLayer.id);
  console.log(`Removed ${authSessionRemovals.length} auth_session entries from deps rules`);
  console.log(`Total layer entries removed: ${deleted.length}`);

  // Re-insert only dependency_supply for all deps rules
  const depplyLayer = await db.select({ id: layer.id }).from(layer).where(eq(layer.slug, "dependency_supply")).then(r => r[0]);
  if (!depplyLayer) { console.error("dependency_supply layer not found"); return; }

  for (const r of depsRules) {
    await db.insert(ruleLayerMap).values({ ruleId: r.id, layerId: depplyLayer.id }).onConflictDoNothing();
    console.log(`  Re-assigned ${r.slug} → dependency_supply`);
  }
  console.log("Done.");
}

main()
  .catch(err => { console.error("Fatal:", err.message); process.exitCode = 1; })
  .finally(() => pool.end());
