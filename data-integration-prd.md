# Aigent.ly — Data Integration PRD
## What to use for what · Schema delta · Integration architecture
### Version 1.0 · Based on current schema + 4 live application screens

---

## 1. EXECUTIVE SUMMARY

This PRD defines exactly which external data source feeds which database table,
what is missing from the current schema to support the live UI, and how the
full data pipeline should be built and maintained.

**Three data categories in the product:**

| Category | Source type | Update frequency | Owner |
|---|---|---|---|
| Threats / CVEs | External APIs (OSV, NVD, CISA) | Daily automated sync | GitHub Action |
| MITRE ATLAS techniques | Static STIX bundle | Quarterly manual update | Aigent.ly team |
| OWASP categories | Static JSON (curated) | Annually | Aigent.ly team |
| Rules content | MDX files in repo | On PR merge | Contributors |
| Stacks / IDEs | Static seed data | On new stack launch | Aigent.ly team |
| Community reviews / usage | User-generated, in DB | Real-time | App layer |

---

## 2. WHAT THE UI REQUIRES — SCREEN-BY-SCREEN AUDIT

### Screen 1: Rules Directory
Data currently supported by schema: ✅ mostly covered
Gaps identified from the UI:
- Filter "Protects Against" shows OWASP IDs (A03:2021, LLM01) and custom tags
  (MEMSEC, A04, SEC-HI). The current `ruleThreatMap` only links to `threat.publicId`.
  The UI needs OWASP short-codes (A01–A10, LLM01–LLM10) as first-class filterable
  values — not derivable from joining threat at query time without indexes.
- "USES 1.2k / 840 / 2.4k" shown on cards — sourced from `ruleUsageDaily`.
  Needs a DB view or materialized view to aggregate weekly totals efficiently.
- Card shows stack logo — `stack.logoPath` exists ✅ but needs a CDN base URL config.

### Screen 2: Threat Intelligence
Data gaps are most severe here:
- CVE IDs shown (CVE-2024-X921, CVE-2024-MCP8, SLOP-SQT-11, ECHO-LK-04).
  Current `threat.publicId` is used as primary key and doubles as the display ID ✅
  BUT there is no separate `cveId` field for cases where publicId ≠ CVE ID
  (e.g. SLOP-SQT-11 is not a CVE — it's a Aigent.ly internal identifier).
- MITRE ATT&CK technique IDs shown as tags (T1190, T1057, T1584, T1195, T1185).
  Not present in schema at all — missing field.
- "VULNERABLE: Curio-Core, LangChain 0.3.x, MCP Servers, CLI-Parser, PyPI npm"
  — specific affected product+version data. Not in schema.
- "X RULES PROTECT" count — derivable from `ruleThreatMap` COUNT ✅
- Vulnerability Matrix renders stacks (NEXT, FAST, RAILS, PY, L-ON, MCP) vs
  threat categories (INJECTION, AUTH, DATA LEAK, PROMPT, AGENT, [?]).
  This requires a `threatStack` junction table — completely missing from schema.
- "OWASP LLM COVERAGE: 82.4%" and "VIBE CVE DATABASE SYNC: 96.1%"
  — these coverage percentages require a `syncLog` or `coverageMetric` table.
- Source attribution shown ("Curio-Core", "Claude Desktop") — needs `source` field.

### Screen 3: Rule Composer
- Policy layers shown include named templates:
  "OWASP Top 10 Patterns", "Credential Leak Prevention", "Supply Chain Integrity",
  "Strict TypeScript Rules", "Vitest Coverage Min. 80%", "Performance Budgeting"
  These are richer than the current `ruleLayerEnum` (security/architecture/code_quality).
  Needs a `policyTemplate` table or at minimum a structured tags array on rule.
- Live YAML preview is client-side composition — no DB requirement ✅
- "Save to Library" — saves a composed ruleset. No table for saved compositions.
  Needs a `composedRuleset` table tied to authenticated user.
- "Export Ruleset (.cursorrules)" — pure client-side export ✅

### Screen 4: Stacks
- Security grade "B+" shown prominently. Not in schema — missing field on `stack`.
- "TOP RISKS FOR THIS STACK • 02 CRITICAL • 05 HIGH" — derivable from
  `threatStack` join + severity filter. Requires the missing `threatStack` table.
- "Automated Coverage" section: CLIENT HYDRATION 92%, EDGE MIDDLEWARE 64%,
  SERVER ACTIONS 28%. These are stack-specific coverage area percentages.
  Completely missing — needs a `stackCoverageArea` table.
- "WHAT THE FRAMEWORK HANDLES" table: XSS Prevention BUILT-IN, Route Protection
  MANUAL CFG, CORS Policy MANUAL CFG, etc. — structured data, not in schema.
  Needs a `stackFrameworkFeature` table.

---

## 3. SCHEMA DELTA — REQUIRED CHANGES

### 3a. Changes to existing tables

#### `threat` table — ADD these columns:
```sql
-- External source identifier (CVE ID, GHSA ID, OSV ID, or Aigent.ly custom ID)
cve_id          text,                    -- e.g. "CVE-2024-44000", null if internal
external_id     text,                    -- original ID from source system
source          text,                    -- 'nvd' | 'osv' | 'ghsa' | 'cisa_kev' | 'aigently'
source_url      text,                    -- link back to original advisory
published_at    timestamp with time zone,
synced_at       timestamp with time zone, -- when we last pulled from source

-- Structured references (replaces scattered data in details jsonb)
mitre_attack_ids   text[],              -- e.g. ['T1190', 'T1057', 'T1584']
owasp_refs         text[],              -- e.g. ['LLM01', 'LLM04', 'A03']
affected_products  jsonb,               -- [{name, version, ecosystem}]
patched_version    text,                -- e.g. "LangChain >= 0.4.0"
is_actively_exploited boolean default false,  -- from CISA KEV

-- Keep details jsonb but treat it as raw source payload, not primary data
```

#### `stack` table — ADD these columns:
```sql
security_grade      text,        -- 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D'
grade_rationale     text,        -- short explanation shown in UI tooltip
ecosystem           text,        -- 'npm' | 'PyPI' | 'RubyGems' | 'Go' | etc.
nvd_keyword         text[],      -- keywords for NVD API query e.g. ['next.js', 'vercel']
osv_ecosystem       text,        -- OSV ecosystem name e.g. 'npm', 'PyPI'
```

#### `ruleReview` table — ADD one column:
```sql
author_handle   text,    -- anonymous display name (e.g. "@dev_handle"), nullable
is_verified     boolean not null default false,  -- verified real usage
```

### 3b. New tables required

#### `threatStack` — powers the vulnerability matrix
```typescript
export const threatStack = pgTable(
  "threat_stack",
  {
    threatId: text("threat_id")
      .notNull()
      .references(() => threat.publicId, { onDelete: "cascade" }),
    stackId: smallint("stack_id")
      .notNull()
      .references(() => stack.id, { onDelete: "cascade" }),
    severity: severityLevelEnum("severity").notNull(),
    isMitigatedByRules: boolean("is_mitigated_by_rules").notNull().default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.threatId, t.stackId] }),
  })
);
```
**Feeds**: Vulnerability Matrix on Threats page, Top Risks count on Stacks page.
**Populated by**: Sync job — maps CVE CPE/ecosystem data to your stack slugs.

---

#### `stackCoverageArea` — powers "Automated Coverage" on Stacks page
```typescript
export const stackCoverageArea = pgTable(
  "stack_coverage_area",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    stackId: smallint("stack_id")
      .notNull()
      .references(() => stack.id, { onDelete: "cascade" }),
    areaName: text("area_name").notNull(),   -- "CLIENT HYDRATION", "EDGE MIDDLEWARE"
    coveragePct: smallint("coverage_pct").notNull(), -- 0–100
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("stack_coverage_area_uniq").on(t.stackId, t.areaName),
  })
);
```
**Feeds**: "Automated Coverage" section on Stacks page.
**Populated by**: Aigent.ly team, manually updated per stack, seeded at launch.

---

#### `stackFrameworkFeature` — powers "What the Framework Handles" table
```typescript
export const stackFrameworkFeature = pgTable(
  "stack_framework_feature",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    stackId: smallint("stack_id")
      .notNull()
      .references(() => stack.id, { onDelete: "cascade" }),
    featureName: text("feature_name").notNull(),   -- "XSS Prevention"
    status: text("status").notNull(),              -- 'built_in' | 'manual_cfg' | 'not_supported'
    notes: text("notes"),
    sortOrder: smallint("sort_order").notNull().default(0),
  }
);
```
**Feeds**: Framework feature table on Stacks page.
**Populated by**: Aigent.ly team, seeded per stack at launch.

---

#### `syncLog` — powers coverage % meters on Threats page
```typescript
export const syncLog = pgTable("sync_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  source: text("source").notNull(),        -- 'osv' | 'nvd' | 'ghsa' | 'cisa_kev' | 'mitre_atlas'
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status").notNull(),        -- 'running' | 'success' | 'failed'
  threatsAdded: integer("threats_added").notNull().default(0),
  threatsUpdated: integer("threats_updated").notNull().default(0),
  coveragePct: smallint("coverage_pct"),   -- % of target stacks covered by this source
  errorMessage: text("error_message"),
});
```
**Feeds**: "OWASP LLM COVERAGE: 82.4%" and "VIBE CVE DATABASE SYNC: 96.1%" on Threats page.
The coverage % is computed as: (threats with ≥1 protecting rule / total threats) × 100.

---

#### `policyTemplate` — powers named policy options in Rule Composer
```typescript
export const policyTemplate = pgTable("policy_template", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),         -- "OWASP Top 10 Patterns"
  description: text("description"),
  layer: ruleLayerEnum("layer").notNull(),
  category: text("category").notNull(), -- 'security_risk' | 'quality_testing'
  sortOrder: smallint("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
});

export const policyTemplateStack = pgTable(
  "policy_template_stack",
  {
    templateId: integer("template_id")
      .notNull()
      .references(() => policyTemplate.id, { onDelete: "cascade" }),
    stackId: smallint("stack_id")
      .notNull()
      .references(() => stack.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.templateId, t.stackId] }) })
);
```
**Feeds**: Policy Layers step in Rule Composer.
**Populated by**: Aigent.ly team, seeded at launch.

---

#### `composedRuleset` — powers "Save to Library" in Rule Composer
```typescript
export const composedRuleset = pgTable("composed_ruleset", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  stackId: smallint("stack_id")
    .references(() => stack.id, { onDelete: "set null" }),
  ideId: smallint("ide_id")
    .references(() => ide.id, { onDelete: "set null" }),
  policyTemplateIds: integer("policy_template_ids").array().notNull().default([]),
  composedContent: text("composed_content").notNull(),  -- the assembled YAML/rule text
  exportFormat: text("export_format").notNull(),         -- 'cursorrules' | 'claude_md' | etc.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```
**Feeds**: Saved rulesets in user account (future "My Library" page).

---

#### DB View: `rule_weekly_usage` — powers "USES 1.2k" on rule cards
```sql
CREATE MATERIALIZED VIEW rule_weekly_usage AS
  SELECT
    rule_id,
    SUM(copy_count) AS weekly_copies
  FROM rule_usage_daily
  WHERE bucket_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY rule_id;

CREATE UNIQUE INDEX ON rule_weekly_usage (rule_id);
-- Refresh: pg_cron every hour, or on each copy event via REFRESH CONCURRENTLY
```

---

## 4. API SOURCE → TABLE MAPPING

### Source 1: OSV.dev — `api.osv.dev/v1/query`
**Free. No key. POST request by ecosystem.**

Maps to: `threat` table

```
OSV field              → DB column
─────────────────────────────────────────────────────────
id                     → threat.external_id
aliases[0] (CVE ID)    → threat.cve_id
summary                → threat.name
details                → threat.description
database_specific.severity → threat.severity (normalize to enum)
published              → threat.published_at
modified               → threat.synced_at
affected[].package.ecosystem → used to populate threatStack junction
affected[].package.name      → threat.affected_products[].name
affected[].ranges            → threat.affected_products[].version
references[].url       → threat.source_url (first reference)
```

Ecosystem → Stack mapping:
```
OSV ecosystem     →  Aigent.ly stack slug(s)
─────────────────────────────────────────────
npm               →  nextjs, react, express, nodejs
PyPI              →  fastapi, django
RubyGems          →  rails
Go                →  go
Packagist         →  laravel
Maven             →  android
SwiftURL          →  ios
crates.io         →  (future: rust)
```

Query pattern per sync run:
```js
// For each ecosystem, fetch last 90 days of HIGH/CRITICAL advisories
POST https://api.osv.dev/v1/query
{
  "package": { "ecosystem": "npm" },
  // OSV doesn't support date filtering in query — filter in JS after fetch
}
// Then filter: keep only severity === 'CRITICAL' || 'HIGH'
// Then upsert into threat table, using external_id as conflict key
```

---

### Source 2: NVD API v2 — `services.nvd.nist.gov/rest/json/cves/2.0`
**Free. Free API key from nvd.nist.gov for 10× rate limit.**

Maps to: `threat` table (enrichment pass — adds CVSS scores, CWE, references)

```
NVD field                                    → DB column
───────────────────────────────────────────────────────────────
cve.id                                       → threat.cve_id
cve.descriptions[0].value                    → threat.description (fallback)
cve.metrics.cvssMetricV31[0].cvssData.baseSeverity → threat.severity
cve.published                                → threat.published_at
cve.weaknesses[].description[].value (CWE)  → used for OWASP mapping
cve.references[].url                         → threat.source_url
cve.cisaExploitAdd (if present)              → threat.is_actively_exploited = true
```

Query pattern — keyword search per stack:
```js
GET https://services.nvd.nist.gov/rest/json/cves/2.0
  ?keywordSearch=next.js
  &cvssV3Severity=CRITICAL
  &pubStartDate=2025-01-01T00:00:00.000
  &pubEndDate=2026-05-03T00:00:00.000
  &resultsPerPage=100
```

CWE → OWASP mapping table (store in code, not DB):
```
CWE-89  → A03   CWE-79  → A03   CWE-78  → A03  (Injection)
CWE-284 → A01   CWE-22  → A01              (Access Control)
CWE-287 → A07   CWE-306 → A07              (Auth Failures)
CWE-798 → A05   CWE-312 → A05              (Secrets / Misconfig)
CWE-918 → A10                               (SSRF)
CWE-352 → A08                               (CSRF)
CWE-327 → A02   CWE-326 → A02              (Crypto)
CWE-1104 → A06                              (Outdated Components)
```
After mapping, write to `threat.owasp_refs[]`.

---

### Source 3: GitHub Advisory DB — `api.github.com/advisories`
**Free with GitHub personal token (5,000 req/hr).**

Maps to: `threat` table

```
GHSA field                    → DB column
──────────────────────────────────────────────────────
ghsaId                        → threat.external_id
cveId                         → threat.cve_id
summary                       → threat.name
description                   → threat.description
severity                      → threat.severity
publishedAt                   → threat.published_at
vulnerabilities[].package     → threat.affected_products
references[].url              → threat.source_url
```

GraphQL query:
```graphql
query($ecosystem: SecurityAdvisoryEcosystem!, $cursor: String) {
  securityVulnerabilities(
    ecosystem: $ecosystem
    first: 100
    after: $cursor
    severities: [CRITICAL, HIGH]
    orderBy: { field: UPDATED_AT, direction: DESC }
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {
      advisory {
        ghsaId
        cveId
        summary
        description
        severity
        publishedAt
        references { url }
      }
      package { name ecosystem }
      vulnerableVersionRange
      firstPatchedVersion { identifier }
    }
  }
}
```

---

### Source 4: CISA KEV — static JSON, no key
**`cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`**

Maps to: `threat.is_actively_exploited = true` (enrichment pass only)

```js
// Fetch KEV list, build a Set of CVE IDs
const kevIds = new Set(kevData.vulnerabilities.map(v => v.cveID));

// Update threats where cve_id is in kevIds
UPDATE threat SET is_actively_exploited = true
WHERE cve_id = ANY($kevIds)
```

This runs as a final enrichment step after all other sources are synced.
Add `cisa_action_due` text column to `threat` if you want to show remediation dates.

---

### Source 5: MITRE ATLAS — static STIX bundle
**`github.com/mitre-atlas/atlas-data` — download quarterly**

Maps to: `threat` table (family = 'mitre_atlas')

These are NOT CVEs — they are attack technique patterns. They populate the
`threat` table with `family = 'mitre_atlas'` and `source = 'mitre_atlas'`.

```
ATLAS STIX field          → DB column
──────────────────────────────────────────────────────
id (attack-pattern--...)  → threat.external_id
name                      → threat.name
description               → threat.description
x_mitre_id (AML.T0051)   → threat.public_id  (use this as publicId directly)
x_mitre_impact_type      → threat.severity (map to enum)
```

After import, manually add `threat.mitre_attack_ids[]` for cross-references
to standard MITRE ATT&CK (non-ATLAS) technique IDs shown in the UI as tags.

---

### Source 6: Static content — Aigent.ly team curated

| Content | Table | Update method |
|---|---|---|
| OWASP Web Top 10 | `threat` (family=owasp_web) | Seed script, update annually |
| OWASP LLM Top 10 | `threat` (family=owasp_llm) | Seed script, update annually |
| Vibe coding CVEs | `threat` (family=vibe_coding) | Manual insert, reviewed by team |
| Stack definitions | `stack` | Seed script |
| IDE definitions | `ide` | Seed script |
| Stack grades | `stack.security_grade` | Seed script, team updates |
| Coverage areas | `stackCoverageArea` | Seed script per stack |
| Framework features | `stackFrameworkFeature` | Seed script per stack |
| Policy templates | `policyTemplate` | Seed script |

---

## 5. SYNC PIPELINE ARCHITECTURE

### GitHub Actions workflow — runs daily at 06:00 UTC

```
Step 1: CISA KEV fetch        (30s)   → mark is_actively_exploited
Step 2: OSV batch fetch       (3min)  → upsert threats + threatStack
Step 3: NVD enrichment        (4min)  → add CVSS, CWE → OWASP mapping
Step 4: GitHub Advisory fetch (2min)  → add GHSA metadata
Step 5: Compute coverage %    (10s)   → write to syncLog
Step 6: Refresh materialized  (5s)    → rule_weekly_usage view
```

### Conflict resolution (upsert strategy)

Primary key for dedup: `threat.external_id` (not publicId).

```sql
INSERT INTO threat (external_id, cve_id, name, description, severity, ...)
VALUES (...)
ON CONFLICT (external_id) DO UPDATE SET
  name        = EXCLUDED.name,
  severity    = EXCLUDED.severity,
  synced_at   = now(),
  -- Never overwrite manually curated fields:
  -- ai_amplification, mitre_attack_ids (if set by team), owasp_refs (if set by team)
  ai_amplification = COALESCE(threat.ai_amplification, EXCLUDED.ai_amplification),
  mitre_attack_ids = COALESCE(
    NULLIF(threat.mitre_attack_ids, ARRAY[]::text[]),
    EXCLUDED.mitre_attack_ids
  );
```

### `publicId` convention (important — currently overloaded)

The current schema uses `threat.publicId` as both the PK and the display ID.
With external sources, these are different things. Proposed convention:

```
source = 'nvd'         → publicId = cve_id              (e.g. "CVE-2024-44000")
source = 'osv'         → publicId = OSV ID               (e.g. "GHSA-xxxx-xxxx-xxxx")
source = 'aigently'    → publicId = internal ID          (e.g. "SLOP-SQT-11")
source = 'mitre_atlas' → publicId = ATLAS technique ID   (e.g. "AML.T0051")
source = 'owasp_web'   → publicId = OWASP ID             (e.g. "A03-2021")
source = 'owasp_llm'   → publicId = LLM ID               (e.g. "LLM01-2025")
```

Add a `uniqueIndex` on `threat.external_id` for upsert conflict target.

---

## 6. COMPLETE SCHEMA DELTA SUMMARY

### Add to `threat`:
```typescript
cveId: text("cve_id"),
externalId: text("external_id").unique(),
source: text("source").notNull().default("aigently"),
sourceUrl: text("source_url"),
publishedAt: timestamp("published_at", { withTimezone: true }),
syncedAt: timestamp("synced_at", { withTimezone: true }),
mitreAttackIds: text("mitre_attack_ids").array().notNull().default([]),
owaspRefs: text("owasp_refs").array().notNull().default([]),
affectedProducts: jsonb("affected_products").notNull().default([]),
patchedVersion: text("patched_version"),
isActivelyExploited: boolean("is_actively_exploited").notNull().default(false),
```

### Add to `stack`:
```typescript
securityGrade: text("security_grade"),
gradeRationale: text("grade_rationale"),
ecosystem: text("ecosystem"),
nvdKeywords: text("nvd_keywords").array().notNull().default([]),
osvEcosystem: text("osv_ecosystem"),
```

### Add to `ruleReview`:
```typescript
authorHandle: text("author_handle"),
isVerified: boolean("is_verified").notNull().default(false),
```

### New tables to add:
```
threatStack           — vulnerability matrix + top risks per stack
stackCoverageArea     — automated coverage percentages
stackFrameworkFeature — "what the framework handles" table
syncLog               — pipeline run history + coverage %
policyTemplate        — named composer policy options
policyTemplateStack   — policy → stack junction
composedRuleset       — user-saved composer outputs
```

### New materialized view:
```
rule_weekly_usage     — aggregates ruleUsageDaily for "USES Xk" on cards
```

---

## 7. SEEDING PRIORITY ORDER

Build and run seed scripts in this order to avoid FK constraint failures:

```
1. stacks              (no dependencies)
2. ides                (no dependencies)
3. threats (static)    (no dependencies — seed OWASP Web, OWASP LLM, MITRE ATLAS)
4. threatStack         (depends on threat + stack)
5. policyTemplate      (no dependencies)
6. policyTemplateStack (depends on policyTemplate + stack)
7. stackCoverageArea   (depends on stack)
8. stackFrameworkFeature (depends on stack)
9. rules               (depends on stack, ide, threat via junction tables)
10. ruleStack, ruleIde, ruleLayerMap, ruleThreatMap (depends on rule)
11. syncLog            (first real entry created by first sync job run)
```

---

## 8. WHAT DOES NOT NEED A DB

These are computed client-side or at build time — no additional tables needed:

| UI element | How it works |
|---|---|
| Rule Composer YAML preview | Client-side string assembly from selected templates |
| "X of 10 OWASP covered" meters | COUNT query on ruleThreatMap + threat.owasp_refs filter |
| Export .cursorrules button | Client-side text download, no persistence needed |
| Cmd+K search | Client-side Fuse.js over pre-fetched rule index |
| Filter chips (active state) | URL query params via nuqs, no DB |
| Star rating display | AVG(rating) aggregate on ruleReview, no separate column needed |

---

## 9. OPEN QUESTIONS FOR TEAM DECISION

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Should `threat.public_id` remain the display ID? | Keep overloaded / split into `display_id` | Split — avoids confusion as CVE IDs aren't always the canonical ID |
| 2 | Who can trigger a manual threat sync? | Admin UI / GitHub Action dispatch only | GitHub Action with `workflow_dispatch` — simpler, audit trail in Git |
| 3 | Should community-submitted threats be supported? | Yes / No / Later | Defer to v2 — curation-only for v1 |
| 4 | Should `composedRuleset` be shareable (public URL)? | Yes / No | Yes — adds viral sharing mechanic, low engineering cost |
| 5 | OWASP LLM Top 10 updates annually — auto or manual? | Auto-parse OWASP site / Manual | Manual — OWASP doesn't publish a machine-readable feed |
| 6 | Should vibe coding CVEs (internal IDs like SLOP-SQT-11) have their own enum value in `source`? | Yes / No | Yes — add `'aigently_internal'` as a source value |
```