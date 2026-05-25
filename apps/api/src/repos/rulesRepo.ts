import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import { ide, layer, rule, ruleIde, ruleLayerMap, ruleStack, ruleThreatMap, stack, summarizedGuardrail, threat } from "@aigently/db/schema";

import { db } from "../lib/db.js";

export type LayerSummary = {
  id: string;
  slug: string;
  name: string;
  iconName: string | null;
  colorToken: string | null;
  isSystem: boolean;
};

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
  layers: LayerSummary[];
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
    .select({
      id: layer.id,
      slug: layer.slug,
      name: layer.name,
      iconName: layer.iconName,
      colorToken: layer.colorToken,
      isSystem: layer.isSystem,
    })
    .from(ruleLayerMap)
    .innerJoin(layer, eq(layer.id, ruleLayerMap.layerId))
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
    layers: layerRows.map((x) => ({
      id: x.id,
      slug: x.slug,
      name: x.name,
      iconName: x.iconName ?? null,
      colorToken: x.colorToken ?? null,
      isSystem: x.isSystem,
    })),
    linkedThreats: threatRows.map((t) => ({
      publicId: t.publicId,
      cveId: t.cveId ?? null,
      name: t.name,
      sourceUrl: t.sourceUrl ?? null,
    })),
  };
}

/** Validate a layer slug exists in DB. Call listActiveLayers() once on startup to build a set. */
export type RuleLayerValue = string;

export async function getValidLayerSlugs(): Promise<Set<string>> {
  const rows = await db.select({ slug: layer.slug }).from(layer).where(eq(layer.isActive, true));
  return new Set(rows.map((r) => r.slug));
}

/** Rules linked to stack + ide; if layerSlugs non-empty, rule must have every layer. */
export async function listRulesForComposerExport(
  stackSlug: string,
  ideSlug: string,
  layerSlugs: string[]
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

  if (layerSlugs.length === 0) return candidates;

  const ruleIds = candidates.map((c) => c.id);
  if (ruleIds.length === 0) return [];

  const layerRows = await db
    .select({ ruleId: ruleLayerMap.ruleId, layerSlug: layer.slug })
    .from(ruleLayerMap)
    .innerJoin(layer, eq(layer.id, ruleLayerMap.layerId))
    .where(
      and(
        inArray(ruleLayerMap.ruleId, ruleIds),
        inArray(layer.slug, layerSlugs)
      )
    );

  const byRule = new Map<string, Set<string>>();
  for (const row of layerRows) {
    let set = byRule.get(row.ruleId);
    if (!set) {
      set = new Set();
      byRule.set(row.ruleId, set);
    }
    set.add(row.layerSlug);
  }

  // Include rule if it covers ANY of the requested layers (OR semantics).
  // AND semantics (every layer required) produced empty results when users
  // select a broad layer set but individual rules only cover a subset.
  return candidates.filter((c) => {
    const got = byRule.get(c.id);
    if (!got) return false;
    for (const l of layerSlugs) {
      if (got.has(l)) return true;
    }
    return false;
  });
}

export type ThreatMeta = {
  cveId: string | null;
  severity: string | null;
  name: string;
};

export type GuardrailForExport = {
  layerSlug: string;
  layerName: string;
  content: string;
  sourceRuleIds: string[];
  threats: ThreatMeta[];
};

/** Per-layer AI-synthesized guardrails for the Composer export.
 *  Returns one row per (stack, layer) pair, ordered by layer sort order.
 *  Each row includes the threat metadata (CVE ID, severity, name) for
 *  the rules that contributed to the guardrail. */
export async function listGuardrailsForComposerExport(
  stackSlug: string,
  layerSlugs: string[]
): Promise<GuardrailForExport[]> {
  if (layerSlugs.length === 0) return [];
  const rows = await db
    .select({
      layerSlug: layer.slug,
      layerName: layer.name,
      content: summarizedGuardrail.content,
      sourceRuleIds: summarizedGuardrail.sourceRuleIds,
      generatedAt: summarizedGuardrail.generatedAt,
    })
    .from(summarizedGuardrail)
    .innerJoin(stack, eq(stack.id, summarizedGuardrail.stackId))
    .innerJoin(layer, eq(layer.id, summarizedGuardrail.layerId))
    .where(
      and(
        eq(stack.slug, stackSlug),
        inArray(layer.slug, layerSlugs)
      )
    )
    .orderBy(asc(layer.sortOrder));

  // Deduplicate: keep newest guardrail per layer slug
  const seen = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const existing = seen.get(row.layerSlug);
    if (!existing || (row.generatedAt && existing.generatedAt && row.generatedAt > existing.generatedAt)) {
      seen.set(row.layerSlug, row);
    }
  }
  const deduped = [...seen.values()].sort((a, b) => {
    const ai = rows.findIndex((r) => r.layerSlug === a.layerSlug);
    const bi = rows.findIndex((r) => r.layerSlug === b.layerSlug);
    return ai - bi;
  });

  // Fetch threat metadata for each guardrail via its source rules
  const result: GuardrailForExport[] = [];
  for (const g of deduped) {
    let threats: ThreatMeta[] = [];
    if (g.sourceRuleIds.length > 0) {
      threats = await db
        .selectDistinctOn([threat.publicId], {
          cveId: threat.cveId,
          severity: threat.severity,
          name: threat.name,
        })
        .from(ruleThreatMap)
        .innerJoin(threat, eq(ruleThreatMap.threatId, threat.publicId))
        .where(inArray(ruleThreatMap.ruleId, g.sourceRuleIds))
        .orderBy(
          threat.publicId,
          sql`CASE ${threat.severity} WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`
        );
    }
    result.push({
      layerSlug: g.layerSlug,
      layerName: g.layerName,
      content: g.content,
      sourceRuleIds: g.sourceRuleIds,
      threats,
    });
  }
  return result;
}
