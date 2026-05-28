import type { components } from "@aigently/api-client";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  db,
  pool,
  article,
  ide,
  layer,
  policyTemplate,
  policyTemplateStack,
  rule,
  ruleIde,
  ruleLayerMap,
  ruleStack,
  ruleThreatMap,
  stack,
  summarizedGuardrail,
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
type RuleDetail = components["schemas"]["RuleDetail"] & { summaryMdx?: string | null };
type Threat = components["schemas"]["Threat"];

// ---------------------------------------------------------------------------
// Shared subquery: sum weekly copy-events for a rule row.
// Drizzle's sql template is evaluated once; the column reference `rule.id`
// is resolved per-row by the database engine, so this const is safe to reuse
// across multiple .select() calls.
// ---------------------------------------------------------------------------
const weeklyUsesSubquery = sql<number>`(
  SELECT COALESCE(SUM(ud.copy_count), 0)::int
  FROM rule_usage_daily AS ud
  WHERE ud.rule_id = ${rule.id}
    AND ud.bucket_date >= CURRENT_DATE - INTERVAL '7 days'
)`.as("weeklyUses");

// ---------------------------------------------------------------------------
// Shared row mapper for the common Rule columns returned by directory /
// preview queries.  Callers that also project `strengthScore` should spread
// this result and add the extra field themselves.
// ---------------------------------------------------------------------------
type RuleRowBase = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  certified: boolean;
  lineCount: number | null;
  weeklyUses: number;
};

function mapRuleRow(r: RuleRowBase): Rule {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    version: r.version,
    certified: r.certified,
    lineCount: r.lineCount ?? null,
    weeklyUses: r.weeklyUses ?? 0,
  };
}

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

  const matrix = await db
    .select({
      publicId: threat.publicId,
      name: threat.name,
      severity: threatStack.severity,
      isMitigatedByRules: threatStack.isMitigatedByRules,
      family: threat.family,
      publishedAt: threat.publishedAt,
    })
    .from(threatStack)
    .innerJoin(threat, eq(threat.publicId, threatStack.threatId))
    .where(eq(threatStack.stackId, s.id))
    .orderBy(sql`${threat.publishedAt} DESC NULLS LAST`, asc(threat.publicId));

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
    coverageAreas: [],
    frameworkFeatures: [],
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
      layerId: policyTemplate.layerId,
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
    layerId: r.layerId,
    sortOrder: r.sortOrder,
  })) as unknown as PolicyTemplate[];
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
): Promise<{ rules: (Rule & { strengthScore: number })[]; stacksByRuleId: Map<string, string[]> }> {
  const stacksByRuleId = new Map<string, string[]>();

  if (stackSlugs.length === 0) {
    const rows = await db
      .select({
        id: rule.id,
        slug: rule.slug,
        name: rule.name,
        description: rule.description,
        version: rule.version,
        certified: rule.certified,
        lineCount: rule.lineCount,
        strengthScore: rule.strengthScore,
        weeklyUses: weeklyUsesSubquery,
      })
      .from(rule)
      .orderBy(asc(rule.id))
      .limit(400);

    const byId = new Map<string, Rule & { strengthScore: number }>();
    for (const r of rows) {
      if (byId.has(r.id)) continue;
      byId.set(r.id, {
        ...mapRuleRow(r),
        strengthScore: r.strengthScore ?? 0,
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
      strengthScore: rule.strengthScore,
      stackName: stack.name,
      weeklyUses: weeklyUsesSubquery,
    })
    .from(rule)
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId))
    .where(inArray(stack.slug, stackSlugs))
    .orderBy(asc(rule.id))
    .limit(400);

  const byId = new Map<string, Rule & { strengthScore: number }>();
  for (const row of rows) {
    const id = row.id;
    if (!byId.has(id)) {
      byId.set(id, {
        ...mapRuleRow(row),
        strengthScore: row.strengthScore ?? 0,
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
    .select({
      ruleId: ruleLayerMap.ruleId,
      slug: layer.slug,
      name: layer.name,
      id: layer.id,
      iconName: layer.iconName,
      colorToken: layer.colorToken,
      isSystem: layer.isSystem,
    })
    .from(ruleLayerMap)
    .innerJoin(layer, eq(layer.id, ruleLayerMap.layerId))
    .where(inArray(ruleLayerMap.ruleId, ruleIds));

  for (const row of layerRows) {
    const cur = layersByRuleId.get(row.ruleId) ?? [];
    const layerObj = { id: row.id, slug: row.slug, name: row.name, iconName: row.iconName ?? null, colorToken: row.colorToken ?? null, isSystem: row.isSystem } as unknown as RuleLayer;
    if (!cur.some((l) => (l as unknown as { slug: string }).slug === row.slug)) cur.push(layerObj);
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
      weeklyUses: weeklyUsesSubquery,
    })
    .from(rule)
    .innerJoin(ruleThreatMap, eq(ruleThreatMap.ruleId, rule.id))
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId))
    .where(eq(stack.slug, stackSlug))
    .orderBy(asc(rule.id))
    .limit(lim);

  return rows.map(mapRuleRow);
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
      summaryMdx: rule.summaryMdx,
      weeklyUses: weeklyUsesSubquery,
    })
    .from(rule)
    .where(eq(rule.slug, slug))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const layerRows = await db
    .select({ id: layer.id, slug: layer.slug, name: layer.name, iconName: layer.iconName, colorToken: layer.colorToken, isSystem: layer.isSystem })
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
    lineCount: r.lineCount ?? null,
    weeklyUses: r.weeklyUses ?? 0,
    bodyMdx: r.bodyMdx ?? null,
    summaryMdx: r.summaryMdx ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layers: layerRows.map((x) => ({ id: x.id, slug: x.slug, name: x.name, iconName: x.iconName ?? null, colorToken: x.colorToken ?? null, isSystem: x.isSystem })) as any,
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
    .orderBy(sql`${threat.publishedAt} DESC NULLS LAST`, desc(threat.publicId));

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

export type ThreatFeedPage = {
  items: Threat[];
  total: number;
};

/**
 * DB-filtered, DB-paginated threat feed for the /threats page.
 * Pushes severity filter and search into SQL so we never fetch the full 500+ row table.
 * Typical query time: ~80–120ms vs 600ms for the full-fetch approach.
 */
export async function listThreatsPagedFromDb(params: {
  severities?: string[];   // e.g. ["critical","high"] — empty = all
  stackSlug?: string;      // filter by specific stack slug
  q?: string;              // full-text search against name + cveId + publicId
  page?: number;
  perPage?: number;
}): Promise<ThreatFeedPage> {
  const { severities = [], stackSlug = "", q = "", page = 1, perPage = 15 } = params;
  const offset = (page - 1) * perPage;

  // Build parameterized WHERE clause for direct pg queries
  const qp: unknown[] = ["launch"];
  const whereParts = [
    `s.catalog_status = $1`,
    `t.source_url IS NOT NULL AND t.source_url != ''`,
  ];

  if (severities.length > 0) {
    const placeholders = severities.map((_, i) => `$${qp.length + i + 1}`).join(", ");
    whereParts.push(`t.severity IN (${placeholders})`);
    qp.push(...severities);
  }
  if (stackSlug.trim()) {
    qp.push(stackSlug.trim());
    whereParts.push(`s.slug = $${qp.length}`);
  }
  if (q.trim()) {
    qp.push(`%${q.trim()}%`);
    const idx = qp.length;
    whereParts.push(`(t.name ILIKE $${idx} OR t.cve_id ILIKE $${idx} OR t.public_id ILIKE $${idx})`);
  }
  const whereClause = whereParts.join(" AND ");

  const countResult = await pool.query<{ total: number }>(
    `SELECT COUNT(DISTINCT t.public_id)::int AS total
     FROM threat t
     INNER JOIN threat_stack ts ON ts.threat_id = t.public_id
     INNER JOIN stack s ON s.id = ts.stack_id
     WHERE ${whereClause}`,
    qp
  );
  const total = countResult.rows[0]?.total ?? 0;

  const pageResult = await pool.query<Record<string, unknown>>(
    `SELECT * FROM (
       SELECT DISTINCT ON (t.public_id)
         t.public_id AS "publicId", t.family, t.name, t.severity,
         t.description, t.cve_id AS "cveId", t.external_id AS "externalId",
         t.source, t.source_url AS "sourceUrl",
         t.is_actively_exploited AS "isActivelyExploited",
         t.owasp_refs AS "owaspRefs", t.published_at
       FROM threat t
       INNER JOIN threat_stack ts ON ts.threat_id = t.public_id
       INNER JOIN stack s ON s.id = ts.stack_id
       WHERE ${whereClause}
       ORDER BY t.public_id, t.published_at DESC NULLS LAST
     ) deduped
     ORDER BY published_at DESC NULLS LAST, "publicId" DESC
     LIMIT $${qp.length + 1} OFFSET $${qp.length + 2}`,
    [...qp, perPage, offset]
  );
  const rows = pageResult.rows;

  type RowShape = {
    publicId: string; family: string; name: string;
    severity: string | null; description: string | null;
    cveId: string | null; externalId: string | null;
    source: string | null; sourceUrl: string | null;
    isActivelyExploited: boolean; owaspRefs: string[] | null;
  };
  return {
    total,
    items: (rows as RowShape[]).map((r) => ({
      publicId: r.publicId,
      family: r.family as Threat["family"],
      name: r.name,
      severity: r.severity ?? null,
      description: r.description ?? null,
      cveId: r.cveId ?? null,
      externalId: r.externalId ?? null,
      source: r.source ?? null,
      sourceUrl: r.sourceUrl ?? null,
      isActivelyExploited: r.isActivelyExploited,
      owaspRefs: r.owaspRefs ?? [],
    })),
  };
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

export type LayerWithStats = {
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
  ruleCount: number;
  threatCount: number;
  stackCount: number;
};

export async function listLayersWithStatsFromDb(): Promise<LayerWithStats[]> {
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
        SELECT COUNT(DISTINCT rlm.rule_id)::int FROM rule_layer_map rlm WHERE rlm.layer_id = "layer"."id"
      )`.as("ruleCount"),
      threatCount: sql<number>`(
        SELECT COUNT(*)::int FROM threat_layer tl WHERE tl.layer_id = "layer"."id"
      )`.as("threatCount"),
      stackCount: sql<number>`(
        SELECT COUNT(DISTINCT rs.stack_id)::int FROM rule_layer_map rlm JOIN rule_stack rs ON rs.rule_id = rlm.rule_id WHERE rlm.layer_id = "layer"."id"
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

export type ThreatForLayer = {
  threatId: string;
  name: string;
  severity: string | null;
  cveId: string | null;
  relevance: string | null;
  rationale: string | null;
};

export async function listThreatsForLayerFromDb(layerSlug: string): Promise<ThreatForLayer[]> {
  const rows = await db.execute(sql`
    SELECT t.public_id AS "threatId", t.name, t.severity, t.cve_id AS "cveId",
           tl.relevance, tl.rationale
    FROM threat_layer tl
    JOIN layer l ON l.id = tl.layer_id
    JOIN threat t ON t.public_id = tl.threat_id
    WHERE l.slug = ${layerSlug}
    ORDER BY
      CASE tl.relevance WHEN 'primary' THEN 0 ELSE 1 END,
      CASE t.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
  `);
  return rows.rows as ThreatForLayer[];
}

export type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  tags: string[];
  publishedAt: Date | null;
  contentPath: string | null;
};

/** News feed — articles ordered newest first. */
export async function listArticlesFromDb(limit = 50): Promise<ArticleCard[]> {
  const rows = await db
    .select({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      tags: article.tags,
      publishedAt: article.publishedAt,
      contentPath: article.contentPath,
    })
    .from(article)
    .orderBy(desc(article.publishedAt), desc(article.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? null,
    tags: r.tags ?? [],
    publishedAt: r.publishedAt ?? null,
    contentPath: r.contentPath ?? null,
  }));
}

export type HomeThreatRow = {
  publicId: string;
  name: string;
  severity: string | null;
  cveId: string | null;
  sourceUrl: string | null;
  isActivelyExploited: boolean;
  publishedAt: Date | null;
  stackNames: string[];
};

/** Top N critical/high threats for the homepage live feed.
 *  Returns distinct threats across all launch stacks, newest first. */
export async function listTopThreatsForHomepage(limit = 10): Promise<HomeThreatRow[]> {
  const rows = await db
    .select({
      publicId: threat.publicId,
      name: threat.name,
      severity: threat.severity,
      cveId: threat.cveId,
      sourceUrl: threat.sourceUrl,
      isActivelyExploited: threat.isActivelyExploited,
      publishedAt: threat.publishedAt,
      stackName: stack.name,
    })
    .from(threat)
    .innerJoin(threatStack, eq(threatStack.threatId, threat.publicId))
    .innerJoin(stack, eq(stack.id, threatStack.stackId))
    .where(and(eq(stack.catalogStatus, "launch"), inArray(threat.severity, ["critical", "high"])))
    .orderBy(sql`${threat.publishedAt} DESC NULLS LAST`, desc(threat.publicId));

  // Deduplicate threats, collect all stack names per threat
  const map = new Map<string, HomeThreatRow>();
  for (const r of rows) {
    if (!map.has(r.publicId)) {
      map.set(r.publicId, {
        publicId: r.publicId,
        name: r.name,
        severity: r.severity,
        cveId: r.cveId,
        sourceUrl: r.sourceUrl,
        isActivelyExploited: r.isActivelyExploited,
        publishedAt: r.publishedAt,
        stackNames: [],
      });
    }
    const entry = map.get(r.publicId)!;
    if (!entry.stackNames.includes(r.stackName)) entry.stackNames.push(r.stackName);
  }
  return [...map.values()].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Composer export queries — used by postComposerExportAction (no API service needed)
// ---------------------------------------------------------------------------

export type ThreatMeta = {
  cveId: string | null;
  severity: string | null;
  name: string;
  sourceUrl: string | null;
};

export type GuardrailForExport = {
  layerSlug: string;
  layerName: string;
  contentType: "patterns" | "deps";
  content: string;
  sourceRuleIds: string[];
  threats: ThreatMeta[];
};

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
  const patternsPattern = /-security-patterns-v\d+$/i;
  return candidates.filter((c) =>
    ruleType === "deps" ? depsPattern.test(c.slug) : patternsPattern.test(c.slug)
  );
}

export async function listGuardrailsForComposerExport(
  stackSlug: string,
  ruleType: "all" | "patterns" | "deps" = "all"
): Promise<GuardrailForExport[]> {
  const contentTypes: ("patterns" | "deps")[] =
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
    .where(and(eq(stack.slug, stackSlug), inArray(summarizedGuardrail.contentType, contentTypes)));

  const result: GuardrailForExport[] = [];
  for (const g of rows) {
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
    // Use a stable display label for the content type
    const layerSlug = g.contentType === "deps" ? "dependency_supply" : "auth_session";
    const layerName = g.contentType === "deps" ? "Dependency & Supply Chain" : "Security Patterns";
    result.push({ layerSlug, layerName, contentType: g.contentType, content: g.content, sourceRuleIds: g.sourceRuleIds, threats });
  }
  return result;
}
