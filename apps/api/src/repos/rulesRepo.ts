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
  ruleType: "all" | "patterns" | "deps" = "all"
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

  if (ruleType === "all") return candidates;

  const depsPattern = /-security-deps-v\d+$/i;
  return candidates.filter((c) => {
    const isDeps = depsPattern.test(c.slug);
    return ruleType === "deps" ? isDeps : !isDeps;
  });
}

export type ThreatMeta = {
  cveId: string | null;
  severity: string | null;
  name: string;
  sourceUrl: string | null;
};

export type GuardrailForExport = {
  layerSlug: string;
  layerName: string;
  content: string;
  sourceRuleIds: string[];
  threats: ThreatMeta[];
};

/** AI-synthesized guardrails for the Composer export keyed by (stack, contentType). */
export async function listGuardrailsForComposerExport(
  stackSlug: string,
  ruleType: "all" | "patterns" | "deps" = "all"
): Promise<GuardrailForExport[]> {
  const contentTypes: Array<"patterns" | "deps"> =
    ruleType === "all" ? ["patterns", "deps"] :
    ruleType === "patterns" ? ["patterns"] : ["deps"];

  const rows = await db
    .select({
      contentType: summarizedGuardrail.contentType,
      content: summarizedGuardrail.content,
      sourceRuleIds: summarizedGuardrail.sourceRuleIds,
      generatedAt: summarizedGuardrail.generatedAt,
    })
    .from(summarizedGuardrail)
    .innerJoin(stack, eq(stack.id, summarizedGuardrail.stackId))
    .where(
      and(
        eq(stack.slug, stackSlug),
        inArray(summarizedGuardrail.contentType, contentTypes)
      )
    )
    .orderBy(asc(summarizedGuardrail.contentType));

  const deduped = rows.map((row) => ({
    ...row,
    layerSlug: row.contentType === "deps" ? "dependency_supply" : "auth_session",
    layerName: row.contentType === "deps" ? "Dependency & Supply Chain" : "Security Patterns",
  }));

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
          sourceUrl: threat.sourceUrl,
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
