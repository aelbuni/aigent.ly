import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import type { CatalogSnapshotV1, CatalogThreat, CatalogThreatStack } from "./catalogTypes.js";
import { upsertCatalogToDb } from "./upsertCatalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `apps/sync/src` → monorepo root */
const REPO_ROOT = join(__dirname, "../../..");

loadEnv({ path: join(REPO_ROOT, "apps/web/.env") });
loadEnv({ path: join(REPO_ROOT, ".env") });

const KEV_URL =
  process.env.CISA_KEV_URL ??
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

const rawCap = Number(process.env.CATALOG_KEV_CAP ?? "40");
const CAP = Math.min(500, Math.max(5, Number.isFinite(rawCap) && rawCap > 0 ? rawCap : 40));

type KevFile = {
  vulnerabilities?: Array<{
    cveID: string;
    vendorProject?: string;
    product?: string;
    vulnerabilityName?: string;
    shortDescription?: string;
    dateAdded?: string;
  }>;
};

function defaultOutPath(): string {
  return process.env.CATALOG_OUT ?? join(REPO_ROOT, "apps/web/public/data/catalog.json");
}

function inferFamily(name: string, desc: string): CatalogThreat["family"] {
  const blob = `${name} ${desc}`.toLowerCase();
  if (blob.includes("llm") || blob.includes("model context") || blob.includes("rag"))
    return "owasp_llm";
  if (blob.includes("supply chain") || blob.includes("typosquat") || blob.includes("registry"))
    return "vibe_coding";
  if (blob.includes("mitre") || blob.includes("atlas") || blob.includes("ml "))
    return "mitre_atlas";
  return "owasp_web";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "aigently-catalog-sync/1.0 (+https://github.com)",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

async function loadKevThreats(): Promise<{ threats: CatalogThreat[]; ingested: number }> {
  const doc = await fetchJson<KevFile>(KEV_URL);
  const vulns = doc.vulnerabilities ?? [];
  const slice = vulns.slice(0, CAP);
  const threats: CatalogThreat[] = slice.map((v) => {
    const name = v.vulnerabilityName ?? v.cveID;
    const vendorProduct = `${v.vendorProject ?? ""} ${v.product ?? ""}`.trim();
    const desc = v.shortDescription ?? (vendorProduct.length > 0 ? vendorProduct : null);
    const family = inferFamily(name, desc ?? "");
    return {
      publicId: v.cveID,
      family,
      name,
      severity: "high",
      description: desc,
      cveId: v.cveID,
      externalId: v.cveID,
      source: "cisa_kev",
      sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      isActivelyExploited: true,
    };
  });
  return { threats, ingested: slice.length };
}

async function loadOsvSample(): Promise<{ threats: CatalogThreat[]; meta: CatalogSnapshotV1["syncMeta"]["osv"] }> {
  const ecosystem = process.env.CATALOG_OSV_ECOSYSTEM ?? "npm";
  const meta: CatalogSnapshotV1["syncMeta"]["osv"] = { ecosystem, ingested: 0 };
  try {
    const body = {
      package: { ecosystem, name: process.env.CATALOG_OSV_PACKAGE ?? "next" },
    };
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OSV query ${res.status}`);
    const data = (await res.json()) as { vulns?: Array<{ id: string; summary?: string }> };
    const vulns = (data.vulns ?? []).slice(0, 5);
    const threats: CatalogThreat[] = vulns.map((v) => ({
      publicId: v.id,
      family: "owasp_web",
      name: v.summary ?? v.id,
      severity: "medium",
      description: v.summary ?? null,
      cveId: v.id.startsWith("CVE-") ? v.id : null,
      externalId: v.id,
      source: "osv",
      sourceUrl: `https://osv.dev/vulnerability/${encodeURIComponent(v.id)}`,
      isActivelyExploited: false,
    }));
    meta.ingested = threats.length;
    return { threats, meta };
  } catch (e) {
    meta.error = e instanceof Error ? e.message : String(e);
    return { threats: [], meta };
  }
}

async function loadGhsaSample(): Promise<{ threats: CatalogThreat[]; meta: NonNullable<CatalogSnapshotV1["syncMeta"]["ghsa"]> }> {
  const token = process.env.GITHUB_TOKEN;
  const meta: NonNullable<CatalogSnapshotV1["syncMeta"]["ghsa"]> = { ingested: 0 };
  if (!token) {
    meta.error = "GITHUB_TOKEN not set";
    return { threats: [], meta };
  }
  try {
    const query = `query($n:Int!){ securityAdvisories(first:$n orderBy:{field:UPDATED_AT direction:DESC}){ nodes { ghsaId summary severity permalink }}}`;
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "aigently-catalog-sync",
      },
      body: JSON.stringify({ query, variables: { n: 8 } }),
    });
    if (!res.ok) throw new Error(`GHSA GraphQL ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        securityAdvisories?: {
          nodes: Array<{ ghsaId: string; summary: string; severity: string; permalink: string }>;
        };
      };
      errors?: { message: string }[];
    };
    if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
    const nodes = body.data?.securityAdvisories?.nodes ?? [];
    const sevMap: Record<string, CatalogThreat["severity"]> = {
      CRITICAL: "critical",
      HIGH: "high",
      MODERATE: "medium",
      MEDIUM: "medium",
      LOW: "low",
    };
    const threats: CatalogThreat[] = nodes.map((n) => ({
      publicId: n.ghsaId,
      family: "owasp_web",
      name: n.summary.slice(0, 200),
      severity: sevMap[n.severity] ?? "medium",
      description: n.summary,
      cveId: null,
      externalId: n.ghsaId,
      source: "ghsa",
      sourceUrl: n.permalink,
      isActivelyExploited: false,
    }));
    meta.ingested = threats.length;
    return { threats, meta };
  } catch (e) {
    meta.error = e instanceof Error ? e.message : String(e);
    return { threats: [], meta };
  }
}

function buildThreatStacks(threats: CatalogThreat[]): CatalogThreatStack[] {
  const stacks = ["nextjs", "express", "fastapi"] as const;
  const out: CatalogThreatStack[] = [];
  for (let i = 0; i < Math.min(threats.length, 25); i++) {
    const t = threats[i]!;
    const slug = stacks[i % stacks.length]!;
    const sev = t.severity ?? "medium";
    out.push({
      threatPublicId: t.publicId,
      stackSlug: slug,
      severity: sev === "info" ? "low" : sev,
      isMitigatedByRules: i % 3 === 0,
    });
  }
  return out;
}

async function main() {
  const outPath = defaultOutPath();
  const syncMeta: CatalogSnapshotV1["syncMeta"] = {};

  const { threats: kevThreats, ingested } = await loadKevThreats();
  syncMeta.kev = { url: KEV_URL, ingested, cap: CAP };

  const { threats: osvThreats, meta: osvMeta } = await loadOsvSample();
  syncMeta.osv = osvMeta;

  const { threats: ghsaThreats, meta: ghsaMeta } = await loadGhsaSample();
  syncMeta.ghsa = ghsaMeta;

  const byPublic = new Map<string, CatalogThreat>();
  for (const t of [...kevThreats, ...osvThreats, ...ghsaThreats]) {
    if (!byPublic.has(t.publicId)) byPublic.set(t.publicId, t);
  }
  const threats = [...byPublic.values()];
  const threatStacks = buildThreatStacks(threats);

  const snapshot: CatalogSnapshotV1 = {
    version: 1,
    generatedAt: new Date().toISOString(),
    threats,
    threatStacks,
    syncMeta: { ...syncMeta },
  };

  const dbUrl = process.env.DATABASE_URL;
  if (process.env.CATALOG_UPSERT_DB === "1" && dbUrl) {
    try {
      await upsertCatalogToDb(snapshot, dbUrl);
      snapshot.syncMeta.dbUpsert = "ok";
    } catch (e) {
      snapshot.syncMeta.dbUpsert = "error";
      snapshot.syncMeta.dbUpsertError = e instanceof Error ? e.message : String(e);
      console.error(snapshot.syncMeta.dbUpsertError);
      process.exitCode = 1;
    }
  } else {
    snapshot.syncMeta.dbUpsert = "skipped";
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Wrote ${outPath} (${threats.length} threats, ${threatStacks.length} threatStacks).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
