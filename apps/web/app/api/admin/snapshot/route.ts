import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db } from "@/lib/db";
import {
  layer,
  rule,
  ruleLayerMap,
  ruleStack,
  ruleThreatMap,
  stack,
  summarizedGuardrail,
  threat,
  threatLayer,
  threatStack,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<Response | null> {
  if (ADMIN_BYPASS) return null;
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// ── GET — export full snapshot ────────────────────────────────────────────────

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Fetch all data in parallel
  const [
    threats,
    rules,
    layers,
    threatStackRows,
    threatLayerRows,
    ruleStackRows,
    ruleLayerRows,
    ruleThreatRows,
    guardrailRows,
  ] = await Promise.all([
    db.select().from(threat),
    db.select().from(rule),
    db.select({ id: layer.id, slug: layer.slug, name: layer.name, isSystem: layer.isSystem, isActive: layer.isActive, sortOrder: layer.sortOrder }).from(layer),
    db.select({ threatId: threatStack.threatId, stackId: threatStack.stackId, severity: threatStack.severity }).from(threatStack).innerJoin(stack, eq(threatStack.stackId, stack.id)),
    db.select({ threatId: threatLayer.threatId, layerId: threatLayer.layerId, relevance: threatLayer.relevance }).from(threatLayer).innerJoin(layer, eq(threatLayer.layerId, layer.id)),
    db.select({ ruleId: ruleStack.ruleId, stackId: ruleStack.stackId }).from(ruleStack),
    db.select({ ruleId: ruleLayerMap.ruleId, layerId: ruleLayerMap.layerId }).from(ruleLayerMap),
    db.select({ ruleId: ruleThreatMap.ruleId, threatId: ruleThreatMap.threatId }).from(ruleThreatMap),
    db.select({
      id: summarizedGuardrail.id,
      stackId: summarizedGuardrail.stackId,
      layerId: summarizedGuardrail.layerId,
      ideSlug: summarizedGuardrail.ideSlug,
      content: summarizedGuardrail.content,
      sourceRuleIds: summarizedGuardrail.sourceRuleIds,
      conflictCount: summarizedGuardrail.conflictCount,
      cacheKey: summarizedGuardrail.cacheKey,
      summarizerVersion: summarizedGuardrail.summarizerVersion,
      generatedAt: summarizedGuardrail.generatedAt,
    }).from(summarizedGuardrail),
  ]);

  // Build lookup maps
  const stackRows = await db.select({ id: stack.id, slug: stack.slug }).from(stack);
  const stackById = new Map(stackRows.map((s) => [s.id, s.slug]));
  const layerById = new Map(layers.map((l) => [l.id, l.slug]));
  const ruleById = new Map(rules.map((r) => [r.id, r.slug]));

  // Group relations by ID
  const threatStacksBythreatId = new Map<string, { slug: string; severity: string }[]>();
  for (const ts of threatStackRows) {
    const slug = stackById.get(ts.stackId);
    if (!slug) continue;
    const arr = threatStacksBythreatId.get(ts.threatId) ?? [];
    arr.push({ slug, severity: ts.severity });
    threatStacksBythreatId.set(ts.threatId, arr);
  }

  const threatLayersByThreatId = new Map<string, { slug: string; relevance: string }[]>();
  for (const tl of threatLayerRows) {
    const slug = layerById.get(tl.layerId);
    if (!slug) continue;
    const arr = threatLayersByThreatId.get(tl.threatId) ?? [];
    arr.push({ slug, relevance: tl.relevance ?? "primary" });
    threatLayersByThreatId.set(tl.threatId, arr);
  }

  const ruleStacksByRuleId = new Map<string, string[]>();
  for (const rs of ruleStackRows) {
    const slug = stackById.get(rs.stackId);
    if (!slug) continue;
    const arr = ruleStacksByRuleId.get(rs.ruleId) ?? [];
    arr.push(slug);
    ruleStacksByRuleId.set(rs.ruleId, arr);
  }

  const ruleLayersByRuleId = new Map<string, string[]>();
  for (const rl of ruleLayerRows) {
    const slug = layerById.get(rl.layerId);
    if (!slug) continue;
    const arr = ruleLayersByRuleId.get(rl.ruleId) ?? [];
    arr.push(slug);
    ruleLayersByRuleId.set(rl.ruleId, arr);
  }

  const ruleThreatsByRuleId = new Map<string, string[]>();
  for (const rt of ruleThreatRows) {
    const arr = ruleThreatsByRuleId.get(rt.ruleId) ?? [];
    arr.push(rt.threatId);
    ruleThreatsByRuleId.set(rt.ruleId, arr);
  }

  // Assemble snapshot
  const snapshot = {
    version: "1",
    exportedAt: new Date().toISOString(),
    counts: {
      threats: threats.length,
      rules: rules.length,
      layers: layers.length,
      guardrails: guardrailRows.length,
    },

    layers,

    threats: threats.map((t) => ({
      publicId: t.publicId,
      cveId: t.cveId,
      externalId: t.externalId,
      family: t.family,
      name: t.name,
      severity: t.severity,
      description: t.description,
      source: t.source,
      sourceUrl: t.sourceUrl,
      owaspRefs: t.owaspRefs,
      mitreAttackIds: t.mitreAttackIds,
      affectedProducts: t.affectedProducts,
      patchedVersion: t.patchedVersion,
      isActivelyExploited: t.isActivelyExploited,
      cisaActionDue: t.cisaActionDue,
      publishedAt: t.publishedAt,
      syncedAt: t.syncedAt,
      aiAmplification: t.aiAmplification,
      stacks: threatStacksBythreatId.get(t.publicId) ?? [],
      layers: threatLayersByThreatId.get(t.publicId) ?? [],
    })),

    rules: rules.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      version: r.version,
      dateAdded: r.dateAdded,
      lastUpdated: r.lastUpdated,
      author: r.author,
      certified: r.certified,
      ruleType: r.ruleType,
      lineCount: r.lineCount,
      strengthScore: r.strengthScore,
      bodyMdx: r.bodyMdx,
      summaryMdx: r.summaryMdx,
      stacks: ruleStacksByRuleId.get(r.id) ?? [],
      layers: ruleLayersByRuleId.get(r.id) ?? [],
      threatIds: ruleThreatsByRuleId.get(r.id) ?? [],
    })),

    guardrails: guardrailRows.map((g) => ({
      stackSlug: stackById.get(g.stackId) ?? null,
      layerSlug: layerById.get(g.layerId) ?? null,
      ideSlug: g.ideSlug,
      content: g.content,
      sourceRuleSlugs: (g.sourceRuleIds ?? []).map((id) => ruleById.get(id) ?? id),
      conflictCount: g.conflictCount,
      cacheKey: g.cacheKey,
      summarizerVersion: g.summarizerVersion,
      generatedAt: g.generatedAt,
    })),
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="aigently-snapshot-${date}.json"`,
    },
  });
}

// ── POST — import snapshot ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let snapshot: ReturnType<typeof parseSnapshot>;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }
    const text = await (file as File).text();
    snapshot = parseSnapshot(JSON.parse(text));
  } catch {
    return Response.json({ error: "Invalid JSON file" }, { status: 400 });
  }

  const counts = { threats: 0, rules: 0, guardrails: 0, skipped: 0 };

  // Build slug→id maps from current DB state
  const [stackRows, layerRows, ruleRows] = await Promise.all([
    db.select({ id: stack.id, slug: stack.slug }).from(stack),
    db.select({ id: layer.id, slug: layer.slug }).from(layer),
    db.select({ id: rule.id, slug: rule.slug }).from(rule),
  ]);
  const stackBySlug = new Map(stackRows.map((s) => [s.slug, s.id]));
  let layerBySlug = new Map(layerRows.map((l) => [l.slug, l.id]));
  const ruleBySlug = new Map(ruleRows.map((r) => [r.slug, r.id]));

  // 1. Upsert layers
  for (const l of snapshot.layers) {
    await db
      .insert(layer)
      .values({ id: l.id, slug: l.slug, name: l.name, description: "", concernStatement: "", isSystem: l.isSystem, isActive: l.isActive, sortOrder: l.sortOrder })
      .onConflictDoUpdate({
        target: layer.slug,
        set: { name: l.name, isActive: l.isActive, sortOrder: l.sortOrder },
      });
  }
  // Refresh layer map after upserts
  const refreshedLayers = await db.select({ id: layer.id, slug: layer.slug }).from(layer);
  layerBySlug = new Map(refreshedLayers.map((l) => [l.slug, l.id]));

  // 2. Upsert threats
  for (const t of snapshot.threats) {
    await db
      .insert(threat)
      .values({
        publicId: t.publicId,
        family: t.family as Parameters<typeof db.insert>[0] extends never ? never : "owasp_web",
        name: t.name,
        severity: t.severity as never,
        description: t.description ?? null,
        source: t.source as never,
        sourceUrl: t.sourceUrl ?? null,
        cveId: t.cveId ?? null,
        externalId: t.externalId ?? null,
        owaspRefs: t.owaspRefs ?? [],
        mitreAttackIds: t.mitreAttackIds ?? [],
        affectedProducts: t.affectedProducts ?? {},
        patchedVersion: t.patchedVersion ?? null,
        isActivelyExploited: t.isActivelyExploited ?? false,
        cisaActionDue: t.cisaActionDue ?? null,
        publishedAt: t.publishedAt ? new Date(t.publishedAt) : null,
        syncedAt: t.syncedAt ? new Date(t.syncedAt) : null,
        aiAmplification: t.aiAmplification ?? null,
      })
      .onConflictDoUpdate({
        target: threat.publicId,
        set: {
          name: t.name,
          severity: t.severity as never,
          description: t.description ?? null,
          owaspRefs: t.owaspRefs ?? [],
          mitreAttackIds: t.mitreAttackIds ?? [],
          affectedProducts: t.affectedProducts ?? {},
          patchedVersion: t.patchedVersion ?? null,
          isActivelyExploited: t.isActivelyExploited ?? false,
          cisaActionDue: t.cisaActionDue ?? null,
          syncedAt: t.syncedAt ? new Date(t.syncedAt) : null,
          aiAmplification: t.aiAmplification ?? null,
        },
      });
    counts.threats++;

    // threat_stack
    for (const ts of t.stacks ?? []) {
      const stackId = stackBySlug.get(ts.slug);
      if (!stackId) continue;
      await db
        .insert(threatStack)
        .values({ threatId: t.publicId, stackId, severity: ts.severity as never })
        .onConflictDoUpdate({ target: [threatStack.threatId, threatStack.stackId], set: { severity: ts.severity as never } });
    }

    // threat_layer
    for (const tl of t.layers ?? []) {
      const layerId = layerBySlug.get(tl.slug);
      if (!layerId) continue;
      await db
        .insert(threatLayer)
        .values({ threatId: t.publicId, layerId, relevance: tl.relevance as "primary" | "secondary", rationale: "imported from snapshot" })
        .onConflictDoUpdate({ target: [threatLayer.threatId, threatLayer.layerId], set: { relevance: tl.relevance as "primary" | "secondary" } });
    }
  }

  // 3. Upsert rules
  for (const r of snapshot.rules) {
    await db
      .insert(rule)
      .values({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description ?? "",
        version: r.version ?? "1.0.0",
        dateAdded: r.dateAdded ?? new Date().toISOString().slice(0, 10),
        lastUpdated: r.lastUpdated ?? new Date().toISOString().slice(0, 10),
        author: r.author ?? "import",
        certified: r.certified ?? false,
        ruleType: r.ruleType as "pattern" | "deps" | "config" | "runtime",
        lineCount: r.lineCount ?? null,
        strengthScore: r.strengthScore ?? 0,
        bodyMdx: r.bodyMdx ?? null,
        summaryMdx: r.summaryMdx ?? null,
      })
      .onConflictDoUpdate({
        target: rule.slug,
        set: { bodyMdx: r.bodyMdx ?? null, summaryMdx: r.summaryMdx ?? null, name: r.name },
      });
    counts.rules++;

    // Refresh ruleBySlug after each insert (id may have changed on conflict)
    const freshRule = await db.select({ id: rule.id }).from(rule).where(eq(rule.slug, r.slug)).limit(1);
    const ruleId = freshRule[0]?.id ?? r.id;
    ruleBySlug.set(r.slug, ruleId);

    // rule_stack
    for (const stackSlug of r.stacks ?? []) {
      const stackId = stackBySlug.get(stackSlug);
      if (!stackId) continue;
      await db.insert(ruleStack).values({ ruleId, stackId }).onConflictDoNothing();
    }

    // rule_layer_map
    for (const layerSlug of r.layers ?? []) {
      const layerId = layerBySlug.get(layerSlug);
      if (!layerId) continue;
      await db.insert(ruleLayerMap).values({ ruleId, layerId }).onConflictDoNothing();
    }

    // rule_threat_map
    for (const threatId of r.threatIds ?? []) {
      await db.insert(ruleThreatMap).values({ ruleId, threatId }).onConflictDoNothing();
    }
  }

  // 4. Upsert guardrails (skip on cacheKey conflict — don't overwrite newer)
  for (const g of snapshot.guardrails) {
    const stackId = g.stackSlug ? stackBySlug.get(g.stackSlug) : null;
    const layerId = g.layerSlug ? layerBySlug.get(g.layerSlug) : null;
    if (!stackId || !layerId) { counts.skipped++; continue; }

    const sourceRuleIds = (g.sourceRuleSlugs ?? [])
      .map((slug: string) => ruleBySlug.get(slug))
      .filter(Boolean) as string[];

    const inserted = await db
      .insert(summarizedGuardrail)
      .values({
        stackId,
        layerId,
        ideSlug: g.ideSlug ?? "all",
        content: g.content,
        sourceRuleIds,
        conflictCount: g.conflictCount ?? 0,
        cacheKey: g.cacheKey,
        summarizerVersion: g.summarizerVersion ?? "imported",
        generatedAt: g.generatedAt ? new Date(g.generatedAt) : new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: summarizedGuardrail.id });

    if (inserted.length > 0) counts.guardrails++;
    else counts.skipped++;
  }

  return Response.json({ imported: counts, ok: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSnapshot(data: unknown) {
  if (typeof data !== "object" || data === null || !("version" in data)) {
    throw new Error("Not a valid snapshot file");
  }
  return data as {
    version: string;
    layers: { id: string; slug: string; name: string; isSystem: boolean; isActive: boolean; sortOrder: number }[];
    threats: {
      publicId: string; cveId?: string | null; externalId?: string | null;
      family: string; name: string; severity?: string | null; description?: string | null;
      source: string; sourceUrl?: string | null; owaspRefs?: string[]; mitreAttackIds?: string[];
      affectedProducts?: unknown; patchedVersion?: string | null;
      isActivelyExploited?: boolean; cisaActionDue?: string | null;
      publishedAt?: string | null; syncedAt?: string | null;
      aiAmplification?: unknown;
      stacks?: { slug: string; severity: string }[];
      layers?: { slug: string; relevance: string }[];
    }[];
    rules: {
      id: string; slug: string; name: string; description?: string; version?: string;
      dateAdded?: string; lastUpdated?: string; author?: string; certified?: boolean;
      ruleType: string; lineCount?: number | null;
      strengthScore?: number; bodyMdx?: string | null; summaryMdx?: string | null;
      stacks?: string[]; layers?: string[]; threatIds?: string[];
    }[];
    guardrails: {
      stackSlug?: string | null; layerSlug?: string | null; ideSlug?: string;
      content: string; sourceRuleSlugs?: string[]; conflictCount?: number;
      cacheKey: string; summarizerVersion?: string; generatedAt?: string;
    }[];
  };
}
