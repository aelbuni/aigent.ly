import { isShippableThreat } from "@aigently/mvp-catalog";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "@aigently/db/schema";

import type { CatalogSnapshotV1 } from "./catalogTypes.js";

export async function upsertCatalogToDb(snapshot: CatalogSnapshotV1, connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  try {
    const shippedIds = new Set(
      snapshot.threats
        .filter((t) =>
          isShippableThreat({
            publicId: t.publicId,
            cveId: t.cveId ?? null,
            sourceUrl: t.sourceUrl ?? null,
          })
        )
        .map((t) => t.publicId)
    );

    for (const t of snapshot.threats) {
      if (
        !isShippableThreat({
          publicId: t.publicId,
          cveId: t.cveId ?? null,
          sourceUrl: t.sourceUrl ?? null,
        })
      ) {
        continue;
      }
      await db
        .insert(schema.threat)
        .values({
          publicId: t.publicId,
          family: t.family,
          name: t.name,
          severity: t.severity ?? undefined,
          description: t.description ?? undefined,
          externalId: t.externalId ?? t.publicId,
          cveId: t.cveId ?? undefined,
          source: t.source ?? "cisa_kev",
          sourceUrl: t.sourceUrl ?? undefined,
          isActivelyExploited: t.isActivelyExploited ?? false,
        })
        .onConflictDoUpdate({
          target: schema.threat.publicId,
          set: {
            name: t.name,
            severity: t.severity ?? null,
            description: t.description ?? null,
            externalId: t.externalId ?? t.publicId,
            cveId: t.cveId ?? null,
            source: t.source ?? "cisa_kev",
            sourceUrl: t.sourceUrl ?? null,
            isActivelyExploited: t.isActivelyExploited ?? false,
            updatedAt: new Date(),
          },
        });
    }

    const stacks = await db.select().from(schema.stack);
    const stackIdBySlug = new Map(stacks.map((s) => [s.slug, s.id]));

    for (const row of snapshot.threatStacks) {
      if (!shippedIds.has(row.threatPublicId)) continue;
      const stackId = stackIdBySlug.get(row.stackSlug);
      if (stackId === undefined) continue;
      await db
        .insert(schema.threatStack)
        .values({
          threatId: row.threatPublicId,
          stackId,
          severity: row.severity,
          isMitigatedByRules: row.isMitigatedByRules,
        })
        .onConflictDoUpdate({
          target: [schema.threatStack.threatId, schema.threatStack.stackId],
          set: {
            severity: row.severity,
            isMitigatedByRules: row.isMitigatedByRules,
          },
        });
    }

    await db.insert(schema.syncLog).values({
      finishedAt: new Date(),
      status: "ok",
      sourceSummary: snapshot.syncMeta as Record<string, unknown>,
    });

    await db.execute(sql`REFRESH MATERIALIZED VIEW rule_weekly_usage`);
  } finally {
    await pool.end();
  }
}
