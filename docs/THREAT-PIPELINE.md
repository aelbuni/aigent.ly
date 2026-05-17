# Threat Ingestion Pipeline

Automated daily sync of CVEs and vulnerability advisories into the `threat` / `threat_stack` / `sync_log` tables.

Sources: **npm Audit** → **OSV.dev** → **GitHub Advisory (GHSA)** → **NVD enrichment** (selective) → **CISA KEV** (preflight flag).

---

## Quick start

```bash
# Prerequisites: DATABASE_URL set in apps/web/.env
cd apps/web

# Dry run — normalises and prints threats, writes nothing to DB
STACK_FILTER=nextjs DRY_RUN=true npx tsx scripts/sync-threats.ts

# Single-stack live run
STACK_FILTER=nextjs npx tsx scripts/sync-threats.ts

# Full run (all 11 stacks)
npx tsx scripts/sync-threats.ts

# Or via workspace script from repo root
npm run sync:threats
```

---

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NVD_API_KEY` | Recommended | Without it: 6500ms/CVE rate limit. Register free at nvd.nist.gov |
| `GITHUB_TOKEN` | Recommended | Raises GHSA from 60 to 5000 req/hr. Auto-available in GitHub Actions |

The script loads `apps/web/.env` automatically (via `lib/load-web-env.ts`). Copy `.env.example` and add `DATABASE_URL` to get started.

---

## Dev flags

| Flag | Effect |
| --- | --- |
| `DRY_RUN=true` | Normalise and print first 5 threats to stdout, skip all DB writes and NVD enrichment |
| `STACK_FILTER=<slug>` | Process only one stack (e.g. `STACK_FILTER=nextjs`) |

Combine both for the fastest feedback loop:

```bash
STACK_FILTER=nextjs DRY_RUN=true npx tsx scripts/sync-threats.ts
```

---

## Data sources

### Source 0 — CISA KEV (preflight)

**What it is:** The U.S. Cybersecurity and Infrastructure Security Agency's Known Exploited Vulnerabilities catalog. Every CVE in this list has confirmed active exploitation in the wild.

**How we access it:**

- Single `GET` to `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- No authentication required
- Returns ~1,590 entries (~150 KB) in a single JSON response — no pagination

**What we collect:**

- `cveID` → used as the Map key
- `dueDate` → the CISA-mandated remediation deadline for federal agencies

**How it's used:**
This is not a threat source — it's a flag enrichment pass. The resulting `Map<cveId, { dueDate }>` is passed into every normaliser. Any threat whose `cveId` appears in this map gets:

- `isActivelyExploited = true`
- `cisaActionDue = dueDate`

**File:** [`apps/web/scripts/lib/sources/cisa-kev.ts`](../apps/web/scripts/lib/sources/cisa-kev.ts)

---

### Source 1 — npm Audit API (Phase 1)

**What it is:** The npm registry's bulk security audit endpoint. Given a synthetic `package.json`, it returns all known advisories for the pinned package versions.

**How we access it:**

- Single `POST` per stack to `https://registry.npmjs.org/-/npm/v1/security/audits/quick`
- No authentication required
- Request body is a synthetic manifest with `requires` and `dependencies`
- Response is `{ advisories: Record<id, NpmAdvisory> }`

**Which stacks use it:** Only stacks with `npmPackages` defined in `stack-registry.ts` — currently: `nextjs`, `express`, `nestjs`, `nuxt`, `react-spa`.

**What we collect per advisory:**

| npm field | Maps to |
| --- | --- |
| `id` | `externalId` as `"npm-{id}"` |
| `title` | `name` |
| `overview` | `description` |
| `severity` | `severity` (normalised) |
| `cwe[]` | `owaspRefs` via CWE→OWASP map |
| `cves[0]` | `cveId` (first CVE alias) |
| `url` | `sourceUrl` |
| `module_name` | `affectedProducts[0].name` |
| `vulnerable_versions` | `affectedProducts[0].vulnerableVersionRange` |
| `patched_versions` | `patchedVersion` |

**Drop conditions** (record silently discarded):

- Severity is `low` or `info`
- No CWE in the stack's `cwePriority` list AND no `cveId`
- No `url` AND no `cveId` (unverifiable)

**Source attribution:** Set to `"ghsa"` if a CVE alias is present, `"osv"` otherwise.

**File:** [`apps/web/scripts/lib/sources/npm-audit.ts`](../apps/web/scripts/lib/sources/npm-audit.ts)

---

### Source 2 — OSV.dev (Phase 2)

**What it is:** The Open Source Vulnerabilities database, an aggregator covering npm, PyPI, Go, RubyGems, Maven, Swift, and more. Highly structured — all version ranges are machine-readable.

**How we access it:**

- One `POST` per unique `(package, ecosystem)` pair to `https://api.osv.dev/v1/query`
- No authentication required
- Request body: `{ package: { name, ecosystem } }`
- Response: `{ vulns: OsvVuln[] }` — no pagination, returns all known vulns for that package
- **Deduplication:** packages shared across stacks (e.g. `react` appears in `nextjs`, `react-spa`, `nestjs`, `nuxt`, `express`) are queried once, then fan-out to all matching stacks
- 300ms sleep between requests

**What we collect per vulnerability:**

| OSV field | Maps to |
| --- | --- |
| `id` | `externalId` (e.g. `GHSA-xxxx`, `PYSEC-xxxx`) |
| `aliases[]` first `CVE-*` | `cveId` |
| `summary` | `name` |
| `details` | `description` |
| `database_specific.severity` | `severity` (normalised) |
| `database_specific.cwe_ids[]` | `owaspRefs` via CWE→OWASP map |
| `references[0].url` | `sourceUrl` |
| `published` | `publishedAt` |
| `affected[].package.name` | `affectedProducts[].name` |
| `affected[].package.ecosystem` | `affectedProducts[].ecosystem` |
| `affected[].ranges[0].events` | `vulnerableVersionRange` (`>={introduced} <{fixed}`) and `patchedVersions` |

**Drop conditions:**

- Severity is `low` or `info`
- No CWE in `cwePriority` AND no `cveId`
- No `sourceUrl` AND no `cveId`

**File:** [`apps/web/scripts/lib/sources/osv.ts`](../apps/web/scripts/lib/sources/osv.ts)

---

### Source 3 — GitHub Advisory Database / GHSA (Phase 3)

**What it is:** GitHub's manually reviewed security advisory database. Highest editorial quality of the three primary sources — human-curated, ecosystem-tagged, and usually the fastest to publish new CVEs.

**How we access it:**

- Paginated `GET` to `https://api.github.com/advisories`
- Optional `Authorization: Bearer {GITHUB_TOKEN}` (strongly recommended — unlocks 5000 req/hr vs 60)
- Query params: `ecosystem={ECOSYSTEM}&severity=critical,high&per_page=100&page={N}&updated_after={ISO_DATE}`
- `updated_after` = 365 days ago — avoids pulling the full historical archive on each run
- Hard cap of **20 pages** (2000 advisories max per ecosystem per run)
- 200ms sleep between pages
- **Deduplication:** ecosystems shared across stacks (e.g. all 5 npm stacks share `"NPM"`) are fetched once

**What we collect per advisory:**

| GHSA field | Maps to |
| --- | --- |
| `ghsa_id` | `externalId` |
| `cve_id` | `cveId` |
| `summary` | `name` |
| `description` | `description` |
| `severity` | `severity` (normalised) |
| `cwes[].cwe_id` | `owaspRefs` via CWE→OWASP map |
| `html_url` | `sourceUrl` |
| `published_at` | `publishedAt` |
| `vulnerabilities[].package.name` | `affectedProducts[].name` |
| `vulnerabilities[].package.ecosystem` | `affectedProducts[].ecosystem` |
| `vulnerabilities[].vulnerable_version_range` | `affectedProducts[].vulnerableVersionRange` |
| `vulnerabilities[].first_patched_version` | `patchedVersion` |

**Drop conditions:**

- Severity is `low` or `info`
- No CWE in `cwePriority` AND no `cveId`
- No `html_url` AND no `cveId`

**File:** [`apps/web/scripts/lib/sources/ghsa.ts`](../apps/web/scripts/lib/sources/ghsa.ts)

---

### Source 4 — NVD (Phase 4, selective enrichment only)

**What it is:** The NIST National Vulnerability Database. As of 2025 NVD enriches only ~15–20% of CVEs due to staffing issues. We never use it as a primary source — only to fill gaps after the three primary sources.

**How we access it:**

- One `GET` per CVE to `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={CVE_ID}`
- Optional `apiKey` header (strongly recommended — unlocks 50 req/30s vs 5 req/30s)
- Rate limits enforced in the orchestrator: **650ms** with API key, **6500ms** without
- **Only called when** a CVE is still missing a CVSS score (`severity === "info"`) OR has no CWE mappings (`owaspRefs.length === 0`)
- Runs on `toInsert` (already filtered HIGH+) after dedup — never on discarded records
- **Skipped entirely in `DRY_RUN` mode**

**What we collect:**

| NVD field | Maps to |
| --- | --- |
| `metrics.cvssMetricV31[0].cvssData.baseScore` | Overwrites `severity` via CVSS→severity map |
| `metrics.cvssMetricV31[0].cvssData.baseSeverity` | `rawSeverity` (internal, for logging) |
| `weaknesses[].description[].value` (CWE-prefixed) | Overwrites `owaspRefs` via CWE→OWASP map |
| `references[].url` | Stored in `NvdEnrichment.references` (not written to DB directly) |

**CVSS → severity mapping:**

| CVSS score | Severity |
| --- | --- |
| ≥ 9.0 | `critical` |
| ≥ 7.0 | `high` |
| ≥ 4.0 | `medium` |
| ≥ 0.1 | `low` |
| 0 | `info` |

**File:** [`apps/web/scripts/lib/sources/nvd.ts`](../apps/web/scripts/lib/sources/nvd.ts)

---

## Normalisation and deduplication

After collecting raw records from all sources, two shared transforms are applied.

### Severity normalisation

Every source uses a different severity scale. All are normalised to `critical | high | medium | low | info` before ingestion:

| Input | Normalised to |
| --- | --- |
| CVSS ≥ 9.0 (numeric) | `critical` |
| CVSS ≥ 7.0 | `high` |
| CVSS ≥ 4.0 | `medium` |
| `"critical"` (string) | `critical` |
| `"high"` (string) | `high` |
| `"moderate"` or `"medium"` | `medium` |
| `"low"` | `low` |
| anything else / missing | `info` |

Numeric CVSS score always takes priority over string severity labels.

### CWE → OWASP mapping

Every CWE found in a source record is mapped to its OWASP Top 10 category. A single CWE can produce both a Web (`A01`–`A10`) and an LLM (`LLM01`–`LLM10`) ref if it appears in both maps.

Full mapping in [`apps/web/scripts/lib/normalise.ts`](../apps/web/scripts/lib/normalise.ts). Key examples:

| CWE | Web | LLM |
| --- | --- | --- |
| CWE-89 (SQL Injection) | A03 | — |
| CWE-79 (XSS) | A03 | — |
| CWE-798 (Hardcoded Credentials) | A05 | — |
| CWE-352 (CSRF) | A08 | — |
| CWE-918 (SSRF) | A10 | — |
| CWE-20 (Improper Input Validation) | A03 | LLM01 |
| CWE-284 (Improper Access Control) | A01 | LLM06 |
| CWE-400 (Resource Exhaustion) | A06 | LLM10 |

### Deduplication

The same CVE often arrives from multiple sources in the same run (e.g. `CVE-2024-34351` from both npm Audit and GHSA). Deduplication runs after all three primary sources complete and before NVD enrichment:

1. **By `cveId`** — if two records share a CVE ID, they are merged. The higher-quality source wins the row fields; `affectedStackSlugs` is unioned.
2. **By `externalId`** — non-CVE records (e.g. `PYSEC-xxxx`) are deduped on their OSV/GHSA ID.

Source quality priority (highest wins): `aigently (5) > ghsa (3) > osv = nvd (2) > cisa_kev (1)`

---

## How the pipeline works

```text
Phase 0  GET cisa.gov KEV JSON → Map<cveId, { dueDate }>   (no auth, ~150 KB)
         SELECT * FROM stack → stackIdMap                   (DB read)

Phase 1  POST registry.npmjs.org/audits/quick              (npm stacks only)
         One request per stack, no auth required

Phase 2  POST api.osv.dev/v1/query                         (all stacks)
         One request per unique (package, ecosystem) pair
         300ms between requests

Phase 3  GET api.github.com/advisories                     (all stacks)
         One paginated fetch per unique ecosystem (not per stack)
         200ms between pages, 20-page cap, 365-day window
         Optional GITHUB_TOKEN for higher rate limit

Phase 5  Deduplicate: merge by cveId, then by externalId
         (runs before Phase 4 to reduce NVD API calls)

         Filter: drop severity=low/info

         DRY_RUN exits here — prints first 5 threats, no DB writes

Phase 4  GET services.nvd.nist.gov/rest/json/cves/2.0      (selective only)
         Only for CVEs missing CVSS score or CWE mappings
         650ms per request (with API key) / 6500ms (without)
         Skipped entirely in DRY_RUN mode

Phase 6  INSERT INTO threat ... ON CONFLICT (external_id) DO UPDATE
         COALESCE preserves curator-edited description/sourceUrl/publishedAt
         aiAmplification never touched

Phase 7  INSERT INTO threat_stack ... ON CONFLICT (threat_id, stack_id) DO UPDATE
         Updates severity only — isMitigatedByRules handled in Phase 8

Phase 8  UPDATE threat_stack SET is_mitigated_by_rules = EXISTS (
           SELECT 1 FROM rule_threat_map WHERE threat_id = ts.threat_id
         )
         Single bulk UPDATE — no N+1

Phase 9  UPDATE sync_log SET status, finished_at, source_summary, coverage_percent
```

**Key invariants:**

- `aiAmplification` is never written by the pipeline (editorial-only field)
- `description`, `source_url`, `published_at` use `COALESCE` — curator edits survive re-runs
- The pipeline is idempotent: running twice produces the same DB state
- Dedup always runs before NVD to avoid wasting rate-limited API quota on duplicates
- Phase 4 (NVD) is skipped entirely in `DRY_RUN` mode — it runs only when writing to DB

---

## Adding a new stack

**Edit exactly one file:** [`packages/mvp-catalog/src/stack-registry.ts`](../packages/mvp-catalog/src/stack-registry.ts)

Add a new entry to `STACK_REGISTRY`:

```typescript
{
  slug: "spring-boot",          // must be unique; used as DB key and URL slug
  name: "Spring Boot",          // display name shown in UI
  catalogStatus: "coming_soon", // "launch" | "coming_soon"
  sortOrder: 12,                 // increment from the last entry

  // ── What to query ──────────────────────────────────────────────────
  ecosystem: "maven",            // package manager ecosystem label
  osvEcosystem: "Maven",         // OSV API ecosystem value (case-sensitive)
  osvPackages: [                 // packages to query on OSV.dev
    "org.springframework:spring-core",
    "org.springframework.boot:spring-boot",
    "org.springframework.security:spring-security-core",
  ],
  nvdKeywords: ["spring boot", "springframework", "spring framework"],
  ghsaEcosystem: "MAVEN",        // GitHub Advisory ecosystem enum (uppercase)

  // npmPackages: only needed for npm-based stacks (drives Phase 1 npm Audit)

  // ── What to keep ───────────────────────────────────────────────────
  cwePriority: ["CWE-89", "CWE-611", "CWE-352", "CWE-918", "CWE-284", "CWE-798"],
  minCvss: 7.0,
},
```

Then reseed the `stack` table:

```bash
npm run db:seed:upsert
```

That single config change automatically:

- Adds the slug to `ALL_CATALOG_STACK_SLUGS` (routing, filtering, everywhere)
- Seeds the `stack` row in Postgres
- Enrolls the stack in all pipeline phases (OSV, GHSA, NVD, CISA KEV)
- Shows as "coming soon" in the UI immediately — no code changes needed
- Graduates to "launch" by changing `catalogStatus: "coming_soon"` → `"launch"` and reseeding

**OSV / GHSA ecosystem values** for reference:

| Ecosystem | `osvEcosystem` | `ghsaEcosystem` |
| --- | --- | --- |
| npm / Node.js | `"npm"` | `"NPM"` |
| Python (PyPI) | `"PyPI"` | `"PIP"` |
| Ruby (RubyGems) | `"RubyGems"` | `"RUBYGEMS"` |
| Go | `"Go"` | `"GO"` |
| Java (Maven) | `"Maven"` | `"MAVEN"` |
| Swift | `"SwiftURL"` | `"SWIFT"` |

---

## Testing the pipeline

### 1. Smoke test (no DB writes)

```bash
STACK_FILTER=nextjs DRY_RUN=true npx tsx scripts/sync-threats.ts
```

Expected:

- Phases 0–5 complete, Phase 4 skipped
- `[DRY RUN] Would upsert N threats` printed with first 5 as JSON
- Process exits cleanly within seconds (no hang)

### 2. Single-stack live run

```bash
STACK_FILTER=nextjs npx tsx scripts/sync-threats.ts
```

Verify in DB:

```sql
-- Check sync completed successfully
SELECT id, status, source_summary, coverage_percent
FROM sync_log
ORDER BY id DESC LIMIT 1;

-- Check threats were written
SELECT COUNT(*) FROM threat;
SELECT COUNT(*) FROM threat_stack;

-- Spot-check a threat row
SELECT public_id, severity, owasp_refs, is_actively_exploited
FROM threat
ORDER BY created_at DESC LIMIT 5;
```

### 3. Full run

```bash
npx tsx scripts/sync-threats.ts
```

Acceptance thresholds (from PRD §26):

| Check | Expected |
| --- | --- |
| `sync_log.status` | `success` |
| `COUNT(*) FROM threat` | ≥ 40 |
| `COUNT(*) FROM threat_stack` | ≥ 60 |
| Any row with `source = 'aigently_internal'` | 0 |
| Any row with `ai_amplification` set | 0 |

### 4. Idempotency check

```bash
npx tsx scripts/sync-threats.ts && npx tsx scripts/sync-threats.ts
```

Row counts in `threat` and `threat_stack` must be identical after both runs.

### 5. Seed regression (after adding a new stack)

```bash
npm run db:seed:upsert
```

```sql
SELECT slug, catalog_status, osv_ecosystem FROM stack ORDER BY sort_order;
```

---

## File structure

```text
apps/web/scripts/
  sync-threats.ts          ← entry point / orchestrator
  lib/
    types.ts               ← NormalisedThreat, SourceCount, SyncSummary
    normalise.ts           ← CWE→OWASP maps, severity normalisation, deduplication
    upsert.ts              ← all DB writes (threat, threat_stack, sync_log)
    sources/
      cisa-kev.ts          ← Phase 0: CISA KEV preflight flag map
      npm-audit.ts         ← Phase 1: npm Audit API (npm stacks only)
      osv.ts               ← Phase 2: OSV.dev (all stacks)
      ghsa.ts              ← Phase 3: GitHub Advisory (all stacks)
      nvd.ts               ← Phase 4: NVD enrichment (selective, skipped in DRY_RUN)

packages/mvp-catalog/src/
  stack-registry.ts        ← ONLY file to edit when adding a stack
  launch.ts                ← derives slug arrays from stack-registry
```

---

## GitHub Actions

The workflow runs daily at 06:00 UTC and can be triggered manually:

`.github/workflows/sync-threats.yml` → **Sync Threat Intelligence**

Required secret: `DATABASE_URL`
Recommended secrets: `NVD_API_KEY`, `GITHUB_TOKEN`

To trigger manually: Actions → Sync Threat Intelligence → Run workflow.

---

## Monitoring

After each run, check `sync_log`:

```sql
SELECT
  id,
  started_at,
  finished_at,
  status,
  error_message,
  coverage_percent,
  source_summary
FROM sync_log
ORDER BY id DESC
LIMIT 5;
```

`source_summary` JSON shape:

```json
{
  "npm_audit": { "fetched": 51, "upserted": 18, "skipped": 33, "errors": 0 },
  "osv":       { "fetched": 120, "upserted": 43, "skipped": 77, "errors": 0 },
  "ghsa":      { "fetched": 38, "upserted": 22, "skipped": 16, "errors": 0 },
  "nvd":       { "fetched": 12, "upserted": 12, "skipped": 0,  "errors": 0 },
  "cisa_kev":  { "totalKev": 1590, "newlyFlagged": 2 }
}
```
