import { and, count, desc, eq, ilike, isNull, lt, sql } from "drizzle-orm";
import {
  db,
  layer,
  llmConfig,
  llmTaskConfig,
  owaspLayerMapping,
  policyTemplate,
  rule,
  ruleLayerMap,
  ruleStack,
  ruleThreatMap,
  sourceLayerMapping,
  stack,
  stackSubmission,
  summarizedGuardrail,
  syncLog,
  threat,
  threatLayer,
  threatStack,
  user,
} from "./db";

export async function getAdminOverviewStats() {
  const [[stacks], [rules], [threats], [layers], [pending], [guardrails], lastSync] =
    await Promise.all([
      db.select({ count: count() }).from(stack),
      db.select({ count: count() }).from(rule),
      db.select({ count: count() }).from(threat),
      db.select({ count: count() }).from(layer),
      db
        .select({ count: count() })
        .from(stackSubmission)
        .where(eq(stackSubmission.status, "pending")),
      db.select({ count: count() }).from(summarizedGuardrail),
      db
        .select()
        .from(syncLog)
        .orderBy(desc(syncLog.startedAt))
        .limit(1),
    ]);

  return {
    stackCount: stacks.count,
    ruleCount: rules.count,
    threatCount: threats.count,
    layerCount: layers.count,
    pendingSubmissions: pending.count,
    guardrailCount: guardrails.count,
    lastSync: lastSync[0] ?? null,
  };
}

export async function listSubmissions(params: {
  page: number;
  perPage: number;
  status?: string;
  search?: string;
}) {
  const { page, perPage, status, search } = params;
  const offset = (page - 1) * perPage;

  const conditions = [];
  if (status) conditions.push(eq(stackSubmission.status, status as "pending" | "under_review" | "approved" | "rejected" | "onboarding" | "live"));
  if (search) conditions.push(ilike(stackSubmission.proposedName, `%${search}%`));

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: stackSubmission.id,
        proposedName: stackSubmission.proposedName,
        proposedSlug: stackSubmission.proposedSlug,
        ecosystem: stackSubmission.ecosystem,
        status: stackSubmission.status,
        createdAt: stackSubmission.createdAt,
        submittedBy: { id: user.id, name: user.name, email: user.email, image: user.image },
      })
      .from(stackSubmission)
      .leftJoin(user, eq(stackSubmission.submittedBy, user.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(stackSubmission.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: count() })
      .from(stackSubmission)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  return { rows, total: total.count };
}

export async function getSubmissionById(id: string) {
  const rows = await db
    .select({
      submission: stackSubmission,
      submitter: { id: user.id, name: user.name, email: user.email, image: user.image },
    })
    .from(stackSubmission)
    .leftJoin(user, eq(stackSubmission.submittedBy, user.id))
    .where(eq(stackSubmission.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listStacks(params: { page: number; perPage: number; search?: string }) {
  const { page, perPage, search } = params;
  const offset = (page - 1) * perPage;

  const conditions = search ? [ilike(stack.name, `%${search}%`)] : [];

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: stack.id,
        slug: stack.slug,
        name: stack.name,
        logoPath: stack.logoPath,
        ecosystem: stack.ecosystem,
        catalogStatus: stack.catalogStatus,
        securityGrade: stack.securityGrade,
        sortOrder: stack.sortOrder,
        createdAt: stack.createdAt,
        ruleCount: sql<number>`(SELECT count(*) FROM rule_stack rs WHERE rs.stack_id = "stack"."id")`,
        threatCount: sql<number>`(SELECT count(*) FROM threat_stack ts WHERE ts.stack_id = "stack"."id")`,
      })
      .from(stack)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(stack.sortOrder)
      .limit(perPage)
      .offset(offset),
    db.select({ count: count() }).from(stack).where(conditions.length ? and(...conditions) : undefined),
  ]);

  return { rows, total: total.count };
}

export async function listRules(params: { page: number; perPage: number; search?: string }) {
  const { page, perPage, search } = params;
  const offset = (page - 1) * perPage;
  const conditions = search ? [ilike(rule.name, `%${search}%`)] : [];

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: rule.id,
        slug: rule.slug,
        name: rule.name,
        ruleType: rule.ruleType,
        strengthScore: rule.strengthScore,
        certified: rule.certified,
        complexity: rule.complexity,
        lineCount: rule.lineCount,
        author: rule.author,
        updatedAt: rule.updatedAt,
        layerCount: sql<number>`(SELECT COUNT(*)::int FROM rule_layer_map rlm WHERE rlm.rule_id = ${rule.id})`.as("layerCount"),
      })
      .from(rule)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(rule.updatedAt))
      .limit(perPage)
      .offset(offset),
    db.select({ count: count() }).from(rule).where(conditions.length ? and(...conditions) : undefined),
  ]);

  return { rows, total: total.count };
}

export async function getRuleById(id: string) {
  const rows = await db.select().from(rule).where(eq(rule.id, id)).limit(1);
  if (!rows[0]) return null;

  const [layers, stacks, suggestedLayers] = await Promise.all([
    db.select({ layerId: ruleLayerMap.layerId, layerName: layer.name, layerSlug: layer.slug })
      .from(ruleLayerMap)
      .innerJoin(layer, eq(ruleLayerMap.layerId, layer.id))
      .where(eq(ruleLayerMap.ruleId, id)),
    db.select({ stackId: ruleStack.stackId, stackName: stack.name, stackSlug: stack.slug })
      .from(ruleStack)
      .innerJoin(stack, eq(ruleStack.stackId, stack.id))
      .where(eq(ruleStack.ruleId, id)),
    // Suggest layers based on threats linked to this rule via rule_threat_map → threat_layer
    db.selectDistinct({ layerId: threatLayer.layerId, layerName: layer.name })
      .from(ruleThreatMap)
      .innerJoin(threatLayer, eq(ruleThreatMap.threatId, threatLayer.threatId))
      .innerJoin(layer, eq(threatLayer.layerId, layer.id))
      .where(eq(ruleThreatMap.ruleId, id)),
  ]);

  return { rule: rows[0], layers, stacks, suggestedLayers };
}

export async function listThreats(params: { page: number; perPage: number; search?: string; severity?: string }) {
  const { page, perPage, search, severity } = params;
  const offset = (page - 1) * perPage;

  const conditions = [];
  if (search) conditions.push(ilike(threat.name, `%${search}%`));
  if (severity) conditions.push(eq(threat.severity, severity as "critical" | "high" | "medium" | "low" | "info"));

  const [rows, [total]] = await Promise.all([
    db
      .select({
        publicId: threat.publicId,
        name: threat.name,
        severity: threat.severity,
        family: threat.family,
        source: threat.source,
        isActivelyExploited: threat.isActivelyExploited,
        publishedAt: threat.publishedAt,
        cveId: threat.cveId,
        layerCount: sql<number>`(SELECT count(*) FROM threat_layer tl WHERE tl.threat_id = "threat"."public_id")`,
        stackCount: sql<number>`(SELECT count(*) FROM threat_stack ts WHERE ts.threat_id = "threat"."public_id")`,
      })
      .from(threat)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(threat.publishedAt))
      .limit(perPage)
      .offset(offset),
    db.select({ count: count() }).from(threat).where(conditions.length ? and(...conditions) : undefined),
  ]);

  return { rows, total: total.count };
}

export async function getThreatById(id: string) {
  const rows = await db.select().from(threat).where(eq(threat.publicId, id)).limit(1);
  if (!rows[0]) return null;

  const [threatLayers, threatStacks] = await Promise.all([
    db.select({ layerId: threatLayer.layerId, layerName: layer.name, relevance: threatLayer.relevance, rationale: threatLayer.rationale })
      .from(threatLayer)
      .innerJoin(layer, eq(threatLayer.layerId, layer.id))
      .where(eq(threatLayer.threatId, id)),
    db.select({ stackId: threatStack.stackId, stackName: stack.name, severity: threatStack.severity })
      .from(threatStack)
      .innerJoin(stack, eq(threatStack.stackId, stack.id))
      .where(eq(threatStack.threatId, id)),
  ]);

  return { threat: rows[0], layers: threatLayers, stacks: threatStacks };
}

export async function listLayers() {
  return db
    .select({
      id: layer.id,
      slug: layer.slug,
      name: layer.name,
      description: layer.description,
      isSystem: layer.isSystem,
      isActive: layer.isActive,
      sortOrder: layer.sortOrder,
      iconName: layer.iconName,
      colorToken: layer.colorToken,
      ruleCount: sql<number>`(SELECT count(*) FROM rule_layer_map rlm WHERE rlm.layer_id = "layer"."id")`,
      threatCount: sql<number>`(SELECT count(*) FROM threat_layer tl WHERE tl.layer_id = "layer"."id")`,
      policyCount: sql<number>`(SELECT count(*) FROM policy_template pt WHERE pt.layer_id = "layer"."id")`,
    })
    .from(layer)
    .orderBy(layer.sortOrder);
}

export async function listPatterns(params: { page: number; perPage: number }) {
  const { page, perPage } = params;
  const offset = (page - 1) * perPage;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: policyTemplate.id,
        slug: policyTemplate.slug,
        name: policyTemplate.name,
        description: policyTemplate.description,
        layerId: policyTemplate.layerId,
        layerName: layer.name,
        sortOrder: policyTemplate.sortOrder,
        stackCount: sql<number>`(SELECT count(*) FROM policy_template_stack pts WHERE pts.template_id = "policy_template"."id")`,
      })
      .from(policyTemplate)
      .innerJoin(layer, eq(policyTemplate.layerId, layer.id))
      .orderBy(policyTemplate.sortOrder)
      .limit(perPage)
      .offset(offset),
    db.select({ count: count() }).from(policyTemplate),
  ]);

  return { rows, total: total.count };
}

export async function listUsers(params: { page: number; perPage: number; search?: string }) {
  const { page, perPage, search } = params;
  const offset = (page - 1) * perPage;
  const likeExpr = `%${search ?? ""}%`;
  const conditions = search
    ? [sql`(${user.name} ILIKE ${likeExpr} OR ${user.email} ILIKE ${likeExpr})`]
    : [];

  const [rows, [total]] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, emailVerified: user.emailVerified })
      .from(user)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(user.name)
      .limit(perPage)
      .offset(offset),
    db.select({ count: count() }).from(user).where(conditions.length ? and(...conditions) : undefined),
  ]);

  return { rows, total: total.count };
}

export async function listSyncLogs(params: { page: number; perPage: number }) {
  const { page, perPage } = params;
  const offset = (page - 1) * perPage;
  const [rows, [total]] = await Promise.all([
    db.select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(perPage).offset(offset),
    db.select({ count: count() }).from(syncLog),
  ]);
  return { rows, total: total.count };
}

export async function listGuardrails(params: {
  page: number;
  perPage: number;
  stackSlug?: string;
  layerSlug?: string;
}) {
  const { page, perPage, stackSlug, layerSlug } = params;
  const offset = (page - 1) * perPage;

  const conditions = [];
  if (stackSlug) conditions.push(eq(stack.slug, stackSlug));
  if (layerSlug) conditions.push(eq(layer.slug, layerSlug));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: summarizedGuardrail.id,
        stackId: summarizedGuardrail.stackId,
        stackSlug: stack.slug,
        stackName: stack.name,
        layerId: summarizedGuardrail.layerId,
        layerSlug: layer.slug,
        layerName: layer.name,
        ideSlug: summarizedGuardrail.ideSlug,
        summarizerVersion: summarizedGuardrail.summarizerVersion,
        conflictCount: summarizedGuardrail.conflictCount,
        generatedAt: summarizedGuardrail.generatedAt,
        expiresAt: summarizedGuardrail.expiresAt,
        cacheKey: summarizedGuardrail.cacheKey,
        content: summarizedGuardrail.content,
        sourceRuleIds: summarizedGuardrail.sourceRuleIds,
        qualityScore: summarizedGuardrail.qualityScore,
        scoreOverride: summarizedGuardrail.scoreOverride,
        scoreNote: summarizedGuardrail.scoreNote,
      })
      .from(summarizedGuardrail)
      .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
      .innerJoin(layer, eq(summarizedGuardrail.layerId, layer.id))
      .where(where)
      .orderBy(desc(summarizedGuardrail.generatedAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: count() })
      .from(summarizedGuardrail)
      .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
      .innerJoin(layer, eq(summarizedGuardrail.layerId, layer.id))
      .where(where),
  ]);
  return { rows, total: total.count };
}

export async function getSourceRoutingConfig() {
  const [sourceMappings, owaspMappings, allLayers] = await Promise.all([
    db
      .select({
        id: sourceLayerMapping.id,
        source: sourceLayerMapping.source,
        layerId: sourceLayerMapping.layerId,
        layerName: layer.name,
        layerSlug: layer.slug,
        relevance: sourceLayerMapping.relevance,
        isActive: sourceLayerMapping.isActive,
        notes: sourceLayerMapping.notes,
      })
      .from(sourceLayerMapping)
      .innerJoin(layer, eq(sourceLayerMapping.layerId, layer.id))
      .orderBy(sourceLayerMapping.source),
    db
      .select({
        id: owaspLayerMapping.id,
        owaspRef: owaspLayerMapping.owaspRef,
        layerId: owaspLayerMapping.layerId,
        layerName: layer.name,
        relevance: owaspLayerMapping.relevance,
        isActive: owaspLayerMapping.isActive,
      })
      .from(owaspLayerMapping)
      .innerJoin(layer, eq(owaspLayerMapping.layerId, layer.id))
      .orderBy(owaspLayerMapping.owaspRef),
    db.select({ id: layer.id, name: layer.name, slug: layer.slug }).from(layer).orderBy(layer.sortOrder),
  ]);

  return { sourceMappings, owaspMappings, allLayers };
}

const LLM_TASKS = [
  "guardrail_summarization",
  "threat_amplification",
  "rule_summarization",
  "content_ingest",
] as const;

export type LLMTask = (typeof LLM_TASKS)[number];

export const LLM_TASK_LABELS: Record<LLMTask, string> = {
  guardrail_summarization: "Guardrail summarization",
  threat_amplification: "Threat AI amplification",
  rule_summarization: "Rule body summarization",
  content_ingest: "Content ingest",
};

export const AVAILABLE_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "claude-haiku-4-5",
] as const;

export async function getLLMConfig() {
  const [cfg, taskRows] = await Promise.all([
    db.select().from(llmConfig).limit(1),
    db.select().from(llmTaskConfig),
  ]);

  const global = cfg[0] ?? {
    id: 0,
    provider: "anthropic" as const,
    defaultModel: "claude-sonnet-4-6",
    summarizerEnabled: false,
    updatedAt: new Date(),
  };

  const taskMap = Object.fromEntries(taskRows.map((r) => [r.task, r]));

  const TASK_DEFAULT_MODELS: Record<LLMTask, string> = {
    threat_amplification: "claude-haiku-4-5",
    content_ingest: "claude-sonnet-4-6",
    rule_summarization: "claude-sonnet-4-6",
    guardrail_summarization: "claude-sonnet-4-6",
  };

  const tasks = LLM_TASKS.map((task) => ({
    task,
    label: LLM_TASK_LABELS[task],
    model: taskMap[task]?.model ?? TASK_DEFAULT_MODELS[task],
    enabled: taskMap[task]?.enabled ?? true,
  }));

  return { global, tasks };
}

// ── Core objective metrics ────────────────────────────────────────────────────

export async function getCoreObjectiveMetrics() {
  const [
    amplificationResult,
    guardrailCountResult,
    stackCountResult,
    activeLayerCountResult,
    scoreResult,
    layerAssignedResult,
  ] = await Promise.all([
    // Objective 1: threats with aiAmplification populated
    db.select({
      amplified: sql<number>`COUNT(CASE WHEN ${threat.aiAmplification} IS NOT NULL THEN 1 END)::int`,
      total: sql<number>`COUNT(*)::int`,
    }).from(threat),

    // Objective 2: guardrails that exist
    db.select({ covered: sql<number>`COUNT(*)::int` }).from(summarizedGuardrail),

    // Denominators for coverage
    db.select({ n: sql<number>`COUNT(*)::int` }).from(stack),
    db.select({ n: sql<number>`COUNT(*)::int` }).from(layer).where(eq(layer.isActive, true)),

    // Objective 3: avg quality score and conflict-free count
    db.select({
      avgScore: sql<number | null>`AVG(COALESCE(${summarizedGuardrail.scoreOverride}, ${summarizedGuardrail.qualityScore}))`,
      conflictFree: sql<number>`COUNT(CASE WHEN ${summarizedGuardrail.conflictCount} = 0 THEN 1 END)::int`,
      guardrailTotal: sql<number>`COUNT(*)::int`,
    }).from(summarizedGuardrail),

    // Objective 4: threats with at least one layer assignment
    db.select({ assigned: sql<number>`COUNT(DISTINCT ${threatLayer.threatId})::int` }).from(threatLayer),
  ]);

  const totalThreats = amplificationResult[0]?.total ?? 0;
  const amplified = amplificationResult[0]?.amplified ?? 0;
  const covered = guardrailCountResult[0]?.covered ?? 0;
  const totalPairs = (stackCountResult[0]?.n ?? 0) * (activeLayerCountResult[0]?.n ?? 0);
  const avgScore = scoreResult[0]?.avgScore;
  const conflictFree = scoreResult[0]?.conflictFree ?? 0;
  const guardrailTotal = scoreResult[0]?.guardrailTotal ?? 0;
  const layerAssigned = layerAssignedResult[0]?.assigned ?? 0;

  return {
    amplified,
    totalThreats,
    amplificationPercent: totalThreats > 0 ? Math.round((amplified / totalThreats) * 100) : 0,
    guardrailsCovered: covered,
    totalPairs,
    coveragePercent: totalPairs > 0 ? Math.round((covered / totalPairs) * 100) : 0,
    avgQualityScore: avgScore != null ? Math.round(Number(avgScore) * 10) / 10 : null,
    conflictFreeCount: conflictFree,
    guardrailTotal,
    conflictFreePercent: guardrailTotal > 0 ? Math.round((conflictFree / guardrailTotal) * 100) : 0,
    layerAssignedThreats: layerAssigned,
    layerAssignmentPercent: totalThreats > 0 ? Math.round((layerAssigned / totalThreats) * 100) : 0,
  };
}

// ── Pipeline phase status ─────────────────────────────────────────────────────

export async function getPipelinePhaseStatus() {
  const [
    latestRunResult,
    unamplifiedResult,
    unassignedResult,
    staleGuardrailsResult,
    zeroStrengthRulesResult,
    zombieRunsResult,
  ] = await Promise.all([
    // Latest sync run
    db.select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(1),

    // Phase 2: threats needing amplification
    db.select({ count: sql<number>`COUNT(*)::int` }).from(threat).where(isNull(threat.aiAmplification)),

    // Phase 4: threats with 0 layer assignments
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(threat)
      .leftJoin(threatLayer, eq(threat.publicId, threatLayer.threatId))
      .where(isNull(threatLayer.threatId)),

    // Phase 4: stale guardrails (expiresAt in the past)
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(summarizedGuardrail)
      .where(lt(summarizedGuardrail.expiresAt, new Date())),

    // Phase 3: rules with strength 0 (proxy for unsummarized)
    db.select({ count: sql<number>`COUNT(*)::int` }).from(rule).where(eq(rule.strengthScore, 0)),

    // Zombie runs: stuck "running" for > 30 min
    db.select({ id: syncLog.id, startedAt: syncLog.startedAt })
      .from(syncLog)
      .where(and(
        eq(syncLog.status, "running"),
        lt(syncLog.startedAt, new Date(Date.now() - 30 * 60 * 1000)),
      )),
  ]);

  return {
    lastSyncRun: latestRunResult[0] ?? null,
    sourceSummary: (latestRunResult[0]?.sourceSummary ?? {}) as Record<string, unknown>,
    unamplifiedThreats: unamplifiedResult[0]?.count ?? 0,
    unassignedThreats: unassignedResult[0]?.count ?? 0,
    staleGuardrails: staleGuardrailsResult[0]?.count ?? 0,
    zeroStrengthRules: zeroStrengthRulesResult[0]?.count ?? 0,
    zombieRuns: zombieRunsResult,
  };
}

// ── Guardrail quality score (0–10) ────────────────────────────────────────────

/** Compute a 0–10 quality score for a synthesized guardrail. */
export function computeQualityScore(row: {
  conflictCount: number;
  sourceRuleCount: number;
  contentLength: number;
  generatedAt: Date;
}): number {
  // Conflict penalty: 0 conflicts = 10, each conflict costs 1.5 points, floor 0
  const conflictScore    = Math.max(0, 10 - row.conflictCount * 1.5);
  // Breadth: 2 points per source rule, max 10
  const breadthScore     = Math.min(10, (row.sourceRuleCount ?? 0) * 2);
  // Completeness: 1 point per 200 chars, max 10 (~2000 chars = full marks)
  const completenessScore = Math.min(10, (row.contentLength ?? 0) / 200);
  // Freshness: loses 0.3 points per day, floor 0
  const daysSince        = (Date.now() - row.generatedAt.getTime()) / 86_400_000;
  const freshnessScore   = Math.max(0, 10 - daysSince * 0.3);
  return Math.round((conflictScore + breadthScore + completenessScore + freshnessScore) / 4);
}

// ── Guardrail coverage + evaluation data ──────────────────────────────────────

export async function getGuardrailCoverage() {
  const [
    allStacksResult,
    allActiveLayersResult,
    [coveredPairsRow],
    perStackResult,
    coveredPerStackRows,
    [qualityStatsRow],
    matrixRows,
    uncoveredResult,
  ] = await Promise.all([
    // Total stacks
    db.select({ count: count() }).from(stack),

    // Total active layers
    db.select({ count: count() }).from(layer).where(eq(layer.isActive, true)),

    // Covered pairs (have a summarized_guardrail row)
    db.select({ count: count() }).from(summarizedGuardrail),

    // Per-stack: total distinct layers from rules
    db.execute<{ stackId: number; stackName: string; stackSlug: string; totalLayers: number }>(sql`
      SELECT s.id AS "stackId", s.name AS "stackName", s.slug AS "stackSlug",
             COUNT(DISTINCT rlm.layer_id)::int AS "totalLayers"
      FROM rule
      JOIN rule_stack rs ON rs.rule_id = rule.id
      JOIN stack s ON s.id = rs.stack_id
      JOIN rule_layer_map rlm ON rlm.rule_id = rule.id
      JOIN layer l ON l.id = rlm.layer_id
      WHERE l.is_active = true
      GROUP BY s.id, s.name, s.slug
      ORDER BY s.sort_order
    `),

    // Per-stack: covered layers (have a guardrail)
    db
      .select({
        stackId: summarizedGuardrail.stackId,
        coveredLayers: count(summarizedGuardrail.id),
      })
      .from(summarizedGuardrail)
      .groupBy(summarizedGuardrail.stackId),

    // Aggregate quality stats
    db
      .select({
        avgScore: sql<number>`ROUND(AVG(${summarizedGuardrail.qualityScore}), 1)`,
        avgConflicts: sql<number>`ROUND(AVG(${summarizedGuardrail.conflictCount}), 1)`,
        zeroConflictCount: sql<number>`COUNT(*) FILTER (WHERE ${summarizedGuardrail.conflictCount} = 0)`,
        needsAttentionCount: sql<number>`COUNT(*) FILTER (WHERE ${summarizedGuardrail.qualityScore} < 5)`,
        totalCount: count(),
      })
      .from(summarizedGuardrail),

    // Per-guardrail quality matrix
    db
      .select({
        id: summarizedGuardrail.id,
        stackName: stack.name,
        stackSlug: stack.slug,
        layerName: layer.name,
        layerSlug: layer.slug,
        conflictCount: summarizedGuardrail.conflictCount,
        sourceRuleCount: sql<number>`array_length(${summarizedGuardrail.sourceRuleIds}, 1)`,
        contentLength: sql<number>`char_length(${summarizedGuardrail.content})`,
        qualityScore: summarizedGuardrail.qualityScore,
        scoreOverride: summarizedGuardrail.scoreOverride,
        scoreNote: summarizedGuardrail.scoreNote,
        generatedAt: summarizedGuardrail.generatedAt,
        expiresAt: summarizedGuardrail.expiresAt,
        summarizerVersion: summarizedGuardrail.summarizerVersion,
      })
      .from(summarizedGuardrail)
      .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
      .innerJoin(layer, eq(summarizedGuardrail.layerId, layer.id))
      .orderBy(stack.sortOrder, layer.sortOrder),

    // Uncovered pairs (no guardrail yet) — derived from rules
    db.execute<{ stackName: string; stackSlug: string; layerName: string; layerSlug: string; stackId: number; layerId: string }>(sql`
      SELECT s.name AS "stackName", s.slug AS "stackSlug",
             l.name AS "layerName", l.slug AS "layerSlug",
             pairs.stack_id AS "stackId", pairs.layer_id AS "layerId"
      FROM (
        SELECT DISTINCT rs.stack_id, rlm.layer_id
        FROM rule
        JOIN rule_stack rs ON rs.rule_id = rule.id
        JOIN rule_layer_map rlm ON rlm.rule_id = rule.id
        JOIN layer l ON l.id = rlm.layer_id
        WHERE l.is_active = true
      ) pairs
      JOIN stack s ON s.id = pairs.stack_id
      JOIN layer l ON l.id = pairs.layer_id
      LEFT JOIN summarized_guardrail sg
        ON sg.stack_id = pairs.stack_id AND sg.layer_id = pairs.layer_id
      WHERE sg.id IS NULL
      ORDER BY s.sort_order, l.sort_order
    `),
  ]);

  const allStacksCount = allStacksResult[0]?.count ?? 0;
  const allActiveLayersCount = allActiveLayersResult[0]?.count ?? 0;
  const totalPairs = allStacksCount * allActiveLayersCount;
  const coveredPairs = coveredPairsRow?.count ?? 0;

  // Merge per-stack coverage
  const coveredMap = new Map(coveredPerStackRows.map((r) => [r.stackId, r.coveredLayers]));
  const perStack = (perStackResult.rows as { stackId: number; stackName: string; stackSlug: string; totalLayers: number }[]).map((r) => ({
    stackId: r.stackId,
    stackName: r.stackName,
    stackSlug: r.stackSlug,
    totalLayers: r.totalLayers,
    coveredLayers: coveredMap.get(r.stackId) ?? 0,
  }));

  return {
    totalPairs,
    coveredPairs,
    coveragePct: totalPairs > 0 ? Math.round((coveredPairs / totalPairs) * 100) : 0,
    perStack,
    qualityStats: qualityStatsRow ?? {
      avgScore: 0,
      avgConflicts: 0,
      zeroConflictCount: 0,
      needsAttentionCount: 0,
      totalCount: 0,
    },
    matrixRows,
    uncoveredPairs: uncoveredResult.rows,
  };
}
