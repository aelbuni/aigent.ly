"use server";

import { sql } from "drizzle-orm";
import { db, rule, ruleUsageDaily } from "@/lib/db";

/**
 * Increment copy_count for the given rule slugs on today's bucket.
 * Called from the Composer "Generate file" and rule card copy buttons.
 * Fire-and-forget — silently swallows errors so it never blocks the UI.
 */
export async function trackRuleUse(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Resolve slugs → rule UUIDs in one query
    const rows = await db
      .select({ id: rule.id })
      .from(rule)
      .where(sql`${rule.slug} = ANY(${sql`ARRAY[${sql.join(slugs.map((s) => sql`${s}`), sql`, `)}]::text[]`})`);

    if (rows.length === 0) return;

    // Upsert one row per rule — increment copy_count on conflict
    for (const { id } of rows) {
      await db
        .insert(ruleUsageDaily)
        .values({ ruleId: id, bucketDate: today, copyCount: 1 })
        .onConflictDoUpdate({
          target: [ruleUsageDaily.ruleId, ruleUsageDaily.bucketDate],
          set: {
            copyCount: sql`${ruleUsageDaily.copyCount} + 1`,
          },
        });
    }
  } catch {
    // Non-critical — never break the UI over analytics
  }
}
