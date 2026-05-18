# Aigent.ly — Architecture & Data Model

> **Source of truth for schema:** `packages/db/src/schema.ts`
> This document reflects the current state of the codebase as of May 2026.

---

## 1. System Overview

Aigent.ly is a community-powered directory of AI coding guardrails — security rules that developer IDE assistants (Cursor, Claude Code, Windsurf, Copilot, Cline) enforce while writing code.

### Monorepo Layout

```
aigently-v1/
├── apps/
│   ├── web/                  Next.js 15 (App Router) — UI + DB scripts
│   │   ├── app/              Pages: /rules /explore /layers /threats /stacks /news /demo /learn
│   │   ├── scripts/          Data pipeline scripts (seed, sync, amplify, ingest)
│   │   └── drizzle/          SQL migration files (0000–0005)
│   └── api/                  Fastify API — /v1/* REST endpoints + /docs Swagger UI
├── packages/
│   ├── db/                   Shared Drizzle ORM schema (source of truth)
│   ├── api-client/           TypeScript client generated from OpenAPI spec
│   ├── mcp-server/           Model Context Protocol server for IDE integrations
│   ├── mvp-catalog/          Launch-stack config, stack registry, threat ship helpers
│   └── catalog-data/         Seed JSON (seed-master.json, seed-threat-stack.json)
├── specs/
│   └── openapi.yaml          OpenAPI source document
└── docs/                     Architecture, database, deployment docs
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS v4, Auth.js v5 |
| API | Fastify v5, Swagger/OpenAPI |
| Database | PostgreSQL (Supabase), Drizzle ORM |
| AI | Claude (Anthropic SDK) — claude-sonnet-4-6 / claude-opus-4-7 |
| MCP | @modelcontextprotocol/sdk |
| Monorepo | pnpm workspaces |

### High-Level Data Flow

```
External Sources                  DB (PostgreSQL / Supabase)
─────────────────                 ──────────────────────────
NVD / GHSA / OSV / npm  ──sync──▶  threat
CISA KEV               ─────────▶  threat_stack
News articles (URL)    ──ingest──▶  threat + article
                                    │
                                    ▼
                                  rule (+ bodyMdx)
                                  rule_layer_map ──▶ layer
                                  rule_threat_map ──▶ threat
                                  rule_stack ──▶ stack
                                    │
                                    ▼
Claude (amplify)  ────────────────▶ threat.aiAmplification
Claude (summarize)─────────────────▶ summarized_guardrail
                                    │
                                    ▼
                                  Fastify API (/v1/*)
                                    │
                                    ▼
                                  Next.js UI + MCP Server
```

---

## 2. Data Model

### Core Entities

#### `stack` — Technology stacks (Next.js, FastAPI, Django, etc.)

| Column | Type | Notes |
|---|---|---|
| `id` | smallint PK | Auto-identity |
| `slug` | text | URL-safe identifier e.g. `nextjs` |
| `name` | text | Display name |
| `catalog_status` | enum | `launch` or `coming_soon` |
| `security_grade` | text | A/B/C/D editorial rating |
| `ecosystem` | text | `npm`, `pypi`, `rubygems`, `go` |
| `nvd_keywords` | text[] | Used to query NVD for CVEs |
| `osv_ecosystem` | text | Used to query OSV |

#### `rule` — Security guardrail rules

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text | e.g. `nextjs-security-patterns-v1` |
| `name` | text | Display name |
| `body_mdx` | text | Full guardrail content in MDX |
| `summary_mdx` | text | AI-generated summary |
| `rule_type` | enum | `pattern`, `deps`, `config`, `runtime` |
| `strength_score` | int | 0–100 computed quality score |
| `certified` | bool | Editorial certification flag |

#### `threat` — Security vulnerabilities and threats

| Column | Type | Notes |
|---|---|---|
| `public_id` | text PK | CVE ID or `AIGENTLY-YYYY-*` |
| `family` | enum | `owasp_web`, `owasp_llm`, `mitre_atlas`, `vibe_coding` |
| `severity` | enum | `critical`, `high`, `medium`, `low`, `info` |
| `cve_id` | text | CVE identifier if applicable |
| `owasp_refs` | text[] | e.g. `['A01', 'LLM01']` |
| `source` | enum | `nvd`, `osv`, `ghsa`, `cisa_kev`, `aigently_internal` |
| `ai_amplification` | text | JSON: `{ patternLines, ruleContext, model, generatedAt }` |
| `is_actively_exploited` | bool | Flagged by CISA KEV |

#### `layer` — Protection layer taxonomy (15 layers)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text | e.g. `auth_session`, `input_validation` |
| `name` | text | e.g. `Authentication & Session` |
| `concern_statement` | text | Used in summarizer prompt |
| `is_system` | bool | TRUE = Tier 1 (always visible) |
| `is_active` | bool | FALSE = hidden until ≥3 rules exist |
| `sort_order` | int | Display ordering |

#### `ide` — Supported IDEs

Cursor, Claude Code, Windsurf, Cline, GitHub Copilot. Used to scope rule exports.

#### `article` — News feed entries

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text | URL-safe news slug |
| `title` | text | News headline |
| `excerpt` | text | 1-2 sentence developer-centric summary |
| `tags` | text[] | e.g. `['breach', 'ai', 'a07']` |
| `body_mdx` | text | Source link + threat description + guardrail patterns |
| `published_at` | timestamptz | Article publish date |

---

### Junction / Mapping Tables

| Table | Purpose |
|---|---|
| `rule_stack` | M:M — which stacks a rule applies to |
| `rule_ide` | M:M — which IDEs a rule targets |
| `rule_layer_map` | M:M — which protection layer(s) a rule belongs to |
| `rule_threat_map` | M:M — which CVEs/threats a rule protects against |
| `rule_severity_tag` | M:M — severity tags on a rule |
| `threat_stack` | M:M — which stacks a threat affects, with per-stack severity |
| `threat_layer` | M:M — which layers a threat maps to (with `relevance`: primary/secondary) |
| `stack_layer` | M:M — which layers are active for a given stack |
| `article_rule_map` | M:M — links news articles to rules (future use) |

---

### Computed / Cache Tables

#### `summarized_guardrail` — Cached LLM-merged guardrails

Stores the output of the multi-rule summarizer for a `(stack, layer, ide)` triple. Cache key is content-addressed (SHA-256 of sorted rule body hashes).

#### `rule_usage_daily` — Daily copy-count telemetry

Tracks how many times each rule's content was copied per calendar day.

---

### Auth Tables (Auth.js)

Standard Auth.js schema: `user`, `account`, `session`, `verificationToken`, `authenticator`.

The `user` table has a `role` column (`"user"` | `"admin"`) for RBAC.

---

### Operational Tables

| Table | Purpose |
|---|---|
| `sync_log` | Records each threat pipeline run (start, finish, coverage %, status) |
| `content_revision` | Git SHA tracking for rule/article content versions |
| `stack_coverage_area` | Editorial coverage % per stack area |
| `stack_framework_feature` | Per-stack framework capability matrix |
| `policy_template` | Composer policy templates linked to a layer + stack |

---

## 3. Protection Layer Taxonomy

15 layers across 3 tiers. OWASP mapping drives automatic `threat_layer` population.

### Tier 1 — Core (is_system=TRUE, always visible)

| Slug | Name | OWASP Primary |
|---|---|---|
| `auth_session` | Authentication & Session | A07 |
| `authz_access` | Authorization & Access Control | A01 |
| `input_validation` | Input Validation & Sanitization | A03, A04, A08 |
| `secrets_credentials` | Secrets & Credentials | A05 |
| `dependency_supply` | Dependency & Supply Chain | A06 |
| `data_privacy` | Data Privacy & Compliance | A02 |

### Tier 2 — Infrastructure (is_active=FALSE until ≥3 rules)

| Slug | Name | OWASP Primary |
|---|---|---|
| `api_security` | API Security & Rate Limiting | A10 |
| `database` | Database Hardening | A01 (RLS) |
| `infrastructure` | Infrastructure & Deployment | A05 (misconfig) |
| `caching_cdn` | Caching & CDN | A08 (integrity) |
| `frontend_network` | Frontend & Network Security | A03 (XSS), A08 (CSRF) |

### Tier 3 — Operational (is_active=FALSE until ≥3 rules)

| Slug | Name | OWASP Primary |
|---|---|---|
| `observability` | Observability & Incident Response | A09 |
| `resilience` | Resilience & Recovery | — |
| `ai_safety` | AI & LLM Safety | LLM01–LLM10 |
| `code_quality` | Code Quality & Patterns | — |

---

## 4. Top-Level Architectural Features

### Rule Catalog

Rules are MDX documents scoped to one or more stacks, IDEs, and layers. Each rule links to the CVEs it mitigates via `rule_threat_map`. Rules have a `strength_score` (0–100) computed from CVE count, review count, IDE coverage, and editorial certification.

**Key files:** `apps/api/src/repos/rulesRepo.ts`, `apps/web/lib/catalog-from-db.ts`

### Threat Intelligence Pipeline

Automated pipeline ingesting CVEs from 5 sources into the `threat` table:

```
npm-audit → normalise → OSV → GHSA → NVD enrichment → CISA KEV flag → upsert
```

Run: `pnpm --filter web sync:threats`

After sync, run `pnpm --filter web amplify:threats` to generate AI guardrail patterns via Claude for any unprocessed threats.

**Key files:** `apps/web/scripts/sync-threats.ts`, `apps/web/scripts/amplify-threats.ts`, `apps/web/scripts/lib/upsert.ts`

### URL → Threat Ingestion

Single-command ingestion from any security news article URL:

```bash
URL="https://cybersecuritynews.com/..." pnpm --filter web ingest:url
```

Claude fetches the article, extracts the threat (CVE, severity, OWASP refs, guardrail patterns), upserts it into `threat` + `threat_layer`, and creates a news feed entry in `article`.

**Key file:** `apps/web/scripts/ingest-url-threat.ts`

### Layer Generalization System

`layer` is a first-class DB entity (not a hardcoded enum). New layers can be added without schema migrations. Threats automatically map to layers via OWASP refs. Rules can belong to multiple layers simultaneously.

**Key files:** `apps/api/src/repos/layersRepo.ts`, `apps/web/app/layers/`

### Multi-Rule Summarizer

3-stage LLM pipeline (normalize → conflict-resolve → synthesize) that merges N rules per `(stack, layer, IDE)` into one canonical guardrail. Results cached in `summarized_guardrail` with content-addressed keys.

Supports multi-layer composition: a single call with `layerSlugs: ["auth_session", "input_validation"]` produces one merged output with per-layer sections.

**Gated by:** `FEATURE_SUMMARIZER=true`

**Key files:** `apps/api/src/services/summarizer/`

#### Admin Bulk Generate (with real-time progress)

The `/admin/guardrails` page includes a **Bulk Generate** panel with three modes:

| Button | Mode | Behaviour |
| --- | --- | --- |
| Fill empty | `empty` | Generates only (stack × layer) pairs that have no cached entry |
| Refresh stale | `stale` | Regenerates expired entries and fills any missing ones |
| Regenerate all | `all` | Forces LLM regeneration of every active (stack × layer) pair |

Clicking any button opens an SSE stream to `GET /api/admin/guardrails/bulk-generate?mode=<mode>`. The route:

1. Does a **dry-count pass** — queries all active `stack_layer` pairs and evaluates `shouldGenerate` per mode, without calling the LLM.
2. Streams a `{"type":"start","total":N,"toProcess":M,"mode":"..."}` event immediately.
3. Iterates the qualifying pairs, calls `runSummarizerForLayer` for each, and streams a `{"type":"progress",...}` event after every pair (including `stackName`, `layerName`, `status`, `ruleCount`, `elapsed` ms).
4. Streams a `{"type":"done","generated":N,"skipped":N,"errors":[...]}` event when finished.

The client component (`BulkGeneratePanel`) consumes the stream via `fetch` + `ReadableStream` (not `EventSource`, to preserve auth cookies), renders a live progress bar, current-pair label, elapsed time, projected ETA (computed once ≥2 pairs complete), and a rolling log of the last 3 completed pairs. On completion it calls `router.refresh()` to reload the guardrails table.

**Key files:**
- `apps/web/app/api/admin/guardrails/bulk-generate/route.ts` — SSE route
- `apps/web/features/admin-guardrails/components/bulk-generate-panel.tsx` — progress UI
- `apps/web/lib/summarizer/pipeline.ts` — `runSummarizerForLayer` (called per pair)

### Demo Composer Playground

Interactive UI at `/demo/summarizer` — pick stack + layers + IDE, watch guardrail compose via streaming Claude output.

**Key file:** `apps/web/app/demo/summarizer/`

### Rule Explorer

`/explore` page — client-side filtering of all rules by layer, type, and stack. Stats row shows coverage depth. Inline expand panel with threat list and "Generate summary" CTA.

**Key file:** `apps/web/app/explore/`

### Layer Directory

`/layers` — grid of all 15 protection layers with rule + threat counts. Each `/layers/:slug` page shows rules and threats mapped to that layer.

**Key files:** `apps/web/app/layers/`

### News Feed

`/news` — automatically populated by `ingest:url`. Each article card shows title, excerpt, tags, publish date, and a "Read source →" external link.

**Key file:** `apps/web/app/news/`

### Composer Export

`POST /v1/composer/export` — given a stack + IDE + optional layer filter, returns merged markdown (or `.mdc` for Cursor) of all matching rules, formatted for direct copy into the IDE's rules folder.

**Key file:** `apps/api/src/services/composerExport.ts`

### MCP Server

Claude Code and other MCP-compatible assistants can call:

| Tool | Description |
|---|---|
| `get_security_context` | Returns relevant rules + threats for a developer's intent |
| `compose_guardrail` | Merges rules across layers for a stack (uses summarizer API) |
| `list_layers` | Returns the 15-layer taxonomy |
| `list_stacks` | Returns all supported stacks |
| `get_rule` | Full rule body + AI summary by slug |
| `search_threats` | CVE search with severity/OWASP/stack filters |
| `get_threat` | Single threat detail with guardrail patterns |

**Key file:** `packages/mcp-server/src/index.ts`

---

## 5. Key Data Flows

### Threat Sync Pipeline

```
1. scripts/sync-threats.ts
   → fetch npm-audit + OSV + GHSA + NVD + CISA KEV
   → normalise to NormalisedThreat
   → upsertThreat() → upsertThreatStack()
   → refreshMitigationFlags()
   → closeSyncLog()

2. scripts/amplify-threats.ts
   → query threats WHERE ai_amplification IS NULL
   → Claude tool call → { patternLines, ruleContext }
   → UPDATE threat SET ai_amplification = ...
```

### Rule Seed Pipeline

```
1. packages/catalog-data/seed-master.json  (source of truth for curated rules)
2. scripts/seed.ts
   → upsert stacks, IDEs, threats, threat_stack
   → for each stack × rule type (patterns, deps):
       upsert rule (body from MDX file)
       insert rule_stack, rule_ide, rule_layer_map, rule_threat_map
3. scripts/summarize-rules.ts (optional)
   → Claude generates summaryMdx for each rule
```

### URL Threat Ingestion

```
scripts/ingest-url-threat.ts
  → fetch(URL) → strip HTML → bodyText
  → Claude extract_threat_from_article tool call
  → upsertThreat() → UPDATE ai_amplification
  → insert threat_layer (from OWASP refs)
  → insert article (news feed entry)
```

### Summarizer Pipeline

```
POST /v1/summarize { stackSlug, layerSlugs[], targetIDE }
  → check summarized_guardrail cache (cache_key = SHA-256 of rule bodies)
  → if miss:
      fetchRulesForLayers() → parseRuleIntoAtoms()
      resolveConflicts() → deduplicateAtoms()
      buildSummarizerPrompt() → Claude messages.create()
      INSERT summarized_guardrail
  → return { summarizedContent, ruleCount, conflictCount, provenance, cacheHit }
```

---

## 6. Feature Flags

| Flag | Effect | Default |
|---|---|---|
| `FEATURE_SUMMARIZER=true` | Enables `POST /v1/summarize` and `/demo/summarizer` | off |
| `FEATURE_CERTIFIED_SUMMARIES=true` | Uses `claude-opus-4-7` instead of `claude-sonnet-4-6` for summarizer | off |
| `DRY_RUN=true` | `ingest-url-threat.ts` extracts but does not write to DB | off |
| `STACK_FILTER=nextjs` | Limits `sync-threats.ts` to one stack | unset |
| `BATCH_SIZE=50` | Controls how many threats `amplify-threats.ts` processes per run | 50 |

---

## 7. External Integrations

| Service | Usage | Auth |
|---|---|---|
| **Anthropic Claude** | Rule summarization, threat amplification, URL ingestion | `ANTHROPIC_API_KEY` |
| **NVD (NIST)** | CVE enrichment (CVSS scores, CWE IDs) | `NVD_API_KEY` (optional, raises rate limit) |
| **GitHub Security Advisory API** | GHSA vulnerability data | `GITHUB_TOKEN` |
| **Google OSV** | Open-source vulnerability database | No auth |
| **npm Audit API** | npm package advisories | No auth |
| **CISA KEV** | Known Exploited Vulnerabilities feed | No auth |
| **Supabase** | Hosted PostgreSQL | `DATABASE_URL` |

---

## 8. API Endpoints Reference

Full Swagger docs: `http://localhost:4000/docs` (after `pnpm --filter api dev`)

### Rules
- `GET /v1/rules` — paginated rule list (cursor-based)
- `GET /v1/rules/:slug` — rule detail with layers and linked threats

### Stacks
- `GET /v1/stacks` — all stacks
- `GET /v1/stacks/:slug` — stack detail
- `GET /v1/stacks/:slug/overview` — grades, coverage, framework features, threat matrix
- `GET /v1/stacks/:slug/layers` — active layers for stack with rule counts

### Layers
- `GET /v1/layers` — all active layers with stats
- `GET /v1/layers/:slug` — layer detail
- `GET /v1/layers/:slug/threats` — threats mapped to layer
- `POST /v1/layers/:slug/threats` — associate threat to layer

### Threats
- `GET /v1/threats` — threat catalog

### Composer
- `POST /v1/composer/export` — export merged rules as markdown

### Summarizer (FEATURE_SUMMARIZER=true)
- `POST /v1/summarize` — generate or retrieve cached guardrail
- `POST /v1/summarize/stream` — streaming variant (SSE)

### Misc
- `GET /v1/health` — health check
- `GET /v1/ides` — supported IDEs
- `GET /v1/sync/logs` — recent sync run history
