import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  const client = await pool.connect();
  try {
    // 1. Check rule table select
    console.log("--- rule SELECT ---");
    try {
      const r = await client.query("SELECT id FROM rule LIMIT 1");
      console.log("rule SELECT OK:", r.rows[0]);
      const ruleId = r.rows[0]?.id;
      const l = await client.query("SELECT id FROM layer LIMIT 1");
      const layerId = l.rows[0]?.id;
      console.log("ruleId:", ruleId, "layerId:", layerId);
      if (ruleId && layerId) {
        console.log("\n--- ruleLayerMap DELETE + INSERT ---");
        const existing = await client.query("SELECT rule_id, layer_id FROM rule_layer_map WHERE rule_id = $1", [ruleId]);
        console.log("existing rows:", existing.rows.length);
        await client.query("DELETE FROM rule_layer_map WHERE rule_id = $1", [ruleId]);
        await client.query("INSERT INTO rule_layer_map (rule_id, layer_id) VALUES ($1, $2)", [ruleId, layerId]);
        console.log("INSERT OK");
        await client.query("DELETE FROM rule_layer_map WHERE rule_id = $1 AND layer_id = $2", [ruleId, layerId]);
        if (existing.rows.length > 0) {
          for (const row of existing.rows) {
            await client.query("INSERT INTO rule_layer_map (rule_id, layer_id) VALUES ($1, $2)", [row.rule_id, row.layer_id]);
          }
        }
      }
    } catch(e: unknown) {
      const err = e as {message:string; detail?:string; hint?:string; code?:string; table?:string};
      console.error("ERROR:", err.message, "| code:", err.code, "| detail:", err.detail, "| table:", err.table);
    }

    // 2. Check threat_family enum
    console.log("\n--- threat_family enum ---");
    try {
      const en = await client.query("SELECT unnest(enum_range(NULL::threat_family))::text AS val");
      console.log("enum values:", en.rows.map((r: {val: string}) => r.val));
    } catch(e: unknown) {
      const err = e as {message:string; detail?:string};
      console.error("enum error:", err.message, err.detail);
    }

    // 3. Threat insert
    console.log("\n--- threat INSERT ---");
    try {
      const tid = `AIGENT-TEST-RAW-${Date.now()}`;
      await client.query(
        `INSERT INTO threat (public_id, family, name, source, mitre_attack_ids, owasp_refs, affected_products, details)
         VALUES ($1, $2, $3, $4, ARRAY[]::text[], ARRAY[]::text[], '{}', '{}')`,
        [tid, "aigently_internal", "Debug", "aigently_internal"]
      );
      console.log("threat INSERT OK");
      await client.query("DELETE FROM threat WHERE public_id = $1", [tid]);
    } catch(e: unknown) {
      const err = e as {message:string; detail?:string; hint?:string; code?:string};
      console.error("threat INSERT error:", err.message, "| code:", err.code, "| detail:", err.detail, "| hint:", err.hint);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
