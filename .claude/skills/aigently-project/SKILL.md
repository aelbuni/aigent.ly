---
name: "aigently-project"
description: "Complete engineering guide for the Aigently.ly monorepo — architecture, data pipeline, admin UI rules, database schema, and operational runbook. Use when: working on any feature or bug in aigently-v1, extending the admin panel, modifying the threat intelligence pipeline, adding guardrails/scoring logic, or onboarding to the codebase."
---

# Aigent.ly Engineering Guide

> Aigent.ly is a community-powered directory of AI coding guardrails — security rules that developer IDE assistants (Cursor, Claude Code, Windsurf, Copilot) enforce while generating code. The platform curates CVE-backed threats, clusters them into rules, summarizes rules into per-stack guardrails, and scores them for quality.

---

## Core Architecture

```
aigently-v1/                     # Private monorepo (this repo)
├── apps/
│   ├── web/                     # Next.js 15 App Router (admin + marketing)
│   └── api/                     # Fastify API (public REST endpoints)
├── packages/
│   └── db/                      # Drizzle ORM schema (shared by web + api)
└── .github/workflows/
    └── sync-threats.yml         # Daily 6-phase data pipeline (06:00 UTC)

aigently-catalog/                # Public sibling repo (open-source)
└── packages/catalog-data/       # JSON snapshots committed daily
    ├── stacks.json
    ├── threats.json
    ├── guardrails.json
    └── rules.json
```

### Four Core Objectives (Always Optimize For These)

| # | Objective | Metric | Current State |
|---|-----------|--------|---------------|
| 1 | **Threats Amplified** | % of threats with `aiAmplification` populated | ~97% |
| 2 | **Threats Summarized** | % of stack×layer pairs with a guardrail | ~8% (target: 100%) |
| 3 | **Threats Scored** | Avg guardrail quality score | ~3.2/10 (target: ≥7) |
| 4 | **Evals Passing** | % of guardrails conflict-free | ~20% (target: ≥80%) |

Every admin UI feature and pipeline change should advance these four objectives. When in doubt, ask: "Does this help threats get amplified, summarized, scored, or evaluated?"

---

## The 6-Phase Data Pipeline

Runs daily at 06:00 UTC via `.github/workflows/sync-threats.yml`. All scripts live in `apps/web/scripts/`.

```
Phase 1: sync:threats      → Fetches CVEs from NVD, GHSA, CISA KEV, OSV, npm-audit
                              Upserts → threat, threat_stack tables
                              Logs run to sync_log table

Phase 2: amplify:threats   → Claude generates ALWAYS/NEVER patterns per threat
                              Updates → threat.aiAmplification (JSON text)

Phase 3: summarize:rules   → Claude clusters CVEs by attack vector into themed rules
                              Updates → rule.summary, rule.summaryMarkdown

Phase 4: summarize:layers  → Claude generates per-layer guardrail summaries per stack
                              Upserts → summarizedGuardrail table
                              Computes → qualityScore (0–10), conflictCount

Phase 5: export:catalog    → Queries DB → writes JSON to aigently-catalog/packages/catalog-data/
                              Produces → stacks.json, threats.json, guardrails.json, rules.json

Phase 6: git commit+push   → Commits catalog-data/ to aigently-catalog repo
                              Message: "chore(catalog): sync $(date)"
```

### Pipeline NPM Scripts

```bash
npm run sync:threats       # Phase 1 — run in web workspace
npm run amplify:threats    # Phase 2
npm run summarize:rules    # Phase 3
npm run summarize:layers   # Phase 4 (web workspace)
npm run export:catalog     # Phase 5
```

### Triggering Manually

```bash
# Full pipeline (all 6 phases)
# Trigger via GitHub Actions → sync-threats.yml → Run workflow

# Individual phases (local dev)
cd apps/web
npx tsx scripts/sync-threats.ts
npx tsx scripts/amplify-threats.ts
npx tsx scripts/summarize-rules.ts
npx tsx scripts/summarize-layers.ts
npx tsx scripts/export-catalog.ts
```

---

## Database Schema (Key Tables)

All in `packages/db/src/schema.ts`. Drizzle ORM, PostgreSQL.

### Core Entities

```typescript
// threat — CVE/vulnerability catalog
{
  publicId: text PK,          // e.g. "owasp_web-sql_injection"
  name: text,
  severity: "critical"|"high"|"medium"|"low"|"info",
  family: "owasp_web"|"owasp_llm"|"mitre_atlas"|"vibe_coding",
  source: "nvd"|"osv"|"ghsa"|"cisa_kev"|"aigently"|"mitre_atlas"|"aigently_internal",
  aiAmplification: text,      // JSON — populated by Phase 2; NULL = not amplified yet
  owaspRefs: text[],          // e.g. ["A01", "A07", "LLM03"]
  mitreAttackIds: text[],
  isActivelyExploited: boolean,
  cveId: text,                // e.g. "CVE-2022-23541"
}

// layer — security protection categories
{
  id: uuid PK,
  slug: text UNIQUE,          // e.g. "authentication_session"
  name: text,
  isActive: boolean,          // IMPORTANT: only active layers get guardrails
  sortOrder: integer,
}

// stack — tech stacks
{
  id: smallint PK,
  slug: text UNIQUE,          // e.g. "nextjs", "fastapi"
  name: text,
  securityGrade: text,        // e.g. "B+"
  catalogStatus: "launch"|"coming_soon",
}

// rule — security guardrail rules
{
  id: uuid PK,
  slug: text UNIQUE,
  strengthScore: integer,     // 0–100; auto-computed; 0 = empty body
  certified: boolean,
}

// summarizedGuardrail — AI-generated per-stack×layer summaries
{
  id: uuid PK,
  stackId: smallint FK,
  layerId: uuid FK,
  content: text,              // MDX guardrail content
  qualityScore: smallint,     // 0–10 auto-computed by summarizer
  scoreOverride: smallint,    // Admin manual override (takes priority)
  scoreNote: text,            // Admin rationale for override
  conflictCount: integer,     // # rule-rule conflicts detected
  expiresAt: timestamp,       // Cache TTL — null = never expires
  summarizerVersion: text,
  cacheKey: text UNIQUE,      // Hash of (stack, layer, rule bodies)
}
```

### Junction Tables

```typescript
threatLayer    // threat ↔ layer (relevance: primary|secondary, rationale)
threatStack    // threat ↔ stack (severity override, isMitigatedByRules)
ruleLayerMap   // rule ↔ layer
ruleStack      // rule ↔ stack
ruleThreatMap  // rule ↔ threat
sourceLayerMapping  // CVE source → layer routing config (CRITICAL — must be configured)
owaspLayerMapping   // OWASP ref → layer routing config
syncLog        // Pipeline run history (status, coveragePercent, sourceSummary JSONB)
```

### The Root Cause of Low Coverage

`sourceLayerMapping` must be configured for threats to get auto-assigned to layers during sync. **If this table is empty, 100% of synced threats will have 0 layer assignments**, which blocks guardrail generation for all layers except manually assigned ones.

**Fix:** Use `/admin/sources` → "Load recommended defaults" button, OR insert via action:
```typescript
await loadDefaultSourceMappings(); // in source-actions.ts
```

---

## Admin UI — Rules & Patterns

### Framework: next-shadcn-dashboard-starter

**RULE: Never invent custom UI outside this framework.** Always compose from:

#### Core Components (`apps/web/components/nextadmin/`)

```tsx
// admin-data-table.tsx
AdminDataTable              // Table container
AdminTableHead              // Column header (align prop: "left"|"right")
AdminTableCell              // Data cell
AdminPrimaryCell            // Title + subtitle + optional href link
AdminStatusPill             // Colored status badge — pass a status string key
AdminRowActions             // Right-aligned action cell (viewHref, deleteAction, extra)
AdminDeleteButton           // Trash icon form button
AdminEmptyState             // "No items" placeholder (colSpan required)

// admin-page-header.tsx
AdminPageHeader             // Page title + description + optional action slot
AdminPrimaryButton          // Blue CTA button (href prop)
AdminSearchForm             // Search form wrapper
AdminSearchInput            // Search text input (name, placeholder, defaultValue)
AdminSearchSubmit           // Search submit button
AdminPagination             // Prev/next with "X–Y of Z" (page, perPage, total, searchParams)
```

#### Design Tokens (use these exact strings)

```css
/* Card/container */
"rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark"
/* Compact card */
"rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark"

/* Typography */
"text-heading-5 font-bold text-dark dark:text-white"   /* Big metric value */
"text-sm font-medium text-dark dark:text-white"         /* Card label */
"text-sm font-medium text-dark-6"                       /* Sub-label */
"text-xs text-dark-6"                                   /* Caption */

/* Status colors */
"text-[#219653]"   /* Green — success, active, amplified */
"text-[#FFA70B]"   /* Amber — warning, needs action, 0 layers */
"text-[#D34053]"   /* Red — critical, error, expired, score 0 */
"text-[#3C50E0]"   /* Blue — medium, default, primary */

/* Progress bar */
"h-2 w-full overflow-hidden rounded-full bg-gray-3 dark:bg-dark-2"  /* track */
"h-full rounded-full bg-[#3C50E0] transition-all"                    /* fill */

/* Urgency banner (red) */
"rounded-[10px] border border-[#D34053]/40 bg-[#D34053]/5 p-4"
/* Warning banner (amber) */
"rounded-[10px] border border-[#FFA70B]/40 bg-[#FFA70B]/5 p-4"
```

#### AdminStatusPill Color Keys

```typescript
// Green (active/good): "paid", "approved", "launch", "live", "done", "low", "active"
// Red (critical/error): "unpaid", "rejected", "critical", "error", "expired"
// Orange (warning): "pending", "high", "under_review", "running", "onboarding"
// Blue (default): "medium", "default", "admin", "pattern", "primary"
// Gray (neutral): "info", "inactive", "coming_soon", "system", "user", "deps", "config"
```

#### Page Patterns

**List page** — async server component:
```tsx
export default async function ListPage({ searchParams }) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { rows, total } = await listEntity({ page, perPage: 25, search: params.search });
  return (
    <div className="space-y-6">
      <AdminPageHeader title="..." description={`${total} items`} action={<AdminPrimaryButton href="...new"><Plus />New</AdminPrimaryButton>} />
      <AdminSearchForm><AdminSearchInput placeholder="..." defaultValue={params.search} /><AdminSearchSubmit /></AdminSearchForm>
      <AdminDataTable>
        {/* thead + tbody with AdminTableHead/Cell/Row */}
        <AdminEmptyState colSpan={N} message="No items found." />
      </AdminDataTable>
      <AdminPagination page={page} perPage={25} total={total} searchParams={{ search: params.search }} />
    </div>
  );
}
```

**Client action component** — use `useTransition`, not `useState(loading)`:
```tsx
"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { myServerAction } from "@/features/admin-x/actions/x-actions";

export function MyActionButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button disabled={isPending} onClick={() => startTransition(async () => { await myServerAction(); })}>
      {isPending ? "Running…" : "Run Action"}
    </Button>
  );
}
```

**Server action pattern:**
```typescript
"use server";
import { requireAdmin } from "@/lib/auth";  // or auth-guard
import { revalidatePath } from "next/cache";

export async function myAction(id: string): Promise<void> {
  await requireAdmin();
  // ... db operation
  revalidatePath("/admin/page");
}
```

---

## Admin Queries (`apps/web/lib/admin-queries.ts`)

Central file for all admin DB queries. Key exported functions:

```typescript
getAdminOverviewStats()       // { stackCount, ruleCount, threatCount, pendingSubmissions, guardrailCount }
getCoreObjectiveMetrics()     // { amplificationPercent, coveragePercent, avgQualityScore, conflictFreePercent, layerAssignmentPercent, ... }
getPipelinePhaseStatus()      // { lastSyncRun, unamplifiedThreats, unassignedThreats, staleGuardrails, zeroStrengthRules, zombieRuns }
listThreats(params)           // { rows, total } — supports search, severity, pagination
listStacks(params)            // { rows, total }
listRules(params)             // { rows, total }
listGuardrails(params)        // { rows, total } — includes expiresAt, qualityScore, scoreOverride
listSyncLogs(params)          // { rows, total }
getGuardrailCoverage()        // { totalPairs, coveredPairs, coveragePct, allStacks, allActiveLayers, matrixRows, ... }
getSourceRoutingConfig()      // { sourceMappings, owaspMappings, allLayers }
```

**Coverage denominator is `allStacksCount × allActiveLayersCount`** — never use distinct rule-covered pairs as the denominator (that was the bug that showed 83% instead of 8%).

---

## Admin Pages Map

| URL | Purpose | Key Actions |
|-----|---------|-------------|
| `/admin` | Dashboard | Core objective KPIs, catalog health, pending submissions |
| `/admin/sync` | Pipeline Control Center | 6-phase status cards, per-phase triggers, zombie run cleanup |
| `/admin/threats` | Threat catalog | List (520+), filter by severity, amplification status, layer count |
| `/admin/threats/new` | Create threat | Full form: identity, OWASP refs, layer assignment |
| `/admin/threats/[id]` | Threat detail | Edit, assign layers (tab), assign stacks (tab) |
| `/admin/layers` | Layers | 15 layers; 6 active; bulk-activate needed |
| `/admin/rules` | Rules | 12 rules; most at strength 0; no create UI yet |
| `/admin/stacks` | Stacks | 11 stacks; Grade column; 0-rules warning |
| `/admin/stacks/[id]` | Stack detail | Edit, security grade |
| `/admin/guardrails` | Guardrails | Coverage bar, score coloring, expiresAt; bulk generate |
| `/admin/guardrails/[id]` | Guardrail detail | Score override, re-score & regenerate, provenance |
| `/admin/guardrails/evaluation` | Eval dashboard | True coverage %, 11×N matrix, quality metrics |
| `/admin/sources` | Source routing | Map CVE sources → layers; OWASP ref routing; urgency banner |
| `/admin/submissions` | Submissions | 6-step onboarding workflow |
| `/admin/llm` | LLM config | Provider (Bedrock/Anthropic), per-task model overrides, connectivity test |
| `/admin/users` | Users | Role management (admin/user) |

---

## Critical Operational Rules

### 1. Source Routing Must Be Configured

`/admin/sources` must have source→layer and OWASP→layer mappings. Without them, `reAssignAllThreatLayers()` has nothing to route against, and every sync produces 0 layer assignments.

Default OWASP mappings:
```
A01 → authorization_access_control   A02 → secrets_management
A03 → input_validation_sanitization  A04 → error_handling_logging
A05 → supply_chain_deps              A07 → authentication_session
LLM01-LLM04, LLM07 → ai_safety      LLM08 → secrets_management
LLM09 → supply_chain_deps
```

Default source mappings:
```
nvd       → input_validation_sanitization (primary), authentication_session (secondary)
ghsa, osv → supply_chain_deps (primary)
cisa_kev  → authentication_session (primary), input_validation_sanitization (secondary)
mitre_atlas → ai_safety (primary)
aigently_internal → authentication_session (primary)
```

### 2. Guardrail Quality Scoring

Score = `qualityScore` (auto, 0–10) OR `scoreOverride` (admin manual, takes priority).

Auto-score formula (in summarizer pipeline):
- Conflict penalty: `10 - conflictCount * 1.5` (floor 0)
- Breadth: `sourceRuleCount * 2` (max 10)
- Completeness: `contentLength / 200` (max 10)
- Freshness: `10 - daysSince * 0.3` (floor 0)
- Average of above four

Score thresholds:
- `≥ 7` = Good (green)
- `5–6` = Acceptable (amber)
- `1–4` = Poor (amber)
- `0` = Failed / unusable (red)

High conflict counts (Express has 168) indicate the rule set has contradictions. Fix via rule body cleanup + re-summarize.

### 3. Layer Activation

8 of 15 layers are `isActive = false`. Inactive layers:
- Do not appear in the public API
- Do not get guardrails generated
- Are not counted in coverage denominators

To activate: edit the layer in `/admin/layers/[id]` → toggle Active → Save.

### 4. Rule Strength Scoring

```
strengthScore = min(doNotScore + certificationScore + lineScore + 10, 100)
  doNotScore:       +10 if body contains "DO NOT", "NEVER", or "AVOID"
  certificationScore: +20 if rule.certified = true
  lineScore:          min(floor(lineCount / 5), 20)
  baseline:           +10
```

11 of 12 rules currently score 0, meaning their bodies are empty. Populate rule bodies to raise scores, then re-run `summarize:rules`.

### 5. Sync Coverage

`sync_log.coveragePercent` = `COUNT(DISTINCT threat_id FROM rule_threat_map) / COUNT(*) FROM threat`. This measures rule coverage, not guardrail coverage. A consistent 7% means the rule-to-threat mapping is sparse — not a sync failure.

### 6. Nested Form/Anchor Bugs (Fixed)

These were fixed but must not be reintroduced:
- `<Link>` wrapping `<Link>` → nested `<a>` hydration error. Fix: only one `<Link>` per navigation target.
- Delete `<form>` inside Save `<form>` → invalid HTML. Fix: sibling forms only.

---

## Key File Paths

```
apps/web/
  app/(admin)/admin/               # All admin pages (server components)
  app/(marketing)/                 # Public pages (rules, stacks, threats, learn)
  components/nextadmin/            # Admin UI framework components
    admin-data-table.tsx           # AdminDataTable, AdminTableHead, AdminStatusPill, etc.
    admin-page-header.tsx          # AdminPageHeader, AdminPrimaryButton, AdminPagination
    admin-shell.tsx                # Main admin layout
    layouts/sidebar/               # Nav sidebar (logo, nav items)
    overview/card.tsx              # Dashboard health card
  components/ui/                   # shadcn/ui primitives
  features/
    admin-threats/actions/         # threat-actions.ts
    admin-stacks/actions/          # stack-actions.ts
    admin-sources/actions/         # source-actions.ts (loadDefaultSourceMappings)
    admin-sync/actions/            # sync-actions.ts (triggerAmplification, clearZombieRuns)
    admin-guardrails/              # guardrail server actions
  lib/
    admin-queries.ts               # ALL admin DB queries — add new queries here
    db.ts                          # Drizzle DB singleton
  scripts/
    sync-threats.ts                # Phase 1
    amplify-threats.ts             # Phase 2
    summarize-rules.ts             # Phase 3
    summarize-layers.ts            # Phase 4
    export-catalog.ts              # Phase 5

apps/api/
  src/routes/v1.ts                 # All public REST API routes
  src/repos/                       # Fastify repo layer (threatsRepo, layersRepo, etc.)
  src/services/summarizer/         # Summarizer pipeline (pipeline.ts, atoms.ts, conflicts.ts)

packages/db/
  src/schema.ts                    # All table definitions — source of truth for column names

.github/workflows/
  sync-threats.yml                 # Primary daily pipeline
  catalog-sync.yml                 # Manual catalog regeneration
  db-migrate.yml                   # Drizzle migrations
  openapi-validate.yml             # OpenAPI spec linting
```

---

## Runbook: Common Operations

### Add a new threat
1. Go to `/admin/threats/new`
2. Fill Identity (publicId, CVE ID, source, family), Details (name, severity, description)
3. Fill AI Amplification Narrative (or leave for pipeline to auto-populate)
4. Check relevant OWASP refs → these drive layer auto-assignment
5. Check layer assignment (Layers tab on detail page after save)

### Generate guardrails for a stack
1. Ensure source routing is configured (`/admin/sources`)
2. Go to `/admin/guardrails`
3. Use the "Generate guardrail" form (pick stack + layer) or Bulk Generate → "Fill empty"
4. Check scores on `/admin/guardrails/evaluation`

### Fix low guardrail quality (score 0)
1. Check `conflictCount` — high values (>20) mean rule bodies contradict each other
2. Review rule bodies at `/admin/rules/[id]` → Body MDX tab
3. Fix contradictions in rule body content
4. Re-run `npm run summarize:layers`
5. Use "Re-score & Regenerate" on `/admin/guardrails/[id]` for individual guardrails

### Clear a stuck sync run
1. Go to `/admin/sync`
2. If zombie run warning shows → click "Clear N zombie runs"
3. OR in DB: `UPDATE sync_log SET status = 'failed' WHERE status = 'running' AND started_at < NOW() - INTERVAL '30 minutes'`

### Onboard a new stack
1. Create stack at `/admin/stacks/new` (name, slug, ecosystem, security grade)
2. Add rules for the stack at `/admin/rules` (currently no create UI — add via DB seed or API)
3. Assign rules to stack
4. Go to `/admin/guardrails` → Bulk Generate for the new stack
5. Set stack to `catalogStatus: launch` when ready

---

## Environment Variables

```bash
# Required for web app
DATABASE_URL=                  # PostgreSQL connection string
NEXTAUTH_SECRET=               # NextAuth session secret
NEXTAUTH_URL=                  # App URL

# Required for pipeline
ANTHROPIC_API_KEY=             # Claude API (amplification + summarization)
NVD_API_KEY=                   # NIST NVD CVE API
GITHUB_TOKEN=                  # GitHub Advisory (GHSA) API

# Optional / AWS Bedrock alternative
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=

# Admin bypass (dev only)
ADMIN_BYPASS=true              # Skip admin role check in local dev
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, server components) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Drizzle ORM |
| Admin UI | next-shadcn-dashboard-starter + shadcn/ui |
| API | Fastify (apps/api) |
| AI | Anthropic Claude (Sonnet 4.6 default, Bedrock supported) |
| Auth | NextAuth.js |
| Package manager | npm workspaces (monorepo) |
| CI/CD | GitHub Actions |
| Hosting | Hostinger (standalone Next.js build) |
| Styling | Tailwind CSS |
