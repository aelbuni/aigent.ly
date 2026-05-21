import "../lib/load-web-env";
import { db, threat, threatStack, stack, pool } from "../lib/db";
import { eq, sql, desc } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({ publicId: threat.publicId, publishedAt: threat.publishedAt, severity: threat.severity })
    .from(threat)
    .innerJoin(threatStack, eq(threatStack.threatId, threat.publicId))
    .innerJoin(stack, eq(stack.id, threatStack.stackId))
    .where(eq(stack.catalogStatus, "launch"))
    .orderBy(sql`${threat.publishedAt} DESC NULLS LAST`, desc(threat.publicId))
    .limit(5);
  console.log("First 5 threats (should be newest):");
  rows.forEach(r => console.log(`  ${r.publicId.padEnd(40)} pub=${r.publishedAt?.toISOString().substring(0,10) ?? 'null'} sev=${r.severity}`));
}
main().catch(e => console.error(e)).finally(() => pool.end());
