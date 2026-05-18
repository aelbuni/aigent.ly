import "dotenv/config";
import { db, rule, ruleLayerMap, layer, threat } from "@/lib/db";
import { eq } from "drizzle-orm";

async function main() {
  // 1. Check threat family enum vs schema
  console.log("--- threat_family enum check ---");
  const families = ["owasp_web", "owasp_llm", "mitre_atlas", "vibe_coding", "aigently_internal"];
  console.log("Schema family enum values in code:", families);
  
  // 2. Try a minimal threat insert with 'vibe_coding' (known valid)
  console.log("\n--- threat insert with vibe_coding ---");
  const tid1 = `AIGENT-TEST-VC-${Date.now()}`;
  try {
    await db.insert(threat).values({
      publicId: tid1,
      family: "vibe_coding",
      name: "VC Test",
      source: "aigently_internal",
      owaspRefs: [],
      mitreAttackIds: [],
      affectedProducts: {},
      details: {},
    });
    console.log("vibe_coding insert: OK");
    await db.delete(threat).where(eq(threat.publicId, tid1));
  } catch(e: unknown) {
    console.error("vibe_coding error:", (e as Error).message);
  }
  
  // 3. Try 'aigently_internal' — this is the failing one
  console.log("\n--- threat insert with aigently_internal ---");
  const tid2 = `AIGENT-TEST-AI-${Date.now()}`;
  try {
    await db.insert(threat).values({
      publicId: tid2,
      family: "aigently_internal" as "owasp_web",  // force type
      name: "AI Test",
      source: "aigently_internal",
      owaspRefs: [],
      mitreAttackIds: [],
      affectedProducts: {},
      details: {},
    });
    console.log("aigently_internal insert: OK");
    await db.delete(threat).where(eq(threat.publicId, tid2));
  } catch(e: unknown) {
    console.error("aigently_internal error:", (e as Error).message);
    // Check what values are in the DB enum
    try {
      const result = await db.execute(
        `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'threat_family' ORDER BY e.enumsortorder`
      );
      console.log("DB enum values:", result.rows.map((r: Record<string,unknown>) => r.enumlabel));
    } catch(e2) {
      console.error("enum query error:", (e2 as Error).message);
    }
  }

  // 4. ruleLayerMap - test connection directly
  console.log("\n--- ruleLayerMap insert test ---");
  try {
    // First just get a rule id
    const rules = await db.select({ id: rule.id, slug: rule.slug }).from(rule).limit(1);
    console.log("rule fetched:", rules[0]?.slug);
    const layers = await db.select({ id: layer.id, name: layer.name }).from(layer).limit(1);
    console.log("layer fetched:", layers[0]?.name);
    
    if (rules[0] && layers[0]) {
      const ruleId = rules[0].id;
      const layerId = layers[0].id;
      // Backup existing
      const existing = await db.select().from(ruleLayerMap).where(eq(ruleLayerMap.ruleId, ruleId));
      console.log("existing ruleLayerMap rows:", existing.length);
      await db.delete(ruleLayerMap).where(eq(ruleLayerMap.ruleId, ruleId));
      await db.insert(ruleLayerMap).values({ ruleId, layerId });
      console.log("ruleLayerMap insert: OK");
      // restore
      await db.delete(ruleLayerMap).where(eq(ruleLayerMap.ruleId, ruleId));
      if (existing.length > 0) {
        await db.insert(ruleLayerMap).values(existing.map(e => ({ ruleId: e.ruleId, layerId: e.layerId })));
      }
    }
  } catch(e: unknown) {
    const err = e as {message: string; cause?: unknown};
    console.error("ruleLayerMap error:", err.message);
    if (err.cause) console.error("  cause:", err.cause);
  }
}

main().catch(console.error).finally(() => process.exit(0));
