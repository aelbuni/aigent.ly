# Threat Ingestion Pipeline — Implementation PRD
## Aigent.ly · Vulnerability Intelligence for Developer Stacks
### Schema version: schema.ts (May 2026) · Pipeline version: 1.0

---

## 1. PURPOSE

Build an automated pipeline that fetches CVEs and vulnerability
advisories from multiple external sources, normalises them into
the `threat` table, populates the `threat_stack` junction for the
vulnerability matrix, and records every run in `sync_log`.

The pipeline runs daily via GitHub Actions. It must be idempotent:
running it twice produces the same DB state as running it once.

---

## 2. TABLES THIS PIPELINE WRITES TO

```
threat           — one row per unique vulnerability
threat_stack     — junction: which stacks are affected, at what severity
sync_log         — one row per pipeline run with per-source counters
```

Tables this pipeline reads from (never writes to):

```
stack            — reads id, slug, osvEcosystem, nvdKeywords per stack
rule_threat_map  — reads to compute isMitigatedByRules on threat_stack
```

Tables this pipeline never touches:

```
rule, rule_stack, rule_ide, rule_layer_map, rule_severity_tag,
rule_threat_map, stack_coverage_area, stack_framework_feature,
policy_template, policy_template_stack, article, article_rule_map,
rule_review, rule_review_helpful, article_feedback,
rule_usage_daily, content_revision, user, account, session,
verification_token, authenticator
```

---

## 3. PIPELINE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Cron (daily 06:00 UTC)        │
│                    npx tsx scripts/sync-threats.ts              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │  Phase 0: Preflight         │
          │  - Open syncLog row (running)│
          │  - Load CISA KEV → Set<cveId>│
          │  - Load stack rows from DB  │
          └─────────────┬──────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 1: npm Audit API             │
        │  Stacks: nextjs express nestjs      │
        │          nuxt react-spa             │
        │  → raw advisories[]                 │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 2: OSV.dev                   │
        │  All 11 stacks (by osvEcosystem)    │
        │  → raw OSV vulns[]                  │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 3: GitHub Advisory API       │
        │  All supported ecosystems           │
        │  → raw GHSA advisories[]            │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 4: NVD Enrichment            │
        │  For CVEs found in phases 1-3       │
        │  that still lack CVSS / CWE data    │
        │  → adds cvssScore, cweIds to cache  │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 5: Normalise + Deduplicate   │
        │  All raw records → ThreatInsert[]   │
        │  Dedup on externalId               │
        │  Apply CWE → OWASP mapping         │
        │  Apply CISA KEV flag               │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 6: Upsert threat rows        │
        │  Conflict key: externalId           │
        │  Never overwrite: aiAmplification   │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 7: Upsert threat_stack rows  │
        │  One row per (threatId, stackId)    │
        │  Update isMitigatedByRules          │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 8: Update isMitigatedByRules │
        │  Check rule_threat_map for coverage │
        └───────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────────┐
        │  Phase 9: Close syncLog             │
        │  status: success / failed           │
        │  sourceSummary: per-source counters │
        │  coveragePercent: computed          │
        └────────────────────────────────────┘
```

---

## 4. FILE STRUCTURE

```
scripts/
  sync-threats.ts          — main entry point, orchestrates all phases
  lib/
    db.ts                  — drizzle client (reuse app's existing lib/db)
    sources/
      npm-audit.ts         — Phase 1: npm Audit API fetcher + normaliser
      osv.ts               — Phase 2: OSV.dev fetcher + normaliser
      ghsa.ts              — Phase 3: GitHub Advisory fetcher + normaliser
      nvd.ts               — Phase 4: NVD enrichment fetcher
      cisa-kev.ts          — Phase 0: CISA KEV fetcher
    normalise.ts           — shared CWE→OWASP map, severity map, publicId fn
    upsert.ts              — threat upsert, threat_stack upsert, syncLog write
    stack-config.ts        — STACK_LOOKUP_CONFIG (drives all queries)
    types.ts               — ThreatInsert, NormalisedAdvisory, SourceCount
```

---

## 5. ENVIRONMENT VARIABLES

```bash
# Required
DATABASE_URL=postgresql://...    # Postgres connection string

# Optional — higher rate limits only
NVD_API_KEY=...                  # nvd.nist.gov — free, register to get 50 req/30s
GITHUB_TOKEN=...                 # github.com — free, unlocks 5000 req/hr

# Optional — post-MVP enrichment
VULNCHECK_API_KEY=...            # vulncheck.com free tier
```

No secret is required to start. npm Audit + OSV + CISA KEV all work
with no API key.

---

## 6. STACK CONFIGURATION

This single config object drives all three fetch phases. It is read
from the `stack` table at runtime — the values shown here match what
the seed script must insert into `stack.osvEcosystem` and
`stack.nvdKeywords`.

```typescript
// scripts/lib/stack-config.ts

export interface StackConfig {
  slug: string;           // matches stack.slug
  osvEcosystem: string;   // maps to stack.osv_ecosystem
  osvPackages: string[];  // specific packages to query on OSV
  nvdKeywords: string[];  // maps to stack.nvd_keywords
  ghsaEcosystem: string;  // GitHub Advisory ecosystem enum
  npmPackages?: Record<string, string>; // package → version for npm audit
  cwePriority: string[];  // CWE IDs to keep; others are discarded
  minCvss: number;        // minimum CVSS score to ingest (7.0 = HIGH+)
}

export const STACK_CONFIGS: StackConfig[] = [
  {
    slug: "nextjs",
    osvEcosystem: "npm",
    osvPackages: ["next", "react", "react-dom",
                  "react-server-dom-webpack", "react-server-dom-turbopack"],
    nvdKeywords: ["next.js", "nextjs", "vercel next"],
    ghsaEcosystem: "NPM",
    npmPackages: {
      "next":       "14.0.0",
      "react":      "18.0.0",
      "react-dom":  "18.0.0",
      "jsonwebtoken": "8.5.1",
      "axios":      "0.21.1",
      "lodash":     "4.17.20",
      "node-fetch": "2.6.1",
    },
    cwePriority: ["CWE-798","CWE-502","CWE-79","CWE-352","CWE-1321",
                  "CWE-22","CWE-918","CWE-285","CWE-863","CWE-400"],
    minCvss: 7.0,
  },
  {
    slug: "express",
    osvEcosystem: "npm",
    osvPackages: ["express","body-parser","multer","cors",
                  "jsonwebtoken","mongoose","sequelize","helmet"],
    nvdKeywords: ["express.js","expressjs","node express"],
    ghsaEcosystem: "NPM",
    npmPackages: {
      "express":      "4.17.1",
      "jsonwebtoken": "8.5.1",
      "cors":         "2.8.5",
      "multer":       "1.4.4",
      "lodash":       "4.17.20",
      "mongoose":     "5.13.14",
      "sequelize":    "6.6.5",
    },
    cwePriority: ["CWE-22","CWE-89","CWE-1321","CWE-116","CWE-352",
                  "CWE-798","CWE-400","CWE-78","CWE-502"],
    minCvss: 7.0,
  },
  {
    slug: "nestjs",
    osvEcosystem: "npm",
    osvPackages: ["@nestjs/core","@nestjs/common","@nestjs/platform-express",
                  "@nestjs/jwt","@nestjs/passport"],
    nvdKeywords: ["nestjs","nest.js"],
    ghsaEcosystem: "NPM",
    npmPackages: {
      "@nestjs/core":    "9.0.0",
      "@nestjs/common":  "9.0.0",
      "jsonwebtoken":    "8.5.1",
      "axios":           "0.21.1",
      "lodash":          "4.17.20",
    },
    cwePriority: ["CWE-89","CWE-79","CWE-352","CWE-798",
                  "CWE-400","CWE-285","CWE-1321"],
    minCvss: 7.0,
  },
  {
    slug: "nuxt",
    osvEcosystem: "npm",
    osvPackages: ["nuxt","@nuxt/kit","@nuxt/schema","h3","nitro"],
    nvdKeywords: ["nuxt.js","nuxtjs","nuxt framework"],
    ghsaEcosystem: "NPM",
    npmPackages: {
      "nuxt":  "3.0.0",
      "axios": "0.21.1",
      "lodash":"4.17.20",
    },
    cwePriority: ["CWE-79","CWE-352","CWE-798","CWE-1321","CWE-400"],
    minCvss: 7.0,
  },
  {
    slug: "react-spa",
    osvEcosystem: "npm",
    osvPackages: ["react","react-dom","react-router","react-router-dom",
                  "axios","create-react-app"],
    nvdKeywords: ["react spa","create react app","react frontend"],
    ghsaEcosystem: "NPM",
    npmPackages: {
      "react":             "18.0.0",
      "react-dom":         "18.0.0",
      "react-router-dom":  "6.0.0",
      "axios":             "0.21.1",
      "lodash":            "4.17.20",
    },
    cwePriority: ["CWE-79","CWE-798","CWE-359","CWE-116","CWE-285","CWE-1321"],
    minCvss: 7.0,
  },
  {
    slug: "fastapi",
    osvEcosystem: "PyPI",
    osvPackages: ["fastapi","starlette","uvicorn","pydantic",
                  "python-jose","passlib","fastapi-guard"],
    nvdKeywords: ["fastapi","starlette","pydantic"],
    ghsaEcosystem: "PIP",
    cwePriority: ["CWE-284","CWE-89","CWE-346","CWE-942","CWE-400",
                  "CWE-20","CWE-352","CWE-94","CWE-798"],
    minCvss: 7.0,
  },
  // ── coming_soon stacks — fetched and stored but not shown in UI ──
  {
    slug: "django",
    osvEcosystem: "PyPI",
    osvPackages: ["django","djangorestframework","django-cors-headers","pillow"],
    nvdKeywords: ["django","djangoproject"],
    ghsaEcosystem: "PIP",
    cwePriority: ["CWE-89","CWE-284","CWE-352","CWE-530","CWE-200","CWE-798"],
    minCvss: 7.0,
  },
  {
    slug: "rails",
    osvEcosystem: "RubyGems",
    osvPackages: ["rails","actionpack","activerecord","activesupport","actionview"],
    nvdKeywords: ["ruby on rails","rails framework"],
    ghsaEcosystem: "RUBYGEMS",
    cwePriority: ["CWE-915","CWE-284","CWE-352","CWE-89","CWE-79","CWE-400"],
    minCvss: 7.0,
  },
  {
    slug: "go",
    osvEcosystem: "Go",
    osvPackages: ["github.com/gin-gonic/gin","github.com/golang-jwt/jwt",
                  "gorm.io/gorm","golang.org/x/net","golang.org/x/crypto"],
    nvdKeywords: ["gin-gonic","golang web","go net"],
    ghsaEcosystem: "GO",
    cwePriority: ["CWE-89","CWE-22","CWE-285","CWE-798","CWE-400","CWE-295"],
    minCvss: 7.0,
  },
  {
    slug: "ios",
    osvEcosystem: "SwiftURL",
    osvPackages: ["github.com/Alamofire/Alamofire","github.com/realm/realm-swift"],
    nvdKeywords: ["ios swift","apple ios sdk","swiftui"],
    ghsaEcosystem: "SWIFT",
    cwePriority: ["CWE-312","CWE-295","CWE-200","CWE-798","CWE-532"],
    minCvss: 6.5,
  },
  {
    slug: "android",
    osvEcosystem: "Maven",
    osvPackages: ["com.squareup.okhttp3:okhttp","com.google.firebase:firebase-auth",
                  "androidx.security:security-crypto"],
    nvdKeywords: ["android kotlin","android sdk","androidx"],
    ghsaEcosystem: "MAVEN",
    cwePriority: ["CWE-312","CWE-295","CWE-532","CWE-798","CWE-200"],
    minCvss: 6.5,
  },
];
```

---

## 7. SHARED TYPES

```typescript
// scripts/lib/types.ts

import type { InferInsertModel } from "drizzle-orm";
import type { threat, threatStack, syncLog } from "@/db/schema";

export type ThreatInsert = InferInsertModel<typeof threat>;
export type ThreatStackInsert = InferInsertModel<typeof threatStack>;

// Internal working type: one canonical threat record
// before being split into threat + threat_stack inserts
export interface NormalisedThreat {
  // ── threat row fields ──────────────────────────────────────────
  publicId: string;               // see §8 publicId convention
  externalId: string;             // conflict key for upsert
  family: "owasp_web" | "owasp_llm" | "mitre_atlas" | "vibe_coding";
  name: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string | null;
  cveId: string | null;
  source: "nvd"|"osv"|"ghsa"|"cisa_kev"|"aigently"|"mitre_atlas"|"aigently_internal";
  sourceUrl: string | null;
  publishedAt: Date | null;
  owaspRefs: string[];            // populated by CWE→OWASP map
  mitreAttackIds: string[];       // populated for MITRE ATLAS entries only
  affectedProducts: AffectedProduct[];
  patchedVersion: string | null;
  isActivelyExploited: boolean;   // set true if cveId in CISA KEV set
  cisaActionDue: string | null;   // from CISA KEV dueDate field
  details: Record<string, unknown>; // raw source payload
  // ── foreign key for threat_stack ──────────────────────────────
  affectedStackSlugs: string[];   // which stacks this threat affects
}

export interface AffectedProduct {
  name: string;
  ecosystem: string;
  vulnerableVersionRange: string | null;
  patchedVersions: string | null;
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

## 8. publicId CONVENTION

`publicId` is the primary key on `threat`. It is the human-facing ID
shown in the UI. `externalId` is the stable upsert key.

```
source = "osv"           → publicId = first CVE alias if present,
                           else the OSV ID (e.g. GHSA-xxxx-xxxx-xxxx)
source = "ghsa"          → publicId = cveId if present, else GHSA ID
source = "nvd"           → publicId = cveId (always CVE-XXXX-XXXXX)
source = "cisa_kev"      → publicId = cveId
source = "mitre_atlas"   → publicId = ATLAS technique ID (AML.T0051)
source = "aigently"      → publicId = internal curated ID
source = "aigently_internal" → publicId = CWE-pattern ID (NEXTJS-CWE-352)

externalId:
  OSV rows    → OSV ID (GHSA-xxxx or PYSEC-xxxx)
  NVD rows    → CVE-XXXX-XXXXX
  GHSA rows   → GHSA-xxxx-xxxx-xxxx
  npm rows    → "npm-" + advisory numeric ID
  Curated     → same as publicId
```

Conflict resolution: `externalId` has a UNIQUE constraint. All upserts
use `ON CONFLICT (external_id) DO UPDATE`. If `externalId` is null
(curated rows), the upsert conflicts on `publicId` instead.

---

## 9. CWE → OWASP MAPPING

Applied in `normalise.ts` after every fetch. Every CWE found in a
source record is mapped to its OWASP category. Unmapped CWEs are
stored in `details.rawCwes` but not added to `owaspRefs`.

```typescript
// scripts/lib/normalise.ts

export const CWE_TO_OWASP_WEB: Record<string, string> = {
  // A01 — Broken Access Control
  "CWE-284": "A01", "CWE-285": "A01", "CWE-639": "A01",
  "CWE-863": "A01", "CWE-22":  "A01", "CWE-59":  "A01",
  // A02 — Cryptographic Failures
  "CWE-327": "A02", "CWE-326": "A02", "CWE-312": "A02",
  "CWE-311": "A02", "CWE-330": "A02", "CWE-295": "A02",
  // A03 — Injection
  "CWE-89":   "A03", "CWE-79":   "A03", "CWE-78":  "A03",
  "CWE-94":   "A03", "CWE-20":   "A03", "CWE-1321":"A03",
  "CWE-77":   "A03", "CWE-917":  "A03", "CWE-74":  "A03",
  // A04 — Insecure Design
  "CWE-915":  "A04", "CWE-434": "A04", "CWE-840": "A04",
  // A05 — Security Misconfiguration
  "CWE-798":  "A05", "CWE-116": "A05", "CWE-942": "A05",
  "CWE-346":  "A05", "CWE-732": "A05", "CWE-16":  "A05",
  // A06 — Vulnerable and Outdated Components
  "CWE-400":  "A06", "CWE-1104":"A06", "CWE-1035":"A06",
  // A07 — Identification and Authentication Failures
  "CWE-287":  "A07", "CWE-306": "A07", "CWE-307": "A07",
  "CWE-798":  "A07", "CWE-521": "A07",
  // A08 — Software and Data Integrity Failures / CSRF
  "CWE-502":  "A08", "CWE-352": "A08", "CWE-349": "A08",
  "CWE-494":  "A08",
  // A09 — Security Logging and Monitoring Failures
  "CWE-532":  "A09", "CWE-778": "A09",
  // A10 — SSRF
  "CWE-918":  "A10",
};

export const CWE_TO_OWASP_LLM: Record<string, string> = {
  "CWE-20":   "LLM01",  // prompt injection — improper input validation
  "CWE-200":  "LLM02",  // sensitive info disclosure
  "CWE-1104": "LLM03",  // vulnerable AI dependency (supply chain)
  "CWE-506":  "LLM04",  // embedded malicious code (data poisoning)
  "CWE-116":  "LLM05",  // improper output handling
  "CWE-284":  "LLM06",  // excessive agency — broken access control
  "CWE-285":  "LLM06",  // excessive agency — improper authorisation
  "CWE-312":  "LLM07",  // system prompt leakage — cleartext storage
  "CWE-400":  "LLM10",  // unbounded consumption — resource exhaustion
};

export function mapCwesToOwasp(cwes: string[]): string[] {
  const refs = new Set<string>();
  for (const cwe of cwes) {
    const webRef = CWE_TO_OWASP_WEB[cwe];
    const llmRef = CWE_TO_OWASP_LLM[cwe];
    if (webRef) refs.add(webRef);
    if (llmRef) refs.add(llmRef);
  }
  return [...refs].sort();
}
```

---

## 10. SEVERITY MAPPING

Each source uses different severity scales. Normalise to the
`severityLevelEnum` before inserting.

```typescript
// scripts/lib/normalise.ts

export function normaliseSeverity(
  source: string,
  rawSeverity: string | number | undefined,
  cvssScore?: number
): "critical" | "high" | "medium" | "low" | "info" {

  // CVSS numeric score takes priority when present
  if (cvssScore !== undefined) {
    if (cvssScore >= 9.0) return "critical";
    if (cvssScore >= 7.0) return "high";
    if (cvssScore >= 4.0) return "medium";
    if (cvssScore >= 0.1) return "low";
    return "info";
  }

  const s = String(rawSeverity ?? "").toLowerCase();

  // OSV / GitHub Advisory / npm Audit
  if (s === "critical")  return "critical";
  if (s === "high")      return "high";
  if (s === "moderate")  return "medium";
  if (s === "medium")    return "medium";
  if (s === "low")       return "low";

  // NVD baseSeverity strings
  if (s === "critical")  return "critical";
  if (s === "high")      return "high";
  if (s === "medium")    return "medium";
  if (s === "low")       return "low";

  return "info";
}
```

---

## 11. PHASE 0 — CISA KEV PREFLIGHT

Fetch the full CISA KEV catalog once at the start of each run.
Build a `Map<cveId, { dueDate, actionRequired }>` used in Phase 5
to set `isActivelyExploited` and `cisaActionDue` on every threat.

```typescript
// scripts/lib/sources/cisa-kev.ts

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

export interface KevEntry {
  dueDate: string;          // maps to threat.cisaActionDue
}

export async function fetchKevMap(): Promise<Map<string, KevEntry>> {
  const res  = await fetch(KEV_URL);
  const data = await res.json() as { vulnerabilities: any[] };

  const map = new Map<string, KevEntry>();
  for (const v of data.vulnerabilities) {
    map.set(v.cveID, { dueDate: v.dueDate ?? null });
  }
  return map;  // ~1,200 entries, ~150KB, instant
}
```

---

## 12. PHASE 1 — npm AUDIT API

Only for stacks with `npmPackages` defined in STACK_CONFIGS.
One HTTP request per stack — submit a synthetic package manifest,
get back all advisories for those packages at those versions.

### 12.1 Fetcher

```typescript
// scripts/lib/sources/npm-audit.ts

const NPM_AUDIT_URL =
  "https://registry.npmjs.org/-/npm/v1/security/audits/quick";

export async function fetchNpmAdvisories(
  packages: Record<string, string>
): Promise<NpmAdvisory[]> {
  const payload = {
    name: "aigently-scan",
    version: "1.0.0",
    requires:     packages,
    dependencies: Object.fromEntries(
      Object.entries(packages).map(([k, v]) => [k, { version: v }])
    ),
  };

  const res  = await fetch(NPM_AUDIT_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  const data = await res.json() as { advisories: Record<string, NpmAdvisory> };
  return Object.values(data.advisories ?? {});
}
```

### 12.2 Normaliser

```typescript
// scripts/lib/sources/npm-audit.ts (continued)

export function normaliseNpmAdvisory(
  adv:       NpmAdvisory,
  stackSlug: string,
  config:    StackConfig,
  kevMap:    Map<string, KevEntry>
): NormalisedThreat | null {

  // Drop if severity below threshold
  const sev = normaliseSeverity("npm", adv.severity);
  if (["low", "info"].includes(sev)) return null;

  // Drop if no CWE in our priority list
  const cwes = (adv.cwe ?? []) as string[];
  const relevantCwes = cwes.filter(c => config.cwePriority.includes(c));
  const cveId  = adv.cves?.[0] ?? null;

  // Skip if no relevant CWE AND no CVE ID — not specific enough
  if (relevantCwes.length === 0 && !cveId) return null;

  const externalId = `npm-${adv.id}`;
  const publicId   = cveId ?? `GHSA-npm-${adv.id}`;
  const kevEntry   = cveId ? kevMap.get(cveId) : undefined;

  return {
    publicId,
    externalId,
    family:      "owasp_web",
    name:        adv.title,
    severity:    sev,
    description: adv.overview ?? null,
    cveId,
    source:      cveId ? "ghsa" : "osv",
    sourceUrl:   adv.url ?? null,
    publishedAt: null,
    owaspRefs:   mapCwesToOwasp(cwes),
    mitreAttackIds: [],
    affectedProducts: [{
      name:                  adv.module_name,
      ecosystem:             "npm",
      vulnerableVersionRange: adv.vulnerable_versions ?? null,
      patchedVersions:        adv.patched_versions ?? null,
    }],
    patchedVersion:       adv.patched_versions ?? null,
    isActivelyExploited:  !!kevEntry,
    cisaActionDue:        kevEntry?.dueDate ?? null,
    details:              { rawAdvisory: adv },
    affectedStackSlugs:   [stackSlug],
  };
}
```

### 12.3 npm Audit field → threat schema mapping

| npm Audit field          | `threat` column          | Notes                                 |
|--------------------------|--------------------------|---------------------------------------|
| `id`                     | `external_id`            | Prefixed: `"npm-" + id`               |
| `cves[0]`                | `cve_id`                 | First CVE if present                  |
| `cves[0]` or GHSA URL    | `public_id`              | CVE preferred, else GHSA              |
| `title`                  | `name`                   |                                       |
| `overview`               | `description`            |                                       |
| `severity`               | `severity`               | normalised via `normaliseSeverity()`  |
| `cwe[]`                  | `owasp_refs`             | via `mapCwesToOwasp()`                |
| `url` (GHSA link)        | `source_url`             |                                       |
| `module_name`            | `affected_products[].name` |                                     |
| `vulnerable_versions`    | `affected_products[].vulnerableVersionRange` |               |
| `patched_versions`       | `patched_version`        |                                       |
| KEV lookup on `cves[0]`  | `is_actively_exploited`  |                                       |
| KEV `dueDate`            | `cisa_action_due`        |                                       |
| raw object               | `details`                | Stored as `{ rawAdvisory: adv }`      |
| always                   | `family`                 | `"owasp_web"`                         |
| always                   | `source`                 | `"ghsa"` if CVE present, else `"osv"` |

---

## 13. PHASE 2 — OSV.DEV

Query by package name + ecosystem. Covers all 11 stacks. Free, no key.

### 13.1 Fetcher

```typescript
// scripts/lib/sources/osv.ts

const OSV_QUERY_URL = "https://api.osv.dev/v1/query";

export async function fetchOsvForPackage(
  packageName: string,
  ecosystem:   string
): Promise<OsvVuln[]> {
  const res  = await fetch(OSV_QUERY_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ package: { name: packageName, ecosystem } }),
  });
  const data = await res.json() as { vulns?: OsvVuln[] };
  return data.vulns ?? [];
}
```

### 13.2 Normaliser

```typescript
// scripts/lib/sources/osv.ts (continued)

export function normaliseOsvVuln(
  vuln:      OsvVuln,
  stackSlug: string,
  config:    StackConfig,
  kevMap:    Map<string, KevEntry>
): NormalisedThreat | null {

  const rawSev = vuln.database_specific?.severity as string | undefined;
  const sev    = normaliseSeverity("osv", rawSev);
  if (["low", "info"].includes(sev)) return null;

  const cwes = (vuln.database_specific?.cwe_ids ?? []) as string[];
  const relevantCwes = cwes.filter(c => config.cwePriority.includes(c));
  const cveId  = vuln.aliases?.find(a => a.startsWith("CVE-")) ?? null;

  if (relevantCwes.length === 0 && !cveId) return null;

  const externalId = vuln.id;                          // OSV ID
  const publicId   = cveId ?? vuln.id;
  const kevEntry   = cveId ? kevMap.get(cveId) : undefined;

  // Affected products
  const affected: AffectedProduct[] = (vuln.affected ?? []).map(a => ({
    name:                   a.package?.name ?? "",
    ecosystem:              a.package?.ecosystem ?? "",
    vulnerableVersionRange: a.ranges?.[0]?.events
                              ?.map(e => e.introduced ? `>=${e.introduced}` : `<${e.fixed}`)
                              .join(" ") ?? null,
    patchedVersions:        a.ranges?.[0]?.events?.find(e => e.fixed)?.fixed ?? null,
  }));

  const firstPatch = affected[0]?.patchedVersions ?? null;

  return {
    publicId,
    externalId,
    family:      "owasp_web",
    name:        vuln.summary ?? vuln.id,
    severity:    sev,
    description: vuln.details ?? null,
    cveId,
    source:      "osv",
    sourceUrl:   vuln.references?.[0]?.url ?? null,
    publishedAt: vuln.published ? new Date(vuln.published) : null,
    owaspRefs:   mapCwesToOwasp(cwes),
    mitreAttackIds: [],
    affectedProducts: affected,
    patchedVersion:  firstPatch,
    isActivelyExploited: !!kevEntry,
    cisaActionDue:  kevEntry?.dueDate ?? null,
    details:        { rawOsv: vuln },
    affectedStackSlugs: [stackSlug],
  };
}
```

### 13.3 OSV field → threat schema mapping

| OSV field                          | `threat` column            | Notes                              |
|------------------------------------|----------------------------|------------------------------------|
| `id`                               | `external_id`              | OSV canonical ID                   |
| `aliases[]` first `CVE-*`          | `cve_id`                   |                                    |
| `cveId ?? id`                      | `public_id`                | CVE preferred                      |
| `summary`                          | `name`                     |                                    |
| `details`                          | `description`              |                                    |
| `database_specific.severity`       | `severity`                 | normalised                         |
| `database_specific.cwe_ids[]`      | `owasp_refs`               | via `mapCwesToOwasp()`             |
| `references[0].url`                | `source_url`               |                                    |
| `published`                        | `published_at`             | ISO string → Date                  |
| `affected[].package.name`          | `affected_products[].name` |                                    |
| `affected[].package.ecosystem`     | `affected_products[].ecosystem` |                               |
| `affected[].ranges[].events`       | `affected_products[].vulnerableVersionRange` + `patchedVersions` | |
| KEV lookup on `cveId`              | `is_actively_exploited`    |                                    |
| KEV `dueDate`                      | `cisa_action_due`          |                                    |
| raw object                         | `details`                  | `{ rawOsv: vuln }`                 |
| always                             | `family`                   | `"owasp_web"`                      |
| always                             | `source`                   | `"osv"`                            |

---

## 14. PHASE 3 — GITHUB ADVISORY API

Highest quality: human-reviewed, ecosystem-tagged, often fastest
to publish. Requires `GITHUB_TOKEN` for 5,000 req/hr (optional but recommended).

### 14.1 Fetcher (REST — simpler than GraphQL for bulk fetch)

```typescript
// scripts/lib/sources/ghsa.ts

const GHSA_BASE = "https://api.github.com/advisories";

export async function fetchGhsaForEcosystem(
  ecosystem: string,    // "NPM" | "PIP" | "RUBYGEMS" | "GO" | "MAVEN" | "SWIFT"
  token?:    string
): Promise<GhsaAdvisory[]> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const results: GhsaAdvisory[] = [];
  let page = 1;

  while (true) {
    const url = `${GHSA_BASE}?ecosystem=${ecosystem}&severity=critical,high&per_page=100&page=${page}`;
    const res  = await fetch(url, { headers });

    if (!res.ok) break;
    const batch = await res.json() as GhsaAdvisory[];
    if (batch.length === 0) break;

    results.push(...batch);
    page++;
    await sleep(200); // respect rate limit
  }

  return results;
}
```

### 14.2 Normaliser

```typescript
// scripts/lib/sources/ghsa.ts (continued)

export function normaliseGhsa(
  adv:       GhsaAdvisory,
  stackSlug: string,
  config:    StackConfig,
  kevMap:    Map<string, KevEntry>
): NormalisedThreat | null {

  const sev = normaliseSeverity("ghsa", adv.severity);
  if (["low","info"].includes(sev)) return null;

  const cwes = adv.cwes?.map(c => c.cwe_id) ?? [];
  const relevantCwes = cwes.filter(c => config.cwePriority.includes(c));
  const cveId   = adv.cve_id ?? null;

  if (relevantCwes.length === 0 && !cveId) return null;

  const externalId = adv.ghsa_id;
  const publicId   = cveId ?? adv.ghsa_id;
  const kevEntry   = cveId ? kevMap.get(cveId) : undefined;

  const affected: AffectedProduct[] = (adv.vulnerabilities ?? []).map(v => ({
    name:                   v.package.name,
    ecosystem:              v.package.ecosystem,
    vulnerableVersionRange:  v.vulnerable_version_range ?? null,
    patchedVersions:         v.first_patched_version ?? null,
  }));

  return {
    publicId,
    externalId,
    family:      "owasp_web",
    name:        adv.summary,
    severity:    sev,
    description: adv.description ?? null,
    cveId,
    source:      "ghsa",
    sourceUrl:   adv.html_url ?? null,
    publishedAt: adv.published_at ? new Date(adv.published_at) : null,
    owaspRefs:   mapCwesToOwasp(cwes),
    mitreAttackIds: [],
    affectedProducts: affected,
    patchedVersion:  affected[0]?.patchedVersions ?? null,
    isActivelyExploited: !!kevEntry,
    cisaActionDue:  kevEntry?.dueDate ?? null,
    details:        { rawGhsa: adv },
    affectedStackSlugs: [stackSlug],
  };
}
```

### 14.3 GHSA field → threat schema mapping

| GHSA field                     | `threat` column              | Notes                          |
|--------------------------------|------------------------------|--------------------------------|
| `ghsa_id`                      | `external_id`                |                                |
| `cve_id ?? ghsa_id`            | `public_id`                  | CVE preferred                  |
| `cve_id`                       | `cve_id`                     |                                |
| `summary`                      | `name`                       |                                |
| `description`                  | `description`                |                                |
| `severity`                     | `severity`                   | normalised                     |
| `cwes[].cwe_id`                | `owasp_refs`                 | via `mapCwesToOwasp()`         |
| `html_url`                     | `source_url`                 |                                |
| `published_at`                 | `published_at`               |                                |
| `vulnerabilities[].package`    | `affected_products[]`        |                                |
| `vulnerabilities[].first_patched_version` | `patched_version` |                          |
| KEV lookup                     | `is_actively_exploited`      |                                |
| KEV `dueDate`                  | `cisa_action_due`            |                                |
| always                         | `family`                     | `"owasp_web"`                  |
| always                         | `source`                     | `"ghsa"`                       |

---

## 15. PHASE 4 — NVD ENRICHMENT (selective)

**Do not use NVD as a primary source.** As of April 15 2026, NVD
only enriches 15-20% of CVEs. Use NVD only to enrich CVEs already
found in phases 1-3 that are still missing CVSS score or CWE tags.

### 15.1 Enrichment pass logic

```typescript
// scripts/lib/sources/nvd.ts

const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";

// Called once per CVE that lacks CVSS or CWE after phases 1-3
export async function enrichFromNvd(
  cveId:  string,
  apiKey?: string
): Promise<NvdEnrichment | null> {

  const headers: Record<string, string> = {};
  if (apiKey) headers["apiKey"] = apiKey;

  const url = `${NVD_BASE}?cveId=${encodeURIComponent(cveId)}`;
  const res  = await fetch(url, { headers });
  if (!res.ok) return null;

  const data = await res.json() as { vulnerabilities?: NvdVuln[] };
  const vuln = data.vulnerabilities?.[0];
  if (!vuln) return null;

  const cve     = vuln.cve;
  const metrics = cve.metrics?.cvssMetricV31?.[0];
  const cwes    = cve.weaknesses?.flatMap(w =>
    w.description.map(d => d.value).filter(v => v.startsWith("CWE-"))
  ) ?? [];

  return {
    cvssScore:   metrics?.cvssData?.baseScore ?? null,
    rawSeverity: metrics?.cvssData?.baseSeverity ?? null,
    cweIds:      cwes,
    references:  cve.references?.map(r => r.url) ?? [],
  };
}

interface NvdEnrichment {
  cvssScore:   number | null;
  rawSeverity: string | null;
  cweIds:      string[];
  references:  string[];
}
```

### 15.2 When to call NVD enrichment

```typescript
// In Phase 4 of sync-threats.ts:

for (const threat of normalisedThreats) {
  if (!threat.cveId) continue;

  // Only enrich if CVSS is unknown or CWEs are empty
  const needsEnrichment =
    threat.severity === "info" ||          // no CVSS yet
    threat.owaspRefs.length === 0;         // no CWE mapping yet

  if (!needsEnrichment) continue;

  const enrichment = await enrichFromNvd(threat.cveId, process.env.NVD_API_KEY);
  if (!enrichment) continue;

  if (enrichment.cvssScore !== null) {
    threat.severity = normaliseSeverity("nvd", undefined, enrichment.cvssScore);
  }
  if (enrichment.cweIds.length > 0) {
    threat.owaspRefs = mapCwesToOwasp(enrichment.cweIds);
  }

  await sleep(NVD_DELAY_MS); // 650ms with key, 6500ms without
}
```

---

## 16. PHASE 5 — NORMALISE + DEDUPLICATE

After phases 1-3, the in-memory collection contains duplicates:
the same CVE may appear in both npm audit (as npm-12345) and OSV
(as GHSA-xxxx) and GHSA (as GHSA-xxxx). Deduplicate on `cveId`
first, then on `externalId`.

```typescript
// scripts/lib/normalise.ts

export function deduplicateThreats(threats: NormalisedThreat[]): NormalisedThreat[] {
  // Strategy: if two records share a cveId, merge them
  // Priority: ghsa > osv > npm — highest quality source wins the row
  // affectedStackSlugs: union of both records

  const SOURCE_PRIORITY: Record<string, number> = {
    ghsa: 3, osv: 2, nvd: 2, "npm-audit": 1,
    cisa_kev: 1, aigently: 5, mitre_atlas: 4,
  };

  const byCveId  = new Map<string, NormalisedThreat>();
  const byExtId  = new Map<string, NormalisedThreat>();

  for (const t of threats) {
    // Merge by CVE ID
    if (t.cveId) {
      const existing = byCveId.get(t.cveId);
      if (existing) {
        // Merge stacks
        existing.affectedStackSlugs = [
          ...new Set([...existing.affectedStackSlugs, ...t.affectedStackSlugs])
        ];
        // Higher-quality source wins the row
        if ((SOURCE_PRIORITY[t.source] ?? 0) > (SOURCE_PRIORITY[existing.source] ?? 0)) {
          const slugs = existing.affectedStackSlugs;
          Object.assign(existing, t);
          existing.affectedStackSlugs = slugs;
        }
        continue;
      }
      byCveId.set(t.cveId, t);
    }

    // Deduplicate by external ID
    if (!byExtId.has(t.externalId)) {
      byExtId.set(t.externalId, t);
    }
  }

  // Return: all CVE-deduped records + any non-CVE records
  const deduped = [
    ...byCveId.values(),
    ...[...byExtId.values()].filter(t => !t.cveId),
  ];

  return deduped;
}
```

---

## 17. PHASE 6 — UPSERT `threat` ROWS

```typescript
// scripts/lib/upsert.ts

import { db } from "@/lib/db";
import { threat, threatStack } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function upsertThreat(t: NormalisedThreat): Promise<"inserted" | "updated"> {
  const now = new Date();

  const row = {
    publicId:            t.publicId,
    family:              t.family,
    name:                t.name.slice(0, 255),
    severity:            t.severity,
    description:         t.description,
    cveId:               t.cveId,
    externalId:          t.externalId,
    source:              t.source,
    sourceUrl:           t.sourceUrl,
    publishedAt:         t.publishedAt,
    syncedAt:            now,
    owaspRefs:           t.owaspRefs,
    mitreAttackIds:      t.mitreAttackIds,
    affectedProducts:    t.affectedProducts,
    patchedVersion:      t.patchedVersion,
    isActivelyExploited: t.isActivelyExploited,
    cisaActionDue:       t.cisaActionDue,
    details:             t.details,
    updatedAt:           now,
  };

  const result = await db
    .insert(threat)
    .values(row)
    .onConflictDoUpdate({
      target: threat.externalId,       // upsert key
      set: {
        // Always update:
        severity:            row.severity,
        syncedAt:            row.syncedAt,
        isActivelyExploited: row.isActivelyExploited,
        cisaActionDue:       row.cisaActionDue,
        owaspRefs:           row.owaspRefs,
        patchedVersion:      row.patchedVersion,
        updatedAt:           row.updatedAt,

        // Update if currently null (don't overwrite manual edits):
        // aiAmplification is intentionally excluded — always manual
        description: sql`COALESCE(threat.description, EXCLUDED.description)`,
        sourceUrl:   sql`COALESCE(threat.source_url, EXCLUDED.source_url)`,
        publishedAt: sql`COALESCE(threat.published_at, EXCLUDED.published_at)`,
      },
    })
    .returning({ publicId: threat.publicId, createdAt: threat.createdAt });

  const wasInserted = result[0].createdAt.getTime() === now.getTime();
  return wasInserted ? "inserted" : "updated";
}
```

**Critical rule:** `aiAmplification` is NEVER written by the pipeline.
It is an editorial field filled by the Aigent.ly team manually.
The pipeline never sets it and never overwrites it.

---

## 18. PHASE 7 — UPSERT `threat_stack` ROWS

One row per (threatId, stackId) pair. Conflict resolution: update
severity if it has changed (e.g. CVSS was revised).

```typescript
// scripts/lib/upsert.ts (continued)

export async function upsertThreatStack(
  threatPublicId: string,
  stackSlug:      string,
  severity:       "critical"|"high"|"medium"|"low"|"info",
  stackIdMap:     Map<string, number>  // slug → id, loaded once at start
): Promise<void> {
  const stackId = stackIdMap.get(stackSlug);
  if (!stackId) return;  // stack not in DB yet — skip

  await db
    .insert(threatStack)
    .values({
      threatId:          threatPublicId,
      stackId:           stackId,
      severity:          severity,
      isMitigatedByRules: false,  // recalculated in Phase 8
    })
    .onConflictDoUpdate({
      target: [threatStack.threatId, threatStack.stackId],
      set: {
        severity: sql`EXCLUDED.severity`,
        // isMitigatedByRules is NOT updated here — see Phase 8
      },
    });
}
```

---

## 19. PHASE 8 — UPDATE isMitigatedByRules

After all upserts, recompute `isMitigatedByRules` for every
`threat_stack` row affected by this run. A threat is mitigated
if at least one entry in `rule_threat_map` points to it.

```typescript
// scripts/lib/upsert.ts (continued)

export async function refreshMitigationFlags(
  updatedPublicIds: string[]
): Promise<void> {
  if (updatedPublicIds.length === 0) return;

  // Single SQL UPDATE — efficient, no N+1
  await db.execute(sql`
    UPDATE threat_stack ts
    SET is_mitigated_by_rules = EXISTS (
      SELECT 1
      FROM rule_threat_map rtm
      WHERE rtm.threat_id = ts.threat_id
    )
    WHERE ts.threat_id = ANY(${updatedPublicIds})
  `);
}
```

---

## 20. PHASE 9 — syncLog WRITE

Open a `syncLog` row at the start of the run, close it at the end.

```typescript
// scripts/lib/upsert.ts (continued)

export async function openSyncLog(): Promise<number> {
  const [row] = await db
    .insert(syncLog)
    .values({ status: "running", sourceSummary: {} })
    .returning({ id: syncLog.id });
  return row.id;
}

export async function closeSyncLog(
  logId:   number,
  summary: SyncSummary,
  error?:  string
): Promise<void> {
  // coveragePercent = threats with ≥1 ruleThreatMap row / total threats
  const [{ total }] = await db.execute<{ total: string }>(
    sql`SELECT COUNT(*)::text AS total FROM threat`
  );
  const [{ covered }] = await db.execute<{ covered: string }>(sql`
    SELECT COUNT(DISTINCT threat_id)::text AS covered
    FROM rule_threat_map
  `);
  const pct = total === "0"
    ? 0
    : Math.round((Number(covered) / Number(total)) * 100);

  await db
    .update(syncLog)
    .set({
      finishedAt:      new Date(),
      sourceSummary:   summary,
      coveragePercent: pct,
      status:          error ? "failed" : "success",
      errorMessage:    error ?? null,
    })
    .where(eq(syncLog.id, logId));
}
```

`syncLog.sourceSummary` shape:

```json
{
  "npm_audit": { "fetched": 51, "upserted": 18, "skipped": 33, "errors": 0 },
  "osv":       { "fetched": 120, "upserted": 43, "skipped": 77, "errors": 0 },
  "ghsa":      { "fetched": 38, "upserted": 22, "skipped": 16, "errors": 0 },
  "nvd":       { "fetched": 12, "upserted": 12, "skipped": 0,  "errors": 0 },
  "cisa_kev":  { "totalKev": 1187, "newlyFlagged": 2 }
}
```

---

## 21. MAIN ORCHESTRATOR

```typescript
// scripts/sync-threats.ts

import { STACK_CONFIGS } from "./lib/stack-config";
import { fetchKevMap }   from "./lib/sources/cisa-kev";
import { fetchNpmAdvisories, normaliseNpmAdvisory } from "./lib/sources/npm-audit";
import { fetchOsvForPackage, normaliseOsvVuln }     from "./lib/sources/osv";
import { fetchGhsaForEcosystem, normaliseGhsa }     from "./lib/sources/ghsa";
import { enrichFromNvd } from "./lib/sources/nvd";
import { deduplicateThreats, mapCwesToOwasp, normaliseSeverity } from "./lib/normalise";
import { upsertThreat, upsertThreatStack, refreshMitigationFlags,
         openSyncLog, closeSyncLog } from "./lib/upsert";
import { db } from "@/lib/db";
import { stack } from "@/db/schema";

async function main() {
  const logId  = await openSyncLog();
  const counts: SyncSummary = {
    npm_audit: { fetched:0, upserted:0, skipped:0, errors:0 },
    osv:       { fetched:0, upserted:0, skipped:0, errors:0 },
    ghsa:      { fetched:0, upserted:0, skipped:0, errors:0 },
    nvd:       { fetched:0, upserted:0, skipped:0, errors:0 },
    cisa_kev:  { totalKev:0, newlyFlagged:0 },
  };

  try {
    // ── Phase 0: Preflight ────────────────────────────────────────
    console.log("Phase 0: loading CISA KEV and stack config...");
    const kevMap    = await fetchKevMap();
    counts.cisa_kev.totalKev = kevMap.size;

    const stacks    = await db.select().from(stack);
    const stackIdMap = new Map(stacks.map(s => [s.slug, s.id]));

    // ── Collect all raw threats ───────────────────────────────────
    const rawThreats: NormalisedThreat[] = [];

    for (const config of STACK_CONFIGS) {

      // ── Phase 1: npm Audit ───────────────────────────────────
      if (config.npmPackages) {
        console.log(`Phase 1 [npm]: ${config.slug}`);
        try {
          const advisories = await fetchNpmAdvisories(config.npmPackages);
          counts.npm_audit.fetched += advisories.length;
          for (const adv of advisories) {
            const t = normaliseNpmAdvisory(adv, config.slug, config, kevMap);
            if (t) rawThreats.push(t);
            else   counts.npm_audit.skipped++;
          }
        } catch (e) { counts.npm_audit.errors++; console.error(e); }
      }

      // ── Phase 2: OSV ─────────────────────────────────────────
      console.log(`Phase 2 [osv]: ${config.slug} (${config.osvPackages.length} packages)`);
      for (const pkg of config.osvPackages) {
        try {
          const vulns = await fetchOsvForPackage(pkg, config.osvEcosystem);
          counts.osv.fetched += vulns.length;
          for (const v of vulns) {
            const t = normaliseOsvVuln(v, config.slug, config, kevMap);
            if (t) rawThreats.push(t);
            else   counts.osv.skipped++;
          }
          await sleep(300);
        } catch (e) { counts.osv.errors++; console.error(e); }
      }

      // ── Phase 3: GHSA ─────────────────────────────────────────
      console.log(`Phase 3 [ghsa]: ${config.slug} (${config.ghsaEcosystem})`);
      try {
        const advisories = await fetchGhsaForEcosystem(
          config.ghsaEcosystem,
          process.env.GITHUB_TOKEN
        );
        counts.ghsa.fetched += advisories.length;
        for (const adv of advisories) {
          const t = normaliseGhsa(adv, config.slug, config, kevMap);
          if (t) rawThreats.push(t);
          else   counts.ghsa.skipped++;
        }
      } catch (e) { counts.ghsa.errors++; console.error(e); }
    }

    // ── Phase 5: Normalise + deduplicate ─────────────────────────
    console.log(`Phase 5: deduplicating ${rawThreats.length} raw records...`);
    const deduped = deduplicateThreats(rawThreats);
    console.log(`  → ${deduped.length} unique threats`);

    // ── Phase 4: NVD enrichment (selective) ──────────────────────
    console.log("Phase 4: NVD enrichment pass...");
    for (const t of deduped) {
      if (!t.cveId) continue;
      if (t.severity !== "info" && t.owaspRefs.length > 0) continue;
      try {
        const enrichment = await enrichFromNvd(t.cveId, process.env.NVD_API_KEY);
        if (enrichment) {
          if (enrichment.cvssScore !== null)
            t.severity = normaliseSeverity("nvd", undefined, enrichment.cvssScore);
          if (enrichment.cweIds.length > 0)
            t.owaspRefs = mapCwesToOwasp(enrichment.cweIds);
          counts.nvd.fetched++;
          counts.nvd.upserted++;
        }
      } catch { counts.nvd.errors++; }
      await sleep(process.env.NVD_API_KEY ? 650 : 6500);
    }

    // ── Drop below-threshold threats ─────────────────────────────
    const toInsert = deduped.filter(t =>
      !["low","info"].includes(t.severity)
    );
    console.log(`  → ${toInsert.length} threats at HIGH+ severity`);

    // ── Phase 6: Upsert threat rows ───────────────────────────────
    console.log("Phase 6: upserting threat rows...");
    const updatedIds: string[] = [];
    for (const t of toInsert) {
      try {
        const outcome = await upsertThreat(t);
        updatedIds.push(t.publicId);
        if (outcome === "inserted") counts.osv.upserted++;
        else                        counts.osv.updated = (counts.osv.updated ?? 0) + 1;
      } catch (e) { console.error(`Failed upserting ${t.publicId}:`, e); }
    }

    // ── Phase 7: Upsert threat_stack rows ────────────────────────
    console.log("Phase 7: upserting threat_stack rows...");
    for (const t of toInsert) {
      for (const slug of t.affectedStackSlugs) {
        await upsertThreatStack(t.publicId, slug, t.severity, stackIdMap);
      }
    }

    // ── Phase 8: Refresh isMitigatedByRules ──────────────────────
    console.log("Phase 8: refreshing mitigation flags...");
    await refreshMitigationFlags(updatedIds);

    // ── Phase 9: Close syncLog (success) ─────────────────────────
    await closeSyncLog(logId, counts);
    console.log("✅ Sync complete.");
    console.log(JSON.stringify(counts, null, 2));

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await closeSyncLog(logId, counts, msg);
    console.error("❌ Sync failed:", msg);
    process.exit(1);
  }
}

main();
```

---

## 22. GITHUB ACTIONS WORKFLOW

```yaml
# .github/workflows/sync-threats.yml
name: Sync Threat Intelligence

on:
  schedule:
    - cron: "0 6 * * *"          # daily at 06:00 UTC
  workflow_dispatch:              # manual trigger from Actions UI

jobs:
  sync:
    name: Ingest vulnerabilities
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run sync
        env:
          DATABASE_URL:     ${{ secrets.DATABASE_URL }}
          NVD_API_KEY:      ${{ secrets.NVD_API_KEY }}
          GITHUB_TOKEN:     ${{ secrets.GITHUB_TOKEN }}
          VULNCHECK_API_KEY: ${{ secrets.VULNCHECK_API_KEY }}
        run: npx tsx scripts/sync-threats.ts

      - name: Notify on failure
        if: failure()
        run: |
          echo "Threat sync failed — check syncLog table for details"
          # Add your notification hook here (Slack, email, etc.)
```

Required GitHub secrets:
- `DATABASE_URL` — **required** — your Postgres connection string
- `NVD_API_KEY`  — optional — higher rate limit (register at nvd.nist.gov)
- `GITHUB_TOKEN` — optional — already available in GitHub Actions by default
- `VULNCHECK_API_KEY` — optional, post-MVP

---

## 23. FILTER LOGIC — WHAT GETS DROPPED

A normalised threat is dropped (not inserted) if ANY of the following:

```typescript
// Drop rules applied in this order:

// 1. Severity too low
if (["low","info"].includes(t.severity)) return null;

// 2. No relevant CWE AND no CVE ID
//    (too generic to write a stack-specific rule for)
if (relevantCwes.length === 0 && !cveId) return null;

// 3. No source URL AND no CVE ID
//    (cannot verify, cannot link from UI)
if (!t.sourceUrl && !t.cveId) return null;

// 4. Synthetic internal ID being re-ingested
//    (aigently_internal rows are editorial-only, never from pipeline)
if (t.source === "aigently_internal") return null;
```

---

## 24. IDEMPOTENCY GUARANTEE

The pipeline is safe to run multiple times. Idempotency is guaranteed by:

1. **`threat` upsert on `externalId`** — same external ID never creates
   two rows; instead it updates the existing row's mutable fields.

2. **`threat_stack` upsert on composite PK `(threatId, stackId)`** —
   same pair never creates two rows.

3. **`syncLog` always creates a new row** — each run is auditable.
   Old logs are never overwritten.

4. **`isMitigatedByRules` is always recomputed** — never relies on
   previous run's state.

5. **`aiAmplification` is never touched** — editorial fields survive
   any number of sync runs unchanged.

---

## 25. RUNNING LOCALLY

```bash
# One-time setup
cp .env.example .env.local
# Add DATABASE_URL to .env.local

# Install deps
npm install

# Run the full sync
npx tsx scripts/sync-threats.ts

# Run for a single stack only (for testing)
STACK_FILTER=nextjs npx tsx scripts/sync-threats.ts

# Dry run — normalise but don't write to DB
DRY_RUN=true npx tsx scripts/sync-threats.ts
```

Add `STACK_FILTER` and `DRY_RUN` env var checks at the top of
`sync-threats.ts` for local development convenience:

```typescript
const STACK_FILTER = process.env.STACK_FILTER;
const DRY_RUN      = process.env.DRY_RUN === "true";

const configs = STACK_FILTER
  ? STACK_CONFIGS.filter(c => c.slug === STACK_FILTER)
  : STACK_CONFIGS;
```

---

## 26. ACCEPTANCE CRITERIA

The pipeline is complete when all of the following pass:

```
□ Running sync with no env vars (just DATABASE_URL) completes without error
□ syncLog table shows status="success" after a run
□ threat table contains ≥ 40 rows after first full run
□ threat_stack table contains ≥ 60 rows after first full run
□ Every threat row with a cveId has a non-null sourceUrl
□ No threat row has source="aigently_internal" (pipeline never creates these)
□ No threat row has aiAmplification set by the pipeline (editorial only)
□ Running the sync twice produces identical threat + threat_stack row counts
□ isActivelyExploited=true for all CVEs present in the CISA KEV catalog
□ isMitigatedByRules=true only for threats that have a ruleThreatMap entry
□ syncLog.sourceSummary is valid JSON matching the SyncSummary shape
□ syncLog.coveragePercent is an integer 0-100
□ STACK_FILTER=nextjs runs only the nextjs config (no other stacks processed)
□ DRY_RUN=true prints normalised threats to stdout but writes nothing to DB
```