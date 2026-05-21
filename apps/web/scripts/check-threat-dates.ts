import "../lib/load-web-env";
import { db, threat, pool } from "../lib/db";
import { desc, isNull } from "drizzle-orm";
async function main() {
  const nullRows = await db.select({ id: threat.publicId }).from(threat).where(isNull(threat.publishedAt));
  console.log("Threats with null publishedAt:", nullRows.length);
  const top5 = await db.select({ publicId: threat.publicId, publishedAt: threat.publishedAt })
    .from(threat).orderBy(desc(threat.publishedAt), desc(threat.publicId)).limit(5);
  console.log("Top 5 newest by publishedAt DESC:", top5.map(t => ({
    pub: t.publishedAt?.toISOString().substring(0,10) ?? "null",
    id: t.publicId.substring(0,35)
  })));
}
main().catch(e => console.error(e)).finally(() => pool.end());
