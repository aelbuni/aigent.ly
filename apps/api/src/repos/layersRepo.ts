import { and, asc, countDistinct, eq, sql } from "drizzle-orm";

import {
  layer,
  rule,
  ruleLayerMap,
  ruleStack,
  stack,
  threatLayer,
} from "@aigently/db/schema";

import { db } from "../lib/db.js";

export type LayerRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  concernStatement: string;
  iconName: string | null;
  colorToken: string | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type LayerWithStats = LayerRow & {
  ruleCount: number;
  threatCount: number;
  stackCount: number;
};

export type LayerForStack = LayerRow & {
  ruleCount: number;
  isActive: boolean;
};

function mapLayer(row: typeof layer.$inferSelect): LayerRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    concernStatement: row.concernStatement,
    iconName: row.iconName ?? null,
    colorToken: row.colorToken ?? null,
    isSystem: row.isSystem,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export async function listActiveLayers(): Promise<LayerRow[]> {
  const rows = await db
    .select()
    .from(layer)
    .where(eq(layer.isActive, true))
    .orderBy(asc(layer.sortOrder));
  return rows.map(mapLayer);
}

export async function getLayerBySlug(slug: string): Promise<LayerRow | null> {
  const rows = await db.select().from(layer).where(eq(layer.slug, slug)).limit(1);
  return rows[0] ? mapLayer(rows[0]) : null;
}

export async function listLayersWithStats(): Promise<LayerWithStats[]> {
  const rows = await db
    .select({
      id: layer.id,
      slug: layer.slug,
      name: layer.name,
      description: layer.description,
      concernStatement: layer.concernStatement,
      iconName: layer.iconName,
      colorToken: layer.colorToken,
      isSystem: layer.isSystem,
      isActive: layer.isActive,
      sortOrder: layer.sortOrder,
      ruleCount: sql<number>`(
        SELECT COUNT(DISTINCT rlm.rule_id)::int
        FROM rule_layer_map rlm
        WHERE rlm.layer_id = ${layer.id}
      )`.as("ruleCount"),
      threatCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM threat_layer tl
        WHERE tl.layer_id = ${layer.id}
      )`.as("threatCount"),
      stackCount: sql<number>`(
        SELECT COUNT(DISTINCT rs.stack_id)::int
        FROM rule_layer_map rlm
        JOIN rule_stack rs ON rs.rule_id = rlm.rule_id
        WHERE rlm.layer_id = ${layer.id}
      )`.as("stackCount"),
    })
    .from(layer)
    .where(eq(layer.isActive, true))
    .orderBy(asc(layer.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    concernStatement: r.concernStatement,
    iconName: r.iconName ?? null,
    colorToken: r.colorToken ?? null,
    isSystem: r.isSystem,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    ruleCount: r.ruleCount ?? 0,
    threatCount: r.threatCount ?? 0,
    stackCount: r.stackCount ?? 0,
  }));
}

export async function listLayersForStack(stackSlug: string): Promise<LayerForStack[]> {
  const rows = await db
    .selectDistinct({
      id: layer.id,
      slug: layer.slug,
      name: layer.name,
      description: layer.description,
      concernStatement: layer.concernStatement,
      iconName: layer.iconName,
      colorToken: layer.colorToken,
      isSystem: layer.isSystem,
      isActive: layer.isActive,
      sortOrder: layer.sortOrder,
      ruleCount: sql<number>`(
        SELECT COUNT(DISTINCT rlm.rule_id)::int
        FROM rule_layer_map rlm
        JOIN rule_stack rs ON rs.rule_id = rlm.rule_id
        JOIN stack s ON s.id = rs.stack_id
        WHERE rlm.layer_id = ${layer.id} AND s.slug = ${stackSlug}
      )`.as("ruleCount"),
    })
    .from(rule)
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId))
    .innerJoin(ruleLayerMap, eq(ruleLayerMap.ruleId, rule.id))
    .innerJoin(layer, eq(layer.id, ruleLayerMap.layerId))
    .where(and(eq(stack.slug, stackSlug), eq(layer.isActive, true)))
    .orderBy(asc(layer.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    concernStatement: r.concernStatement,
    iconName: r.iconName ?? null,
    colorToken: r.colorToken ?? null,
    isSystem: r.isSystem,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    ruleCount: r.ruleCount ?? 0,
  }));
}

export type ThreatForLayerRow = {
  threatId: string;
  name: string;
  severity: string | null;
  cveId: string | null;
  relevance: string | null;
  rationale: string | null;
};

export async function listThreatsForLayer(layerSlug: string): Promise<ThreatForLayerRow[]> {
  const layerRow = await getLayerBySlug(layerSlug);
  if (!layerRow) return [];

  const rows = await db.execute(sql`
    SELECT t.public_id AS "threatId", t.name, t.severity, t.cve_id AS "cveId",
           tl.relevance, tl.rationale
    FROM threat_layer tl
    JOIN threat t ON t.public_id = tl.threat_id
    WHERE tl.layer_id = ${layerRow.id}
    ORDER BY
      CASE tl.relevance WHEN 'primary' THEN 0 ELSE 1 END,
      CASE t.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
  `);

  return rows.rows as ThreatForLayerRow[];
}

export async function associateThreatToLayer(
  layerSlug: string,
  threatId: string,
  relevance: "primary" | "secondary",
  rationale?: string
): Promise<void> {
  const layerRow = await getLayerBySlug(layerSlug);
  if (!layerRow) throw new Error(`Layer not found: ${layerSlug}`);

  await db.execute(sql`
    INSERT INTO threat_layer (threat_id, layer_id, relevance, rationale)
    VALUES (${threatId}, ${layerRow.id}, ${relevance}, ${rationale ?? null})
    ON CONFLICT (threat_id, layer_id) DO UPDATE
      SET relevance = EXCLUDED.relevance,
          rationale = COALESCE(EXCLUDED.rationale, threat_layer.rationale)
  `);
}

export async function removeThreatFromLayer(layerSlug: string, threatId: string): Promise<void> {
  const layerRow = await getLayerBySlug(layerSlug);
  if (!layerRow) return;
  await db.execute(sql`
    DELETE FROM threat_layer WHERE threat_id = ${threatId} AND layer_id = ${layerRow.id}
  `);
}
