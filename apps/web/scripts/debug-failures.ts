import { db, rule, ruleLayerMap, layer, threat } from "@/lib/db";
import { eq } from "drizzle-orm";

async function main() {
  // --- Debug 1: ruleLayerMap insert ---
  console.log("--- Debug: ruleLayerMap insert ---");
  try {
    const [r] = await db.select({ id: rule.id }).from(rule).limit(1);
    const [l] = await db.select({ id: layer.id }).from(layer).limit(1);
    console.log("ruleId:", r?.id, "layerId:", l?.id);
    if (r && l) {
      const existing = await db.select().from(ruleLayerMap).where(eq(ruleLayerMap.ruleId, r.id));
      console.log("existing mappings:", existing.length);
      await db.delete(ruleLayerMap).where(eq(ruleLayerMap.ruleId, r.id));
      await db.insert(ruleLayerMap).values({ ruleId: r.id, layerId: l.id });
      console.log("ruleLayerMap insert: OK");
      // restore
      await db.delete(ruleLayerMap).where(eq(ruleLayerMap.ruleId, r.id));
      if (existing.length > 0) {
        await db.insert(ruleLayerMap).values(existing.map(e => ({ ruleId: e.ruleId, layerId: e.layerId })));
      }
    }
  } catch (e: unknown) {
    const err = e as { message: string; detail?: string; hint?: string; code?: string };
    console.error("ruleLayerMap error:", err.message);
    console.error("  detail:", err.detail ?? "none");
    console.error("  hint:", err.hint ?? "none");
    console.error("  code:", err.code ?? "none");
  }

  // --- Debug 2: threat insert ---
  console.log("\n--- Debug: threat insert (family=aigently_internal) ---");
  try {
    // Check the enum values
    const result = await db.execute(
      `SELECT unnest(enum_range(NULL::threat_family))::text AS val`
    );
    console.log("threat_family enum values:", result.rows.map((r: Record<string,unknown>) => r.val));
  } catch(e: unknown) {
    console.error("enum check error:", (e as Error).message);
  }
  try {
    const publicId = `AIGENT-TEST-DBG-${Date.now()}`;
    await db.insert(threat).values({
      publicId,
      family: "aigently_internal" as never,
      name: "Debug threat",
      source: "aigently_internal",
      owaspRefs: [],
      mitreAttackIds: [],
      affectedProducts: {},
      details: {},
    });
    console.log("threat insert: OK");
    await db.delete(threat).where(eq(threat.publicId, publicId));
  } catch (e: unknown) {
    const err = e as { message: string; detail?: string; hint?: string; code?: string };
    console.error("threat insert error:", err.message);
    console.error("  detail:", err.detail ?? "none");
    console.error("  hint:", err.hint ?? "none");
    console.error("  code:", err.code ?? "none");
  }
}

main().catch(console.error).finally(() => process.exit(0));
