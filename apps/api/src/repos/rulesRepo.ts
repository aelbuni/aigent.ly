import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import { ide, rule, ruleIde, ruleLayerMap, ruleStack, ruleThreatMap, stack, threat } from "@aigently/db/schema";

import { db } from "../lib/db.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export type RuleListRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  certified: boolean;
  lineCount: number | null;
  weeklyUses: number;
};

export async function listRulesPaginated(
  cursor: string | undefined,
  limitRaw: number | undefined,
  stackSlug?: string | undefined
) {
  const limit = Math.min(Math.max(Number(limitRaw) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (stackSlug) {
    const rows = await db
      .select({
        id: rule.id,
        slug: rule.slug,
        name: rule.name,
        description: rule.description,
        version: rule.version,
        certified: rule.certified,
        lineCount: rule.lineCount,
        weeklyUses: sql<number>`(
          SELECT COALESCE(SUM(wu.total_copies), 0)::int
          FROM rule_weekly_usage AS wu
          WHERE wu.rule_id = ${rule.id}
        )`.as("weeklyUses"),
      })
      .from(rule)
      .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
      .innerJoin(stack, eq(stack.id, ruleStack.stackId))
      .where(
        cursor ? and(eq(stack.slug, stackSlug), gt(rule.id, cursor)) : eq(stack.slug, stackSlug)
      )
      .orderBy(asc(rule.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(items[items.length - 1]!.id) : null;
    return { items, nextCursor };
  }

  const base = db
    .select({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      description: rule.description,
      version: rule.version,
      certified: rule.certified,
      lineCount: rule.lineCount,
      weeklyUses: sql<number>`(
        SELECT COALESCE(SUM(wu.total_copies), 0)::int
        FROM rule_weekly_usage AS wu
        WHERE wu.rule_id = ${rule.id}
      )`.as("weeklyUses"),
    })
    .from(rule)
    .$dynamic();

  const rows = cursor
    ? await base.where(gt(rule.id, cursor)).orderBy(asc(rule.id)).limit(limit + 1)
    : await base.orderBy(asc(rule.id)).limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1]!.id) : null;

  return { items, nextCursor };
}

export type RuleLinkedThreatRow = {
  publicId: string;
  cveId: string | null;
  name: string;
  sourceUrl: string | null;
};

export type RuleDetailRow = RuleListRow & {
  bodyMdx: string | null;
  layers: ("security" | "architecture" | "code_quality")[];
  linkedThreats: RuleLinkedThreatRow[];
};

export async function getRuleBySlug(slug: string): Promise<RuleDetailRow | null> {
  const rows = await db
    .select({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      description: rule.description,
      version: rule.version,
      certified: rule.certified,
      lineCount: rule.lineCount,
      bodyMdx: rule.bodyMdx,
      weeklyUses: sql<number>`(
        SELECT COALESCE(SUM(wu.total_copies), 0)::int
        FROM rule_weekly_usage AS wu
        WHERE wu.rule_id = ${rule.id}
      )`.as("weeklyUses"),
    })
    .from(rule)
    .where(eq(rule.slug, slug))
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  const layerRows = await db
    .select({ layer: ruleLayerMap.layer })
    .from(ruleLayerMap)
    .where(eq(ruleLayerMap.ruleId, r.id));

  const threatRows = await db
    .select({
      publicId: threat.publicId,
      cveId: threat.cveId,
      name: threat.name,
      sourceUrl: threat.sourceUrl,
    })
    .from(ruleThreatMap)
    .innerJoin(threat, eq(ruleThreatMap.threatId, threat.publicId))
    .where(eq(ruleThreatMap.ruleId, r.id))
    .orderBy(asc(threat.publicId));

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    version: r.version,
    certified: r.certified,
    lineCount: r.lineCount,
    weeklyUses: r.weeklyUses ?? 0,
    bodyMdx: r.bodyMdx,
    layers: layerRows.map((x) => x.layer),
    linkedThreats: threatRows.map((t) => ({
      publicId: t.publicId,
      cveId: t.cveId ?? null,
      name: t.name,
      sourceUrl: t.sourceUrl ?? null,
    })),
  };
}

const RULE_LAYER_VALUES = ["security", "architecture", "code_quality"] as const;
export type RuleLayerValue = (typeof RULE_LAYER_VALUES)[number];

export function isRuleLayer(s: string): s is RuleLayerValue {
  return (RULE_LAYER_VALUES as readonly string[]).includes(s);
}

/** Rules linked to stack + ide; if layers non-empty, rule must have every layer in rule_layer_map. */
export async function listRulesForComposerExport(
  stackSlug: string,
  ideSlug: string,
  layers: RuleLayerValue[]
) {
  const whereBase = and(eq(stack.slug, stackSlug), eq(ide.slug, ideSlug));

  const candidates = await db
    .select({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      description: rule.description,
      version: rule.version,
      certified: rule.certified,
      lineCount: rule.lineCount,
      bodyMdx: rule.bodyMdx,
    })
    .from(rule)
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId))
    .innerJoin(ruleIde, eq(ruleIde.ruleId, rule.id))
    .innerJoin(ide, eq(ide.id, ruleIde.ideId))
    .where(whereBase)
    .orderBy(asc(rule.slug));

  if (layers.length === 0) return candidates;

  const ruleIds = candidates.map((c) => c.id);
  if (ruleIds.length === 0) return [];

  const layerRows = await db
    .select({ ruleId: ruleLayerMap.ruleId, layer: ruleLayerMap.layer })
    .from(ruleLayerMap)
    .where(and(inArray(ruleLayerMap.ruleId, ruleIds), inArray(ruleLayerMap.layer, layers)));

  const byRule = new Map<string, Set<string>>();
  for (const row of layerRows) {
    let set = byRule.get(row.ruleId);
    if (!set) {
      set = new Set();
      byRule.set(row.ruleId, set);
    }
    set.add(row.layer);
  }

  const needed = new Set(layers);
  return candidates.filter((c) => {
    const got = byRule.get(c.id);
    if (!got) return false;
    for (const l of needed) {
      if (!got.has(l)) return false;
    }
    return true;
  });
}
