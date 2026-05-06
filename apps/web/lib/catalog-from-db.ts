import type { components } from "@aigently/api-client";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  db,
  ide,
  policyTemplate,
  policyTemplateStack,
  rule,
  ruleLayerMap,
  ruleStack,
  ruleThreatMap,
  stack,
  stackCoverageArea,
  stackFrameworkFeature,
  syncLog,
  threat,
  threatStack,
} from "@/lib/db";

type Stack = components["schemas"]["Stack"];
type StackDetail = components["schemas"]["StackDetail"];
type StackOverviewResponse = components["schemas"]["StackOverviewResponse"];
type PolicyTemplate = components["schemas"]["PolicyTemplate"];
type Ide = components["schemas"]["Ide"];
type Rule = components["schemas"]["Rule"];
type RuleDetail = components["schemas"]["RuleDetail"];
type Threat = components["schemas"]["Threat"];

function withLogoCdn(logoPath: string | null): string | null {
  const base = process.env.STACK_LOGO_CDN_BASE?.trim().replace(/\/$/, "");
  if (!base || !logoPath) return logoPath;
  if (/^https?:\/\//i.test(logoPath)) return logoPath;
  return `${base}/${logoPath.replace(/^\//, "")}`;
}

/** Same rows/shape as `GET /v1/stacks` — used when the API is down or unset. */
export async function listStacksFromDb(): Promise<Stack[]> {
  const rows = await db
    .select({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      logoPath: stack.logoPath,
      sortOrder: stack.sortOrder,
      catalogStatus: stack.catalogStatus,
    })
    .from(stack)
    .orderBy(asc(stack.sortOrder), asc(stack.id));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    logoPath: withLogoCdn(r.logoPath ?? null),
    sortOrder: r.sortOrder,
    catalogStatus: r.catalogStatus,
  }));
}

/** Same shape as `GET /v1/stacks/{slug}` including ruleCount. */
export async function getStackDetailFromDb(slug: string): Promise<StackDetail | null> {
  const rows = await db
    .select({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      logoPath: stack.logoPath,
      sortOrder: stack.sortOrder,
      catalogStatus: stack.catalogStatus,
    })
    .from(stack)
    .where(eq(stack.slug, slug))
    .limit(1);

  const s = rows[0];
  if (!s) return null;

  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ruleStack)
    .where(eq(ruleStack.stackId, s.id));

  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoPath: withLogoCdn(s.logoPath ?? null),
    sortOrder: s.sortOrder,
    catalogStatus: s.catalogStatus as Stack["catalogStatus"],
    ruleCount: countRow?.c ?? 0,
  };
}

/** Same shape as `GET /v1/stacks/{slug}/overview` for offline / API-down fallback. */
export async function getStackOverviewFromDb(slug: string): Promise<StackOverviewResponse | null> {
  const rows = await db
    .select({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      logoPath: stack.logoPath,
      sortOrder: stack.sortOrder,
      securityGrade: stack.securityGrade,
      gradeRationale: stack.gradeRationale,
      ecosystem: stack.ecosystem,
      nvdKeywords: stack.nvdKeywords,
      osvEcosystem: stack.osvEcosystem,
    })
    .from(stack)
    .where(eq(stack.slug, slug))
    .limit(1);

  const s = rows[0];
  if (!s) return null;

  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ruleStack)
    .where(eq(ruleStack.stackId, s.id));

  const coverage = await db
    .select({
      areaName: stackCoverageArea.areaName,
      coveragePercent: stackCoverageArea.coveragePercent,
      notes: stackCoverageArea.notes,
    })
    .from(stackCoverageArea)
    .where(eq(stackCoverageArea.stackId, s.id))
    .orderBy(asc(stackCoverageArea.areaName));

  const framework = await db
    .select({
      featureName: stackFrameworkFeature.featureName,
      status: stackFrameworkFeature.status,
      notes: stackFrameworkFeature.notes,
    })
    .from(stackFrameworkFeature)
    .where(eq(stackFrameworkFeature.stackId, s.id))
    .orderBy(asc(stackFrameworkFeature.featureName));

  const matrix = await db
    .select({
      publicId: threat.publicId,
      name: threat.name,
      severity: threatStack.severity,
      isMitigatedByRules: threatStack.isMitigatedByRules,
      family: threat.family,
    })
    .from(threatStack)
    .innerJoin(threat, eq(threat.publicId, threatStack.threatId))
    .where(eq(threatStack.stackId, s.id))
    .orderBy(asc(threat.publicId));

  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoPath: withLogoCdn(s.logoPath ?? null),
    sortOrder: s.sortOrder,
    ruleCount: countRow?.c ?? 0,
    securityGrade: s.securityGrade ?? null,
    gradeRationale: s.gradeRationale ?? null,
    ecosystem: s.ecosystem ?? null,
    nvdKeywords: s.nvdKeywords ?? [],
    osvEcosystem: s.osvEcosystem ?? null,
    coverageAreas: coverage,
    frameworkFeatures: framework,
    threatMatrix: matrix,
  };
}

/** Policy templates for a stack — mirrors `GET /v1/stacks/{slug}/policy-templates`. */
export async function listPolicyTemplatesFromDb(stackSlug: string): Promise<PolicyTemplate[]> {
  const rows = await db
    .select({
      id: policyTemplate.id,
      slug: policyTemplate.slug,
      name: policyTemplate.name,
      description: policyTemplate.description,
      layer: policyTemplate.layer,
      sortOrder: policyTemplate.sortOrder,
    })
    .from(policyTemplate)
    .innerJoin(policyTemplateStack, eq(policyTemplateStack.templateId, policyTemplate.id))
    .innerJoin(stack, eq(stack.id, policyTemplateStack.stackId))
    .where(eq(stack.slug, stackSlug))
    .orderBy(asc(policyTemplate.sortOrder), asc(policyTemplate.id));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? null,
    layer: r.layer,
    sortOrder: r.sortOrder,
  }));
}

/** Same rows/shape as `GET /v1/ides`. */
export async function listIdesFromDb(): Promise<Ide[]> {
  const rows = await db
    .select({
      id: ide.id,
      slug: ide.slug,
      name: ide.name,
      sortOrder: ide.sortOrder,
    })
    .from(ide)
    .orderBy(asc(ide.sortOrder), asc(ide.id));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    sortOrder: r.sortOrder,
  }));
}

/** Rules for the directory UI — mirrors `GET /v1/rules` pagination shape (no cursor). */
export async function listRulesDirectoryFromDb(
  stackSlugs: string[]
): Promise<{ rules: Rule[]; stacksByRuleId: Map<string, string[]> }> {
  const stacksByRuleId = new Map<string, string[]>();

  if (stackSlugs.length === 0) {
    // One row per threat mapping — dedupe by rule id so the grid is not N copies of the same rule.
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
      .innerJoin(ruleThreatMap, eq(ruleThreatMap.ruleId, rule.id))
      .orderBy(asc(rule.id))
      .limit(800);

    const byId = new Map<string, Rule>();
    for (const r of rows) {
      if (byId.has(r.id)) continue;
      byId.set(r.id, {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        version: r.version,
        certified: r.certified,
        lineCount: r.lineCount ?? null,
        weeklyUses: r.weeklyUses ?? 0,
      });
      if (byId.size >= 200) break;
    }

    return {
      rules: [...byId.values()],
      stacksByRuleId,
    };
  }

  const rows = await db
    .select({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      description: rule.description,
      version: rule.version,
      certified: rule.certified,
      lineCount: rule.lineCount,
      stackName: stack.name,
      weeklyUses: sql<number>`(
        SELECT COALESCE(SUM(wu.total_copies), 0)::int
        FROM rule_weekly_usage AS wu
        WHERE wu.rule_id = ${rule.id}
      )`.as("weeklyUses"),
    })
    .from(rule)
    .innerJoin(ruleThreatMap, eq(ruleThreatMap.ruleId, rule.id))
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId))
    .where(inArray(stack.slug, stackSlugs))
    .orderBy(asc(rule.id))
    .limit(200);

  const byId = new Map<string, Rule>();
  for (const row of rows) {
    const id = row.id;
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        version: row.version,
        certified: row.certified,
        lineCount: row.lineCount ?? null,
        weeklyUses: row.weeklyUses ?? 0,
      });
    }
    const cur = stacksByRuleId.get(id) ?? [];
    if (!cur.includes(row.stackName)) cur.push(row.stackName);
    stacksByRuleId.set(id, cur);
  }

  return { rules: [...byId.values()], stacksByRuleId };
}

type RuleLayer = components["schemas"]["RuleLayer"];

/** Layers + threat text for `/rules` filter chips — keyed by rule id. */
export async function loadDirectoryFilterMeta(ruleIds: string[]): Promise<{
  layersByRuleId: Map<string, RuleLayer[]>;
  threatSignalsByRuleId: Map<string, string>;
}> {
  const layersByRuleId = new Map<string, RuleLayer[]>();
  const threatSignalsByRuleId = new Map<string, string>();

  if (ruleIds.length === 0) {
    return { layersByRuleId, threatSignalsByRuleId };
  }

  const layerRows = await db
    .select({ ruleId: ruleLayerMap.ruleId, layer: ruleLayerMap.layer })
    .from(ruleLayerMap)
    .where(inArray(ruleLayerMap.ruleId, ruleIds));

  for (const row of layerRows) {
    const cur = layersByRuleId.get(row.ruleId) ?? [];
    if (!cur.includes(row.layer as RuleLayer)) cur.push(row.layer as RuleLayer);
    layersByRuleId.set(row.ruleId, cur);
  }

  const threatRows = await db
    .select({
      ruleId: ruleThreatMap.ruleId,
      threatName: threat.name,
      owaspRefs: threat.owaspRefs,
      family: threat.family,
    })
    .from(ruleThreatMap)
    .innerJoin(threat, eq(ruleThreatMap.threatId, threat.publicId))
    .where(inArray(ruleThreatMap.ruleId, ruleIds));

  for (const row of threatRows) {
    const parts = [
      row.threatName,
      ...(row.owaspRefs ?? []),
      row.family,
    ]
      .filter(Boolean)
      .join(" ");
    const prev = threatSignalsByRuleId.get(row.ruleId) ?? "";
    threatSignalsByRuleId.set(row.ruleId, prev ? `${prev} ${parts}` : parts);
  }

  return { layersByRuleId, threatSignalsByRuleId };
}

export async function listRulesPreviewForStackFromDb(stackSlug: string, limit: number): Promise<Rule[]> {
  const lim = Math.min(Math.max(limit, 1), 20);
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
    .innerJoin(ruleThreatMap, eq(ruleThreatMap.ruleId, rule.id))
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId))
    .where(eq(stack.slug, stackSlug))
    .orderBy(asc(rule.id))
    .limit(lim);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    version: r.version,
    certified: r.certified,
    lineCount: r.lineCount ?? null,
    weeklyUses: r.weeklyUses ?? 0,
  }));
}

/** Same shape as `GET /v1/rules/{slug}` including linkedThreats. */
export async function getRuleDetailFromDb(slug: string): Promise<RuleDetail | null> {
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
    lineCount: r.lineCount ?? null,
    weeklyUses: r.weeklyUses ?? 0,
    bodyMdx: r.bodyMdx ?? null,
    layers: layerRows.map((x) => x.layer),
    linkedThreats: threatRows.map((t) => ({
      publicId: t.publicId,
      cveId: t.cveId ?? null,
      name: t.name,
      sourceUrl: t.sourceUrl ?? null,
    })),
  };
}

/** Stacks that ship in MVP UI (catalog_status = launch). */
export async function listLaunchStacksFromDb(): Promise<Stack[]> {
  const rows = await db
    .select({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      logoPath: stack.logoPath,
      sortOrder: stack.sortOrder,
      catalogStatus: stack.catalogStatus,
    })
    .from(stack)
    .where(eq(stack.catalogStatus, "launch"))
    .orderBy(asc(stack.sortOrder), asc(stack.id));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    logoPath: withLogoCdn(r.logoPath ?? null),
    sortOrder: r.sortOrder,
    catalogStatus: r.catalogStatus,
  }));
}

/** Distinct threats linked to at least one launch stack (verified catalog slice). */
export async function countDistinctThreatsOnLaunchStacks(): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(distinct ${threat.publicId})::int` })
    .from(threat)
    .innerJoin(threatStack, eq(threatStack.threatId, threat.publicId))
    .innerJoin(stack, eq(stack.id, threatStack.stackId))
    .where(eq(stack.catalogStatus, "launch"));
  return row?.c ?? 0;
}

export async function countCertifiedRulesWithThreatMap(): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(distinct ${rule.id})::int` })
    .from(rule)
    .innerJoin(ruleThreatMap, eq(ruleThreatMap.ruleId, rule.id))
    .where(eq(rule.certified, true));
  return row?.c ?? 0;
}

/** How many certified rules link each threat (for feed “rules protect” badge). */
export async function getRuleCountByThreatPublicId(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      threatId: ruleThreatMap.threatId,
      c: sql<number>`count(distinct ${ruleThreatMap.ruleId})::int`,
    })
    .from(ruleThreatMap)
    .innerJoin(rule, eq(rule.id, ruleThreatMap.ruleId))
    .where(eq(rule.certified, true))
    .groupBy(ruleThreatMap.threatId);
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.threatId, r.c ?? 0);
  }
  return m;
}

export async function getLastCatalogSyncFinishedAt(): Promise<string | null> {
  const [row] = await db
    .select({ t: syncLog.finishedAt })
    .from(syncLog)
    .where(eq(syncLog.status, "ok"))
    .orderBy(desc(syncLog.finishedAt))
    .limit(1);
  return row?.t ? row.t.toISOString() : null;
}

/** Threat rows for `/threats` feed — distinct threats appearing on any launch stack. */
export async function listThreatsOnLaunchStacksFromDb(): Promise<Threat[]> {
  const rows = await db
    .select({
      publicId: threat.publicId,
      family: threat.family,
      name: threat.name,
      severity: threat.severity,
      description: threat.description,
      cveId: threat.cveId,
      externalId: threat.externalId,
      source: threat.source,
      sourceUrl: threat.sourceUrl,
      isActivelyExploited: threat.isActivelyExploited,
      owaspRefs: threat.owaspRefs,
    })
    .from(threat)
    .innerJoin(threatStack, eq(threatStack.threatId, threat.publicId))
    .innerJoin(stack, eq(stack.id, threatStack.stackId))
    .where(eq(stack.catalogStatus, "launch"))
    .orderBy(asc(threat.publicId));

  const seen = new Set<string>();
  const out: Threat[] = [];
  for (const r of rows) {
    if (seen.has(r.publicId)) continue;
    seen.add(r.publicId);
    out.push({
      publicId: r.publicId,
      family: r.family,
      name: r.name,
      severity: r.severity ?? null,
      description: r.description ?? null,
      cveId: r.cveId ?? null,
      externalId: r.externalId ?? null,
      source: r.source ?? null,
      sourceUrl: r.sourceUrl ?? null,
      isActivelyExploited: r.isActivelyExploited,
      owaspRefs: r.owaspRefs ?? [],
    });
  }
  return out;
}

export type StackThreatSeverityRow = {
  slug: string;
  name: string;
  critical: number;
  high: number;
};

/** Per launch stack: counts of critical / high severity threat_stack rows. */
export async function getLaunchStackThreatSeverityCounts(): Promise<StackThreatSeverityRow[]> {
  const stacks = await db
    .select({ id: stack.id, slug: stack.slug, name: stack.name })
    .from(stack)
    .where(eq(stack.catalogStatus, "launch"))
    .orderBy(asc(stack.sortOrder));

  const out: StackThreatSeverityRow[] = [];
  for (const s of stacks) {
    const [crit] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(threatStack)
      .where(and(eq(threatStack.stackId, s.id), eq(threatStack.severity, "critical")));
    const [hi] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(threatStack)
      .where(and(eq(threatStack.stackId, s.id), eq(threatStack.severity, "high")));
    out.push({
      slug: s.slug,
      name: s.name,
      critical: crit?.c ?? 0,
      high: hi?.c ?? 0,
    });
  }
  return out;
}
