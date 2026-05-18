import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  const client = await pool.connect();
  try {
    console.log("Applying pending schema fixes...\n");

    // Check current state
    const colCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'rule_layer_map'
      ORDER BY ordinal_position
    `);
    console.log("Current rule_layer_map columns:");
    for (const row of colCheck.rows) {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    }

    const ptColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'policy_template' AND column_name = 'layer'
    `);

    const enumCheck = await client.query(`
      SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'threat_family' ORDER BY e.enumsortorder
    `);
    console.log("\nCurrent threat_family enum values:", enumCheck.rows.map((r: {enumlabel: string}) => r.enumlabel));

    const ruleLayerEnumCheck = await client.query(`
      SELECT typname FROM pg_type WHERE typname = 'rule_layer'
    `);
    console.log("rule_layer enum exists:", ruleLayerEnumCheck.rows.length > 0);

    // Fix 1: Drop legacy "layer" column from rule_layer_map
    const hasLegacyCol = colCheck.rows.some((r: {column_name: string}) => r.column_name === "layer");
    if (hasLegacyCol) {
      console.log("\n[FIX 1] Dropping legacy 'layer' column from rule_layer_map...");
      await client.query(`ALTER TABLE "rule_layer_map" DROP COLUMN IF EXISTS "layer"`);
      console.log("  ✓ Done");
    } else {
      console.log("\n[FIX 1] rule_layer_map.layer already dropped — skip");
    }

    // Fix 2: Drop legacy "layer" column from policy_template
    if (ptColCheck.rows.length > 0) {
      console.log("[FIX 2] Dropping legacy 'layer' column from policy_template...");
      await client.query(`ALTER TABLE "policy_template" DROP COLUMN IF EXISTS "layer"`);
      console.log("  ✓ Done");
    } else {
      console.log("[FIX 2] policy_template.layer already dropped — skip");
    }

    // Fix 3: Drop rule_layer enum type
    if (ruleLayerEnumCheck.rows.length > 0) {
      console.log("[FIX 3] Dropping old rule_layer enum type...");
      await client.query(`DROP TYPE IF EXISTS "public"."rule_layer"`);
      console.log("  ✓ Done");
    } else {
      console.log("[FIX 3] rule_layer enum already gone — skip");
    }

    // Fix 4: Add aigently_internal to threat_family enum
    const hasAigentlyInternal = enumCheck.rows.some((r: {enumlabel: string}) => r.enumlabel === "aigently_internal");
    if (!hasAigentlyInternal) {
      console.log("[FIX 4] Adding 'aigently_internal' to threat_family enum...");
      await client.query(`ALTER TYPE "public"."threat_family" ADD VALUE 'aigently_internal'`);
      console.log("  ✓ Done");
    } else {
      console.log("[FIX 4] aigently_internal already in threat_family — skip");
    }

    // Verify final state
    const finalCols = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'rule_layer_map' ORDER BY ordinal_position
    `);
    const finalEnum = await client.query(`
      SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'threat_family' ORDER BY e.enumsortorder
    `);
    console.log("\n✓ Final rule_layer_map columns:", finalCols.rows.map((r: {column_name: string}) => r.column_name));
    console.log("✓ Final threat_family values:", finalEnum.rows.map((r: {enumlabel: string}) => r.enumlabel));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
