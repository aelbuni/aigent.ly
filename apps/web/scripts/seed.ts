import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALL_CATALOG_STACK_SLUGS,
  COMING_SOON_STACK_SLUGS,
  isShippableThreat,
  LAUNCH_STACK_SLUGS,
} from "@aigently/mvp-catalog";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import {
  db,
  ide,
  policyTemplate,
  policyTemplateStack,
  rule,
  ruleIde,
  ruleLayerMap,
  ruleStack,
  ruleReview,
  ruleReviewHelpful,
  ruleThreatMap,
  ruleUsageDaily,
  stack,
  stackCoverageArea,
  stackFrameworkFeature,
  threat,
  threatStack,
} from "../lib/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const CATALOG_DIR = join(REPO_ROOT, "packages", "catalog-data");

const CONTEXT_WARN_CHARS = 450;

type MasterThreat = {
  publicId: string;
  externalId?: string | null;
  cveId?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  family: string;
  name: string;
  description?: string | null;
  severity?: string | null;
  owaspRefs?: string[];
  mitreAttackIds?: string[];
  affectedProducts?: { name?: string; vulnerableVersions?: string; patchedVersions?: string }[];
  isActivelyExploited?: boolean;
  publishedAt?: string | null;
  syncedAt?: string | null;
  stacks?: string[];
  ruleHint?: string | null;
  /** Short catalog curator override for guardrail Context (plain English). */
  ruleContext?: string | null;
  /** Imperative lines; emitted as `MUST: …` one per line. */
  mustLines?: string[] | null;
  /** Overrides ALWAYS pin line when set. */
  alwaysPin?: string | null;
};

type MasterFile = {
  version?: string;
  generatedAt?: string;
  threats: MasterThreat[];
};

type ThreatStackFile = {
  threatStackRows: { threatId: string; stackSlug: string; severity: string }[];
};

const STACK_DISPLAY: Record<string, { name: string; ecosystem?: string; nvdKeywords?: string[]; osv?: string }> = {
  nextjs: { name: "Next.js", ecosystem: "npm", nvdKeywords: ["next.js", "react"], osv: "npm" },
  "react-spa": { name: "React SPA", ecosystem: "npm", nvdKeywords: ["react"], osv: "npm" },
  express: { name: "Express / Node.js", ecosystem: "npm", nvdKeywords: ["express", "node.js"], osv: "npm" },
  nestjs: { name: "NestJS", ecosystem: "npm", nvdKeywords: ["nestjs"], osv: "npm" },
  nuxt: { name: "Nuxt", ecosystem: "npm", nvdKeywords: ["nuxt"], osv: "npm" },
  fastapi: { name: "FastAPI / Python", ecosystem: "pypi", nvdKeywords: ["fastapi"], osv: "PyPI" },
  django: { name: "Django", ecosystem: "pypi", nvdKeywords: ["django"], osv: "PyPI" },
  rails: { name: "Ruby on Rails", ecosystem: "rubygems", nvdKeywords: ["rails"], osv: "RubyGems" },
  go: { name: "Go", ecosystem: "go", nvdKeywords: ["gin"], osv: "Go" },
  ios: { name: "iOS / Swift", ecosystem: "swift", nvdKeywords: ["ios"], osv: "SwiftPM" },
  android: { name: "Android / Kotlin", ecosystem: "maven", nvdKeywords: ["android"], osv: "Maven" },
};

function mapThreatSource(raw: string | null | undefined, sourceUrl: string): "ghsa" | "nvd" | "osv" | "cisa_kev" {
  const u = sourceUrl.toLowerCase();
  if (u.includes("nvd.nist.gov")) return "nvd";
  if (u.includes("cisa.gov")) return "cisa_kev";
  if (u.includes("github.com/advisories") || raw === "npm") return "ghsa";
  return "osv";
}

function stripMdcFrontmatter(raw: string): string {
  if (!raw.startsWith("---\n")) return raw;
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return raw;
  return raw.slice(end + 5).trimStart();
}

/** Fallback Context text: strip markdown noise, first ~2 sentences, ~320 char cap at sentence end. */
function compactDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.replace(/\s+/g, " ").replace(/\*\*|#{1,6}\s?|`+/g, "").trim();
  const sentences = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = sentences.slice(0, 2).join(" ");
  if (out.length > 320) {
    out = out.slice(0, 320);
    const lastPeriod = Math.max(out.lastIndexOf(". "), out.lastIndexOf("! "), out.lastIndexOf("? "));
    if (lastPeriod > 120) out = out.slice(0, lastPeriod + 1);
  }
  return out.trim();
}

function pinLineFromProducts(t: MasterThreat): string {
  const products = t.affectedProducts ?? [];
  return products
    .map((p) => {
      const n = p.name ?? "package";
      const v = p.patchedVersions ?? "";
      return v ? `${n} ${v}` : n;
    })
    .join("; ");
}

function buildStackRuleBody(stackSlug: string, rows: MasterThreat[]): string {
  const lines: string[] = [
    `# ${STACK_DISPLAY[stackSlug]?.name ?? stackSlug} security guardrails`,
    "",
    "MVP guardrails derived from verified CVE rows linked to this stack in the catalog.",
    "",
  ];
  const sorted = [...rows].sort((a, b) => {
    const sev = (s: string | null | undefined) =>
      s === "critical" ? 0 : s === "high" ? 1 : s === "medium" ? 2 : 3;
    return sev(a.severity) - sev(b.severity);
  });
  for (const t of sorted.slice(0, 24)) {
    const id = (t.cveId ?? t.publicId).trim();
    let context =
      (t.ruleContext ?? "").trim() || compactDescription(t.description ?? "") || "See vendor advisory for impact.";
    if (t.isActivelyExploited && !/actively exploited/i.test(context)) {
      context = `${context} Actively exploited in the wild.`.trim();
    }
    if (context.length > CONTEXT_WARN_CHARS) {
      console.warn(
        `Gate 2 warning: threat ${id} Context length ${context.length} chars (budget ≤${CONTEXT_WARN_CHARS}); consider shortening ruleContext in seed-master.json`
      );
    }

    const hint = (t.ruleHint ?? "").trim();
    const mustLines = (t.mustLines ?? []).map((s) => s.trim()).filter(Boolean);
    const pinOverride = (t.alwaysPin ?? "").trim();
    const pin = pinOverride || pinLineFromProducts(t);

    lines.push(`### Prevents ${id}: ${t.name}`);
    lines.push("");
    lines.push(`Context: ${context}`);
    lines.push("");
    if (mustLines.length > 0) {
      for (const m of mustLines) lines.push(`MUST: ${m}`);
    } else if (hint) {
      lines.push(`MUST apply vendor guidance: ${hint}`);
    }
    if (pin) lines.push(`ALWAYS use patched version: ${pin}`);
    lines.push("NEVER deploy a release line known to include this CVE without mitigation.");
    lines.push("");
  }
  return lines.join("\n");
}

function imperativeLineCount(body: string): number {
  return body.split("\n").filter((line) => /^\s*(NEVER|ALWAYS|MUST:|MUST\b)/i.test(line.trim())).length;
}

async function clearCatalog() {
  await db.delete(ruleThreatMap);
  await db.delete(ruleUsageDaily);
  await db.delete(ruleReviewHelpful);
  await db.delete(ruleReview);
  await db.delete(ruleIde);
  await db.delete(ruleLayerMap);
  await db.delete(ruleStack);
  await db.delete(rule);
  await db.delete(threatStack);
  await db.delete(threat);
  await db.delete(policyTemplateStack);
  await db.delete(policyTemplate);
  await db.delete(stackFrameworkFeature);
  await db.delete(stackCoverageArea);
  await db.delete(stack).where(inArray(stack.slug, [...ALL_CATALOG_STACK_SLUGS]));
}

async function upsertCatalogStacks() {
  let sort = 1;
  for (const slug of LAUNCH_STACK_SLUGS) {
    const meta = STACK_DISPLAY[slug];
    if (!meta) throw new Error(`Missing STACK_DISPLAY for ${slug}`);
    const sortOrder = sort++;
    await db
      .insert(stack)
      .values({
        slug,
        name: meta.name,
        sortOrder,
        catalogStatus: "launch",
        ecosystem: meta.ecosystem,
        nvdKeywords: meta.nvdKeywords ?? [],
        osvEcosystem: meta.osv,
        securityGrade: null,
        gradeRationale: null,
      })
      .onConflictDoUpdate({
        target: stack.slug,
        set: {
          name: meta.name,
          sortOrder,
          catalogStatus: "launch",
          ecosystem: meta.ecosystem,
          nvdKeywords: meta.nvdKeywords ?? [],
          osvEcosystem: meta.osv,
        },
      });
  }
  for (const slug of COMING_SOON_STACK_SLUGS) {
    const meta = STACK_DISPLAY[slug];
    if (!meta) throw new Error(`Missing STACK_DISPLAY for ${slug}`);
    const sortOrder = sort++;
    await db
      .insert(stack)
      .values({
        slug,
        name: meta.name,
        sortOrder,
        catalogStatus: "coming_soon",
        ecosystem: meta.ecosystem,
        nvdKeywords: meta.nvdKeywords ?? [],
        osvEcosystem: meta.osv,
        securityGrade: null,
        gradeRationale: null,
      })
      .onConflictDoUpdate({
        target: stack.slug,
        set: {
          name: meta.name,
          sortOrder,
          catalogStatus: "coming_soon",
          ecosystem: meta.ecosystem,
          nvdKeywords: meta.nvdKeywords ?? [],
          osvEcosystem: meta.osv,
        },
      });
  }
}

async function insertThreatsAndStacks(
  shipped: MasterThreat[],
  shipIds: Set<string>,
  threatStacks: ThreatStackFile,
  stackIdBySlug: Map<string, number>
) {
  for (const t of shipped) {
    const src = mapThreatSource(t.source ?? null, (t.sourceUrl ?? "").trim());
    const syncedAt = t.syncedAt ? new Date(t.syncedAt) : new Date();
    const publishedAt = t.publishedAt ? new Date(t.publishedAt) : null;
    const products = Array.isArray(t.affectedProducts) ? t.affectedProducts : [];
    await db
      .insert(threat)
      .values({
        publicId: t.publicId,
        family: t.family as "owasp_web" | "owasp_llm" | "mitre_atlas" | "vibe_coding",
        name: t.name,
        severity: (t.severity ?? "medium") as "critical" | "high" | "medium" | "low" | "info",
        description: t.description ?? undefined,
        cveId: t.cveId ?? undefined,
        externalId: (t.externalId ?? t.publicId).trim(),
        source: src,
        sourceUrl: (t.sourceUrl ?? "").trim(),
        publishedAt,
        syncedAt,
        owaspRefs: [...(t.owaspRefs ?? [])],
        mitreAttackIds: [...(t.mitreAttackIds ?? [])],
        affectedProducts: products as unknown as Record<string, unknown>,
        isActivelyExploited: t.isActivelyExploited ?? false,
      })
      .onConflictDoUpdate({
        target: threat.publicId,
        set: {
          name: t.name,
          severity: (t.severity ?? "medium") as "critical" | "high" | "medium" | "low" | "info",
          description: t.description ?? null,
          cveId: t.cveId ?? null,
          externalId: (t.externalId ?? t.publicId).trim(),
          source: src,
          sourceUrl: (t.sourceUrl ?? "").trim(),
          syncedAt,
          owaspRefs: [...(t.owaspRefs ?? [])],
          mitreAttackIds: [...(t.mitreAttackIds ?? [])],
          affectedProducts: products as unknown as Record<string, unknown>,
          isActivelyExploited: t.isActivelyExploited ?? false,
          updatedAt: new Date(),
        },
      });
  }

  for (const row of threatStacks.threatStackRows) {
    if (!shipIds.has(row.threatId)) continue;
    const sid = stackIdBySlug.get(row.stackSlug);
    if (sid === undefined) continue;
    await db
      .insert(threatStack)
      .values({
        threatId: row.threatId,
        stackId: sid,
        severity: row.severity as "critical" | "high" | "medium" | "low" | "info",
        isMitigatedByRules: false,
      })
      .onConflictDoUpdate({
        target: [threatStack.threatId, threatStack.stackId],
        set: {
          severity: row.severity as "critical" | "high" | "medium" | "low" | "info",
        },
      });
  }
}

async function reconcileRuleForStack(
  ruleId: string,
  stackId: number,
  ideIdBySlug: Map<string, number | undefined>
) {
  await db.delete(ruleStack).where(eq(ruleStack.ruleId, ruleId));
  await db.insert(ruleStack).values({ ruleId, stackId });

  const desiredRows = await db
    .select({ publicId: threat.publicId })
    .from(threatStack)
    .innerJoin(threat, eq(threatStack.threatId, threat.publicId))
    .where(eq(threatStack.stackId, stackId));
  const ids = desiredRows.map((r) => r.publicId);

  if (ids.length > 0) {
    await db
      .delete(ruleThreatMap)
      .where(and(eq(ruleThreatMap.ruleId, ruleId), notInArray(ruleThreatMap.threatId, ids)));
  }
  for (const threatId of ids) {
    await db.insert(ruleThreatMap).values({ ruleId, threatId }).onConflictDoNothing();
  }

  for (const ideSlug of ["cursor", "claude-code", "windsurf", "copilot", "cline"] as const) {
    const ideId = ideIdBySlug.get(ideSlug);
    if (ideId !== undefined) {
      await db.insert(ruleIde).values({ ruleId, ideId }).onConflictDoNothing();
    }
  }

  await db.delete(ruleLayerMap).where(eq(ruleLayerMap.ruleId, ruleId));
  await db.insert(ruleLayerMap).values({ ruleId, layer: "security" }).onConflictDoNothing();
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function seedUpsert(master: MasterFile, threatStacks: ThreatStackFile, shipped: MasterThreat[]) {
  const shipIds = new Set(shipped.map((t) => t.publicId));

  await upsertCatalogStacks();

  await db
    .insert(ide)
    .values([
      { slug: "cursor", name: "Cursor", sortOrder: 1 },
      { slug: "claude-code", name: "Claude Code", sortOrder: 2 },
      { slug: "windsurf", name: "Windsurf", sortOrder: 3 },
      { slug: "cline", name: "Cline", sortOrder: 4 },
      { slug: "copilot", name: "GitHub Copilot", sortOrder: 5 },
    ])
    .onConflictDoNothing({ target: ide.slug });

  const stackRows = await db.select().from(stack).where(inArray(stack.slug, [...ALL_CATALOG_STACK_SLUGS]));
  const stackIdBySlug = new Map(stackRows.map((s) => [s.slug, s.id]));

  await insertThreatsAndStacks(shipped, shipIds, threatStacks, stackIdBySlug);

  const ideRows = await db.select().from(ide);
  const ideIdBySlug = new Map(ideRows.map((i) => [i.slug, i.id]));

  const nextjsMdc = readFileSync(join(CATALOG_DIR, "nextjs-cursor-security.mdc"), "utf8");
  const nextjsBody = stripMdcFrontmatter(nextjsMdc);

  const threatsByStack = new Map<string, MasterThreat[]>();
  for (const t of shipped) {
    for (const s of t.stacks ?? []) {
      if (!(LAUNCH_STACK_SLUGS as readonly string[]).includes(s)) continue;
      const arr = threatsByStack.get(s) ?? [];
      arr.push(t);
      threatsByStack.set(s, arr);
    }
  }

  for (const stackSlug of LAUNCH_STACK_SLUGS) {
    const stackId = stackIdBySlug.get(stackSlug)!;
    const slug = `${stackSlug}-security-guardrails-v1`;
    const body =
      stackSlug === "nextjs" ? nextjsBody : buildStackRuleBody(stackSlug, threatsByStack.get(stackSlug) ?? []);
    const stackMeta = STACK_DISPLAY[stackSlug]!;

    const [upserted] = await db
      .insert(rule)
      .values({
        slug,
        name: `${stackMeta.name} security guardrails`,
        description: `Certified guardrails mapped to verified CVEs for ${stackMeta.name}.`,
        version: "1.0.0",
        dateAdded: "2026-05-06",
        lastUpdated: todayDateStr(),
        author: "aigently",
        certified: true,
        lineCount: body.split("\n").length,
        bodyMdx: body,
      })
      .onConflictDoUpdate({
        target: rule.slug,
        set: {
          name: `${stackMeta.name} security guardrails`,
          description: `Certified guardrails mapped to verified CVEs for ${stackMeta.name}.`,
          version: "1.0.0",
          lastUpdated: todayDateStr(),
          lineCount: body.split("\n").length,
          bodyMdx: body,
          updatedAt: new Date(),
        },
      })
      .returning({ id: rule.id });

    const ruleId = upserted!.id;
    await reconcileRuleForStack(ruleId, stackId, ideIdBySlug);
  }

  console.log(
    `Seed upsert complete: ${shipped.length} shippable threats, rules upserted for ${LAUNCH_STACK_SLUGS.length} launch stacks (catalog from ${master.generatedAt ?? "seed-master.json"}).`
  );
}

async function seedFull(master: MasterFile, threatStacks: ThreatStackFile, shipped: MasterThreat[]) {
  const shipIds = new Set(shipped.map((t) => t.publicId));

  await clearCatalog();

  let sort = 1;
  for (const slug of LAUNCH_STACK_SLUGS) {
    const meta = STACK_DISPLAY[slug];
    if (!meta) throw new Error(`Missing STACK_DISPLAY for ${slug}`);
    await db.insert(stack).values({
      slug,
      name: meta.name,
      sortOrder: sort++,
      catalogStatus: "launch",
      ecosystem: meta.ecosystem,
      nvdKeywords: meta.nvdKeywords ?? [],
      osvEcosystem: meta.osv,
      securityGrade: null,
      gradeRationale: null,
    });
  }
  for (const slug of COMING_SOON_STACK_SLUGS) {
    const meta = STACK_DISPLAY[slug];
    if (!meta) throw new Error(`Missing STACK_DISPLAY for ${slug}`);
    await db.insert(stack).values({
      slug,
      name: meta.name,
      sortOrder: sort++,
      catalogStatus: "coming_soon",
      ecosystem: meta.ecosystem,
      nvdKeywords: meta.nvdKeywords ?? [],
      osvEcosystem: meta.osv,
      securityGrade: null,
      gradeRationale: null,
    });
  }

  await db
    .insert(ide)
    .values([
      { slug: "cursor", name: "Cursor", sortOrder: 1 },
      { slug: "claude-code", name: "Claude Code", sortOrder: 2 },
      { slug: "windsurf", name: "Windsurf", sortOrder: 3 },
      { slug: "cline", name: "Cline", sortOrder: 4 },
      { slug: "copilot", name: "GitHub Copilot", sortOrder: 5 },
    ])
    .onConflictDoNothing({ target: ide.slug });

  const stackRows = await db.select().from(stack).where(inArray(stack.slug, [...ALL_CATALOG_STACK_SLUGS]));
  const stackIdBySlug = new Map(stackRows.map((s) => [s.slug, s.id]));

  await insertThreatsAndStacks(shipped, shipIds, threatStacks, stackIdBySlug);

  const ideRows = await db.select().from(ide);
  const ideIdBySlug = new Map(ideRows.map((i) => [i.slug, i.id]));

  const nextjsMdc = readFileSync(join(CATALOG_DIR, "nextjs-cursor-security.mdc"), "utf8");
  const nextjsBody = stripMdcFrontmatter(nextjsMdc);

  const threatsByStack = new Map<string, MasterThreat[]>();
  for (const t of shipped) {
    for (const s of t.stacks ?? []) {
      if (!(LAUNCH_STACK_SLUGS as readonly string[]).includes(s)) continue;
      const arr = threatsByStack.get(s) ?? [];
      arr.push(t);
      threatsByStack.set(s, arr);
    }
  }

  for (const stackSlug of LAUNCH_STACK_SLUGS) {
    const stackId = stackIdBySlug.get(stackSlug)!;
    const slug = `${stackSlug}-security-guardrails-v1`;
    const body =
      stackSlug === "nextjs" ? nextjsBody : buildStackRuleBody(stackSlug, threatsByStack.get(stackSlug) ?? []);
    const insertedRule = await db
      .insert(rule)
      .values({
        slug,
        name: `${STACK_DISPLAY[stackSlug]!.name} security guardrails`,
        description: `Certified guardrails mapped to verified CVEs for ${STACK_DISPLAY[stackSlug]!.name}.`,
        version: "1.0.0",
        dateAdded: "2026-05-06",
        lastUpdated: todayDateStr(),
        author: "aigently",
        certified: true,
        lineCount: body.split("\n").length,
        bodyMdx: body,
      })
      .returning({ id: rule.id });

    const ruleId = insertedRule[0]!.id;
    await db.insert(ruleStack).values({ ruleId, stackId }).onConflictDoNothing();
    for (const ideSlug of ["cursor", "claude-code", "windsurf", "copilot", "cline"] as const) {
      const ideId = ideIdBySlug.get(ideSlug);
      if (ideId !== undefined) {
        await db.insert(ruleIde).values({ ruleId, ideId }).onConflictDoNothing();
      }
    }
    await db.insert(ruleLayerMap).values({ ruleId, layer: "security" }).onConflictDoNothing();

    const linkThreats = await db
      .select({ publicId: threat.publicId })
      .from(threatStack)
      .innerJoin(threat, eq(threatStack.threatId, threat.publicId))
      .where(eq(threatStack.stackId, stackId));

    for (const { publicId } of linkThreats) {
      await db.insert(ruleThreatMap).values({ ruleId, threatId: publicId }).onConflictDoNothing();
    }
  }

  console.log(
    `Seed complete: ${shipped.length} shippable threats, stacks launch+coming_soon, ${LAUNCH_STACK_SLUGS.length} rules (catalog from ${master.generatedAt ?? "seed-master.json"}).`
  );
}

async function runGates() {
  const certifiedRules = await db.select({ id: rule.id, slug: rule.slug }).from(rule).where(eq(rule.certified, true));
  for (const r of certifiedRules) {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(ruleThreatMap)
      .where(eq(ruleThreatMap.ruleId, r.id));
    if ((cnt?.n ?? 0) < 1) {
      throw new Error(`Gate 1 failed: certified rule ${r.slug} has no rule_threat_map rows`);
    }
  }

  for (const r of await db.select().from(rule)) {
    const n = imperativeLineCount(r.bodyMdx ?? "");
    if (n < 10) {
      console.warn(`Gate 2 warning: rule ${r.slug} has ${n} imperative lines (target ≥10)`);
    }
  }
}

async function main() {
  const masterRaw = readFileSync(join(CATALOG_DIR, "seed-master.json"), "utf8");
  const tsRaw = readFileSync(join(CATALOG_DIR, "seed-threat-stack.json"), "utf8");
  const master = JSON.parse(masterRaw) as MasterFile;
  const threatStacks = JSON.parse(tsRaw) as ThreatStackFile;

  const shipped = master.threats.filter((t) =>
    isShippableThreat({
      publicId: t.publicId,
      cveId: t.cveId,
      sourceUrl: t.sourceUrl,
    })
  );

  const mode = process.env.SEED_MODE === "upsert" ? "upsert" : "full";
  if (mode === "upsert") {
    await seedUpsert(master, threatStacks, shipped);
  } else {
    await seedFull(master, threatStacks, shipped);
  }

  await runGates();

  if (process.env.SEED_URL_HEAD_CHECK === "1") {
    const urlRows = await db.select({ url: threat.sourceUrl }).from(threat);
    const seen = new Set<string>();
    for (const { url } of urlRows) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      try {
        const res = await fetch(url, { method: "HEAD", redirect: "follow" });
        if (!res.ok) console.warn(`HEAD ${url} → ${res.status}`);
      } catch (e) {
        console.warn(`HEAD failed ${url}`, e);
      }
    }
  }
}

function isConnRefused(err: unknown): boolean {
  const e = err as { cause?: { code?: string; errors?: { code?: string }[] } };
  if (e?.cause?.code === "ECONNREFUSED") return true;
  const nested = e?.cause?.errors;
  if (Array.isArray(nested) && nested.some((x) => x?.code === "ECONNREFUSED")) return true;
  return (err as NodeJS.ErrnoException)?.code === "ECONNREFUSED";
}

main().catch((e) => {
  if (isConnRefused(e)) {
    console.error(
      "Cannot reach PostgreSQL (ECONNREFUSED). From repo root run: npm run db:up\n" +
        "Then check DATABASE_URL in apps/web/.env (default postgresql://aigently:aigently@localhost:5433/aigently)."
    );
  }
  console.error(e);
  process.exit(1);
});
