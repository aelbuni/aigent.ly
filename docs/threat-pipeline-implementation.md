# Threat Ingestion Pipeline — Implementation Plan

## Context

Aigently needs an automated pipeline to ingest CVEs and vulnerability advisories from external
sources (npm Audit, OSV.dev, GitHub Advisory, NVD, CISA KEV) and normalise them into the
existing `threat` / `threat_stack` / `sync_log` tables. The DB schema is already fully migrated.

A secondary goal is making stacks easy to onboard: adding a stack currently requires editing
three files. This plan collapses that into one.

---

## Verified Codebase Facts

| Fact | Value |
| --- | --- |
| Schema location | `packages/db/src/schema.ts` — all 5 target tables exist |
| DB client | `apps/web/lib/db/index.ts` — exports `db`, `pool`, and all schema tables |
| Env loading | `lib/load-web-env.ts` loads `apps/web/.env` (not `.env.local`) |
| Import pattern | Scripts use relative paths (`../lib/db`), never `@/` alias |
| `tsx` | `^4.21.0` in `apps/web` devDependencies |
| GitHub Actions | Existing workflows use `node-version: "22"` and `npm ci` |
| `syncLog.status` | Plain `text` column — pass `"running"` / `"success"` / `"failed"` |
| `db.execute()` | Returns `{ rows: T[] }` on `drizzle-orm/node-postgres` |
| `stack.id` | `smallint` → Drizzle returns `number` |
| Pool export | `pool` is exported from `lib/db/index.ts` — must call `pool.end()` to exit |
| `seed.ts` pool bug | Existing `seed.ts` never calls `pool.end()` and hangs. Do NOT copy this. |

---

## Current Stack Onboarding Pain — 3 Files to Edit

| File | What it holds |
| --- | --- |
| `packages/mvp-catalog/src/launch.ts` | Hardcoded slug arrays |
| `apps/web/scripts/seed.ts` (`STACK_DISPLAY`) | Display name, ecosystem, nvdKeywords, osvEcosystem |
| `apps/web/scripts/lib/stack-config.ts` *(new, PRD)* | Pipeline config — osvPackages, ghsaEcosystem, cwePriority |

**Fix:** Make `packages/mvp-catalog/src/stack-registry.ts` the single source of truth for all
three. Every consumer derives from it.

---

## File Map

```text
packages/mvp-catalog/src/
  stack-registry.ts    ← NEW  — StackConfig type + STACK_REGISTRY (only file to edit for new stacks)
  launch.ts            ← MOD  — derive slug arrays from STACK_REGISTRY instead of hardcoding
  index.ts             ← MOD  — re-export stack-registry

apps/web/scripts/
  seed.ts              ← MOD  — replace STACK_DISPLAY with import from @aigently/mvp-catalog
  sync-threats.ts      ← NEW  — main orchestrator
  lib/
    types.ts           ← NEW
    normalise.ts       ← NEW
    upsert.ts          ← NEW
    sources/
      cisa-kev.ts      ← NEW
      npm-audit.ts     ← NEW
      osv.ts           ← NEW
      ghsa.ts          ← NEW
      nvd.ts           ← NEW

.github/workflows/
  sync-threats.yml     ← NEW
```

No `scripts/lib/stack-config.ts` — that role moves into `stack-registry.ts`.

---

## Step 1 — `packages/mvp-catalog/src/stack-registry.ts` (SSOT)

The only file that changes when adding a stack.

```typescript
export type CatalogStatus = "launch" | "coming_soon";

export interface StackConfig {
  // ── DB identity (seed.ts writes these to `stack` table) ───────────
  slug: string;
  name: string;
  catalogStatus: CatalogStatus;
  sortOrder: number;
  ecosystem: string;           // "npm" | "pypi" | "rubygems" | "go" | "swift" | "maven"

  // ── OSV.dev Phase 2 ───────────────────────────────────────────────
  osvEcosystem: string;        // sent to OSV API: "npm" | "PyPI" | "Go" | "RubyGems" | "Maven" | "SwiftURL"
  osvPackages: string[];

  // ── NVD Phase 4 ───────────────────────────────────────────────────
  nvdKeywords: string[];       // stored in stack.nvd_keywords

  // ── GitHub Advisory Phase 3 ───────────────────────────────────────
  ghsaEcosystem: string;       // "NPM" | "PIP" | "RUBYGEMS" | "GO" | "MAVEN" | "SWIFT"

  // ── npm Audit Phase 1 (npm stacks only) ───────────────────────────
  npmPackages?: Record<string, string>;

  // ── Ingestion filters ─────────────────────────────────────────────
  cwePriority: string[];
  minCvss: number;
}

export const STACK_REGISTRY: StackConfig[] = [
  // ── LAUNCH ────────────────────────────────────────────────────────
  {
    slug: "nextjs", name: "Next.js", catalogStatus: "launch", sortOrder: 1, ecosystem: "npm",
    osvEcosystem: "npm",
    osvPackages: ["next", "react", "react-dom", "react-server-dom-webpack", "react-server-dom-turbopack"],
    nvdKeywords: ["next.js", "nextjs", "vercel next"],
    ghsaEcosystem: "NPM",
    npmPackages: { "next": "14.0.0", "react": "18.0.0", "react-dom": "18.0.0",
                   "jsonwebtoken": "8.5.1", "axios": "0.21.1", "lodash": "4.17.20", "node-fetch": "2.6.1" },
    cwePriority: ["CWE-798","CWE-502","CWE-79","CWE-352","CWE-1321","CWE-22","CWE-918","CWE-285","CWE-863","CWE-400"],
    minCvss: 7.0,
  },
  {
    slug: "express", name: "Express / Node.js", catalogStatus: "launch", sortOrder: 2, ecosystem: "npm",
    osvEcosystem: "npm",
    osvPackages: ["express", "body-parser", "multer", "cors", "jsonwebtoken", "mongoose", "sequelize", "helmet"],
    nvdKeywords: ["express.js", "expressjs", "node express"],
    ghsaEcosystem: "NPM",
    npmPackages: { "express": "4.17.1", "jsonwebtoken": "8.5.1", "cors": "2.8.5",
                   "multer": "1.4.4", "lodash": "4.17.20", "mongoose": "5.13.14", "sequelize": "6.6.5" },
    cwePriority: ["CWE-22","CWE-89","CWE-1321","CWE-116","CWE-352","CWE-798","CWE-400","CWE-78","CWE-502"],
    minCvss: 7.0,
  },
  {
    slug: "fastapi", name: "FastAPI / Python", catalogStatus: "launch", sortOrder: 3, ecosystem: "pypi",
    osvEcosystem: "PyPI",
    osvPackages: ["fastapi", "starlette", "uvicorn", "pydantic", "python-jose", "passlib", "fastapi-guard"],
    nvdKeywords: ["fastapi", "starlette", "pydantic"],
    ghsaEcosystem: "PIP",
    cwePriority: ["CWE-284","CWE-89","CWE-346","CWE-942","CWE-400","CWE-20","CWE-352","CWE-94","CWE-798"],
    minCvss: 7.0,
  },
  {
    slug: "nestjs", name: "NestJS", catalogStatus: "launch", sortOrder: 4, ecosystem: "npm",
    osvEcosystem: "npm",
    osvPackages: ["@nestjs/core", "@nestjs/common", "@nestjs/platform-express", "@nestjs/jwt", "@nestjs/passport"],
    nvdKeywords: ["nestjs", "nest.js"],
    ghsaEcosystem: "NPM",
    npmPackages: { "@nestjs/core": "9.0.0", "@nestjs/common": "9.0.0",
                   "jsonwebtoken": "8.5.1", "axios": "0.21.1", "lodash": "4.17.20" },
    cwePriority: ["CWE-89","CWE-79","CWE-352","CWE-798","CWE-400","CWE-285","CWE-1321"],
    minCvss: 7.0,
  },
  {
    slug: "nuxt", name: "Nuxt", catalogStatus: "launch", sortOrder: 5, ecosystem: "npm",
    osvEcosystem: "npm",
    osvPackages: ["nuxt", "@nuxt/kit", "@nuxt/schema", "h3", "nitro"],
    nvdKeywords: ["nuxt.js", "nuxtjs", "nuxt framework"],
    ghsaEcosystem: "NPM",
    npmPackages: { "nuxt": "3.0.0", "axios": "0.21.1", "lodash": "4.17.20" },
    cwePriority: ["CWE-79","CWE-352","CWE-798","CWE-1321","CWE-400"],
    minCvss: 7.0,
  },
  {
    slug: "react-spa", name: "React SPA", catalogStatus: "launch", sortOrder: 6, ecosystem: "npm",
    osvEcosystem: "npm",
    osvPackages: ["react", "react-dom", "react-router", "react-router-dom", "axios", "create-react-app"],
    nvdKeywords: ["react spa", "create react app", "react frontend"],
    ghsaEcosystem: "NPM",
    npmPackages: { "react": "18.0.0", "react-dom": "18.0.0", "react-router-dom": "6.0.0",
                   "axios": "0.21.1", "lodash": "4.17.20" },
    cwePriority: ["CWE-79","CWE-798","CWE-359","CWE-116","CWE-285","CWE-1321"],
    minCvss: 7.0,
  },
  // ── COMING SOON ───────────────────────────────────────────────────
  {
    slug: "django", name: "Django", catalogStatus: "coming_soon", sortOrder: 7, ecosystem: "pypi",
    osvEcosystem: "PyPI",
    osvPackages: ["django", "djangorestframework", "django-cors-headers", "pillow"],
    nvdKeywords: ["django", "djangoproject"],
    ghsaEcosystem: "PIP",
    cwePriority: ["CWE-89","CWE-284","CWE-352","CWE-530","CWE-200","CWE-798"],
    minCvss: 7.0,
  },
  {
    slug: "rails", name: "Ruby on Rails", catalogStatus: "coming_soon", sortOrder: 8, ecosystem: "rubygems",
    osvEcosystem: "RubyGems",
    osvPackages: ["rails", "actionpack", "activerecord", "activesupport", "actionview"],
    nvdKeywords: ["ruby on rails", "rails framework"],
    ghsaEcosystem: "RUBYGEMS",
    cwePriority: ["CWE-915","CWE-284","CWE-352","CWE-89","CWE-79","CWE-400"],
    minCvss: 7.0,
  },
  {
    slug: "go", name: "Go", catalogStatus: "coming_soon", sortOrder: 9, ecosystem: "go",
    osvEcosystem: "Go",
    osvPackages: ["github.com/gin-gonic/gin", "github.com/golang-jwt/jwt",
                  "gorm.io/gorm", "golang.org/x/net", "golang.org/x/crypto"],
    nvdKeywords: ["gin-gonic", "golang web", "go net"],
    ghsaEcosystem: "GO",
    cwePriority: ["CWE-89","CWE-22","CWE-285","CWE-798","CWE-400","CWE-295"],
    minCvss: 7.0,
  },
  {
    slug: "ios", name: "iOS / Swift", catalogStatus: "coming_soon", sortOrder: 10, ecosystem: "swift",
    osvEcosystem: "SwiftURL",
    osvPackages: ["github.com/Alamofire/Alamofire", "github.com/realm/realm-swift"],
    nvdKeywords: ["ios swift", "apple ios sdk", "swiftui"],
    ghsaEcosystem: "SWIFT",
    cwePriority: ["CWE-312","CWE-295","CWE-200","CWE-798","CWE-532"],
    minCvss: 6.5,
  },
  {
    slug: "android", name: "Android / Kotlin", catalogStatus: "coming_soon", sortOrder: 11, ecosystem: "maven",
    osvEcosystem: "Maven",
    osvPackages: ["com.squareup.okhttp3:okhttp", "com.google.firebase:firebase-auth",
                  "androidx.security:security-crypto"],
    nvdKeywords: ["android kotlin", "android sdk", "androidx"],
    ghsaEcosystem: "MAVEN",
    cwePriority: ["CWE-312","CWE-295","CWE-532","CWE-798","CWE-200"],
    minCvss: 6.5,
  },
];

export const LAUNCH_STACK_CONFIGS     = STACK_REGISTRY.filter(s => s.catalogStatus === "launch");
export const COMING_SOON_STACK_CONFIGS = STACK_REGISTRY.filter(s => s.catalogStatus === "coming_soon");
```

---

## Step 2 — Update `packages/mvp-catalog/src/launch.ts`

The existing `LAUNCH_STACK_SLUGS` and `COMING_SOON_STACK_SLUGS` are typed as `as const` literal
tuples. The type aliases `LaunchStackSlug` and `ComingSoonStackSlug` are **exported but never
imported anywhere in the codebase** (confirmed by grep), so losing the literal tuple types is safe.

```typescript
import { STACK_REGISTRY } from "./stack-registry.js";

export const LAUNCH_STACK_SLUGS = STACK_REGISTRY
  .filter(s => s.catalogStatus === "launch")
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map(s => s.slug);                         // string[] — literal type no longer needed

export const COMING_SOON_STACK_SLUGS = STACK_REGISTRY
  .filter(s => s.catalogStatus === "coming_soon")
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map(s => s.slug);

export const ALL_CATALOG_STACK_SLUGS = [...LAUNCH_STACK_SLUGS, ...COMING_SOON_STACK_SLUGS];

export function isLaunchStackSlug(s: string): boolean {
  return LAUNCH_STACK_SLUGS.includes(s);
}

export function isComingSoonStackSlug(s: string): boolean {
  return COMING_SOON_STACK_SLUGS.includes(s);
}

// Keep existing REAL_GHSA_PUBLIC_IDS unchanged
export const REAL_GHSA_PUBLIC_IDS = new Set<string>([]);
```

---

## Step 3 — Update `packages/mvp-catalog/src/index.ts`

Add one line:

```typescript
export * from "./stack-registry.js";
```

---

## Step 4 — Update `apps/web/scripts/seed.ts`

Remove the local `STACK_DISPLAY` constant. Import `STACK_REGISTRY` and loop:

```typescript
import { STACK_REGISTRY } from "@aigently/mvp-catalog";

async function upsertCatalogStacks() {
  await Promise.all(
    STACK_REGISTRY.map(cfg =>
      db.insert(stack).values({
        slug:          cfg.slug,
        name:          cfg.name,
        sortOrder:     cfg.sortOrder,
        catalogStatus: cfg.catalogStatus,
        ecosystem:     cfg.ecosystem,
        nvdKeywords:   cfg.nvdKeywords,
        osvEcosystem:  cfg.osvEcosystem,
        securityGrade: null,
        gradeRationale: null,
      }).onConflictDoUpdate({
        target: stack.slug,
        set: {
          name:          cfg.name,
          sortOrder:     cfg.sortOrder,
          catalogStatus: cfg.catalogStatus,
          ecosystem:     cfg.ecosystem,
          nvdKeywords:   cfg.nvdKeywords,
          osvEcosystem:  cfg.osvEcosystem,
        },
      })
    )
  );
}
```

The rest of `seed.ts` is unchanged. `LAUNCH_STACK_SLUGS` / `COMING_SOON_STACK_SLUGS` imports
remain valid since `launch.ts` still exports them.

---

## Step 5 — `apps/web/scripts/lib/types.ts`

```typescript
import type { InferInsertModel } from "drizzle-orm";
import type { threat, threatStack } from "../../lib/db";

export type ThreatInsert = InferInsertModel<typeof threat>;
export type ThreatStackInsert = InferInsertModel<typeof threatStack>;

export interface AffectedProduct {
  name: string;
  ecosystem: string;
  vulnerableVersionRange: string | null;
  patchedVersions: string | null;
}

export interface NormalisedThreat {
  publicId: string;
  externalId: string;
  family: "owasp_web" | "owasp_llm" | "mitre_atlas" | "vibe_coding";
  name: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string | null;
  cveId: string | null;
  // Must match threatSourceEnum — "npm-audit" is NOT a valid value
  source: "nvd" | "osv" | "ghsa" | "cisa_kev" | "aigently" | "mitre_atlas" | "aigently_internal";
  sourceUrl: string | null;
  publishedAt: Date | null;
  owaspRefs: string[];
  mitreAttackIds: string[];
  affectedProducts: AffectedProduct[];
  patchedVersion: string | null;
  isActivelyExploited: boolean;
  cisaActionDue: string | null;
  details: Record<string, unknown>;
  affectedStackSlugs: string[];
}

export interface SourceCount {
  fetched: number;
  upserted: number;
  skipped: number;
  errors: number;
}

export interface SyncSummary {
  npm_audit: SourceCount;
  osv:       SourceCount;
  ghsa:      SourceCount;
  nvd:       SourceCount;
  cisa_kev:  { totalKev: number; newlyFlagged: number };
}
```

---

## Step 6 — `apps/web/scripts/lib/normalise.ts`

- `CWE_TO_OWASP_WEB` + `CWE_TO_OWASP_LLM` maps (exact from PRD §9)
- `mapCwesToOwasp(cwes: string[]): string[]`
- `normaliseSeverity(source, rawSeverity?, cvssScore?): SeverityLevel` — CVSS numeric takes priority
- `deduplicateThreats(threats: NormalisedThreat[]): NormalisedThreat[]`

`SOURCE_PRIORITY` keys must be actual `source` enum values — `"npm-audit"` is not valid:

```typescript
const SOURCE_PRIORITY: Record<string, number> = {
  ghsa: 3, osv: 2, nvd: 2, cisa_kev: 1, aigently: 5, mitre_atlas: 4,
};
```

---

## Step 7 — Source fetchers (`apps/web/scripts/lib/sources/`)

Each file defines inline raw API types — no external type packages needed.

| File | Exports | Rate limiting |
| --- | --- | --- |
| `cisa-kev.ts` | `fetchKevMap()` | None (single JSON blob, ~150 KB) |
| `npm-audit.ts` | `fetchNpmAdvisories()`, `normaliseNpmAdvisory()` | None |
| `osv.ts` | `fetchOsvForPackage()`, `normaliseOsvVuln()` | 300ms between requests (in orchestrator) |
| `ghsa.ts` | `fetchGhsaForEcosystem()`, `normaliseGhsa()` | 200ms between pages (inside fetcher) |
| `nvd.ts` | `enrichFromNvd()` | 650ms with API key; 6500ms without |

**`ghsa.ts`** defines its own local `sleep` for the pagination loop.
All other `sleep` calls live in the orchestrator.

**GHSA pagination guard** — the NPM ecosystem has thousands of historical advisories. Add a
`MAX_PAGES = 20` cap and only fetch the last 365 days via `?updated_after`:

```typescript
const MAX_PAGES = 20;
const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
const url = `${GHSA_BASE}?ecosystem=${ecosystem}&severity=critical,high`
          + `&per_page=100&page=${page}&updated_after=${since}`;
// ...
if (page > MAX_PAGES) break;
```

---

## Step 8 — `apps/web/scripts/lib/upsert.ts`

```typescript
import { db, threat, threatStack, syncLog } from "../../lib/db";
import { sql, eq } from "drizzle-orm";
import type { NormalisedThreat, SyncSummary } from "./types";
```

**`upsertThreat`** — conflict on `threat.externalId`; COALESCE `description` / `sourceUrl` /
`publishedAt` to preserve manual edits; **never set `aiAmplification`**:

```typescript
export async function upsertThreat(t: NormalisedThreat): Promise<void> {
  const now = new Date();
  await db.insert(threat).values({ ...row, updatedAt: now })
    .onConflictDoUpdate({
      target: threat.externalId,
      set: {
        severity:            row.severity,
        syncedAt:            now,
        isActivelyExploited: row.isActivelyExploited,
        cisaActionDue:       row.cisaActionDue,
        owaspRefs:           row.owaspRefs,
        patchedVersion:      row.patchedVersion,
        updatedAt:           now,
        description: sql`COALESCE(threat.description, EXCLUDED.description)`,
        sourceUrl:   sql`COALESCE(threat.source_url, EXCLUDED.source_url)`,
        publishedAt: sql`COALESCE(threat.published_at, EXCLUDED.published_at)`,
        // aiAmplification: intentionally absent — editorial only
      },
    });
}
```

**`upsertThreatStack`** — conflict on composite `(threatId, stackId)`; update `severity` only;
`isMitigatedByRules` is set by Phase 8, not here.

**`refreshMitigationFlags`** — single bulk UPDATE, no N+1:

```typescript
await db.execute(sql`
  UPDATE threat_stack ts
  SET is_mitigated_by_rules = EXISTS (
    SELECT 1 FROM rule_threat_map rtm WHERE rtm.threat_id = ts.threat_id
  )
  WHERE ts.threat_id = ANY(${updatedPublicIds})
`);
```

**`closeSyncLog`** — correct `.rows[0]` access on drizzle/node-postgres:

```typescript
const { rows: [{ total }] }   = await db.execute<{ total: string }>(
  sql`SELECT COUNT(*)::text AS total FROM threat`
);
const { rows: [{ covered }] } = await db.execute<{ covered: string }>(
  sql`SELECT COUNT(DISTINCT threat_id)::text AS covered FROM rule_threat_map`
);
```

---

## Step 9 — `apps/web/scripts/sync-threats.ts` (Orchestrator)

### Process lifecycle — must use `finally` for pool cleanup

The process will **hang** if `pool.end()` is not called. Wrap `main()` in a `finally`:

```typescript
import "../lib/load-web-env";   // loads apps/web/.env
import { db, stack, pool } from "../lib/db";
import { STACK_REGISTRY } from "@aigently/mvp-catalog";
// ...

async function main() {
  // ... phases
}

main()
  .catch(err => {
    console.error("Sync failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
```

Using `.finally(() => pool.end())` instead of `process.exit(1)` ensures the pool always drains
cleanly — even on exception — and the process exits naturally.

### Phase ordering — why dedup before NVD

Phase 5 (dedup) runs **before** Phase 4 (NVD enrichment) because:

- Dedup reduces the working set from ~200 raw records to ~80 unique CVEs
- NVD enrichment is rate-limited at 6500ms/CVE without an API key
- Enriching before dedup wastes quota on duplicates that get discarded

**Without `NVD_API_KEY` and 50 CVEs needing enrichment: ~5 min just for NVD.**
Always set `NVD_API_KEY` in CI — the free registration takes 2 minutes.

### OSV deduplication — deduplicate `(package, ecosystem)` pairs across stacks

The same `react` package appears in `nextjs`, `react-spa`, `nestjs`, `nuxt`, and `express`.
Without dedup, OSV gets queried 5× for the same package. Apply the same pattern used for GHSA:

```typescript
// Build deduplicated set of (package, ecosystem) pairs
const osvQueries = new Map<string, string[]>(); // "pkg::eco" → [slugs]
for (const cfg of configs) {
  for (const pkg of cfg.osvPackages) {
    const key = `${pkg}::${cfg.osvEcosystem}`;
    const slugs = osvQueries.get(key) ?? [];
    slugs.push(cfg.slug);
    osvQueries.set(key, slugs);
  }
}

for (const [key, slugs] of osvQueries) {
  const [pkg, eco] = key.split("::");
  const vulns = await fetchOsvForPackage(pkg, eco);
  for (const v of vulns) {
    for (const slug of slugs) {
      const cfg = configs.find(c => c.slug === slug)!;
      const t = normaliseOsvVuln(v, slug, cfg, kevMap);
      if (t) rawThreats.push(t); else counts.osv.skipped++;
    }
  }
  await sleep(300);
}
```

### Per-source counter attribution

Increment the correct counter by source, not `counts.osv` for everything:

```typescript
function sourceKey(source: NormalisedThreat["source"]): keyof Pick<SyncSummary, "npm_audit"|"osv"|"ghsa"> {
  if (source === "ghsa") return "ghsa";
  if (source === "osv")  return "osv";
  return "npm_audit";
}
// In Phase 6:
counts[sourceKey(t.source)].upserted++;
```

### STACK_FILTER and DRY_RUN

```typescript
const STACK_FILTER = process.env.STACK_FILTER;
const DRY_RUN      = process.env.DRY_RUN === "true";
const configs      = STACK_FILTER
  ? STACK_REGISTRY.filter(c => c.slug === STACK_FILTER)
  : STACK_REGISTRY;
```

DRY_RUN exits before Phase 6 (no DB writes):

```typescript
if (DRY_RUN) {
  console.log(`[DRY RUN] Would upsert ${toInsert.length} threats`);
  console.log(JSON.stringify(toInsert.slice(0, 5), null, 2));
  return; // pool.end() fires via .finally()
}
```

---

## Step 10 — Package script entries

`apps/web/package.json`:

```json
"sync:threats": "tsx scripts/sync-threats.ts"
```

Root `package.json`:

```json
"sync:threats": "npm run sync:threats -w web"
```

---

## Step 11 — `.github/workflows/sync-threats.yml`

```yaml
name: Sync Threat Intelligence

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

jobs:
  sync:
    name: Ingest vulnerabilities
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci

      - name: Run threat sync
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NVD_API_KEY:  ${{ secrets.NVD_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run sync:threats

      - if: failure()
        run: echo "Threat sync failed — check sync_log table"
```

---

## How to Add a New Stack

**Edit exactly one file: `packages/mvp-catalog/src/stack-registry.ts`**

```typescript
{
  slug: "spring-boot",
  name: "Spring Boot",
  catalogStatus: "coming_soon",  // change to "launch" when data is ready
  sortOrder: 12,                  // increment from last entry
  ecosystem: "maven",

  osvEcosystem: "Maven",
  osvPackages: [
    "org.springframework:spring-core",
    "org.springframework.boot:spring-boot",
    "org.springframework.security:spring-security-core",
  ],
  nvdKeywords: ["spring boot", "springframework", "spring framework"],
  ghsaEcosystem: "MAVEN",

  // npmPackages: only needed for npm-based stacks

  cwePriority: ["CWE-89", "CWE-611", "CWE-352", "CWE-918", "CWE-284", "CWE-798"],
  minCvss: 7.0,
},
```

That single edit:

- Adds slug to `ALL_CATALOG_STACK_SLUGS` (app-wide routing, filtering)
- Seeds the `stack` row in Postgres on next `npm run db:seed`
- Enrolls the stack in all pipeline phases automatically
- Shows as "coming soon" in the UI with no further code changes
- Graduates to "launch" by flipping one field + re-seeding

---

## Key Constraints

| Rule | Reason |
| --- | --- |
| `pool.end()` in `.finally()` | Process hangs without it — never copy seed.ts's omission |
| Never set `aiAmplification` | Editorial-only field; pipeline must never touch it |
| Conflict on `externalId`, not `publicId` | `externalId` is the stable cross-source upsert key |
| COALESCE `description` / `sourceUrl` | Don't overwrite curator-edited content |
| `isMitigatedByRules` only in Phase 8 | Single bulk UPDATE — not per-row in Phase 7 |
| Dedup OSV `(package, ecosystem)` pairs | Same packages appear in multiple stacks |
| Dedup GHSA by ecosystem before fetching | 5 npm stacks → only 1 NPM ecosystem fetch needed |
| GHSA: cap at 20 pages + 365-day window | NPM ecosystem has thousands of historical records |
| Counter attribution by `source` field | `counts.osv.upserted` must only count OSV-sourced threats |
| `"npm-audit"` is not a valid `source` | Must use `"ghsa"` or `"osv"` for npm advisory rows |
| Phase 5 (dedup) before Phase 4 (NVD) | Reduce NVD API calls — only enrich unique winners |
| Set `NVD_API_KEY` in CI | Without it: 6500ms/CVE — 50 CVEs = 5+ minutes |

---

## Verification

```bash
# 1. Confirm env is loadable (apps/web/.env must have DATABASE_URL)
cd apps/web

# 2. Smoke test — normalises threats, prints first 5, writes nothing
STACK_FILTER=nextjs DRY_RUN=true npx tsx scripts/sync-threats.ts

# 3. Single-stack live run
STACK_FILTER=nextjs npx tsx scripts/sync-threats.ts
# Check: SELECT status, source_summary FROM sync_log ORDER BY id DESC LIMIT 1;

# 4. Full run
npx tsx scripts/sync-threats.ts
# Check: SELECT COUNT(*) FROM threat;           -- expect >=40
#        SELECT COUNT(*) FROM threat_stack;      -- expect >=60

# 5. Idempotency — row counts identical on second run
npx tsx scripts/sync-threats.ts

# 6. Seed regression — confirm seed.ts still works after STACK_DISPLAY removal
npm run db:seed
# Check: SELECT slug, catalog_status FROM stack ORDER BY sort_order;

# 7. Process exits cleanly (no hang)
time npx tsx scripts/sync-threats.ts
# Must exit within seconds of completion, not hang
```

All PRD §26 acceptance criteria apply.
