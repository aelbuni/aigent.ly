# Aigent.ly Admin Panel — Full Audit Report v2

**Date:** 2026-05-18  
**Method:** 5 parallel agents — Playwright UI, Database queries, API endpoint tests, Server action analysis  
**Scope:** All 21 admin pages + API layer + DB state + server actions

---

## Executive Summary

### Core Objective Coverage

| Objective | Current | Target | Status |
|-----------|---------|--------|--------|
| Threats Amplified | 97% (504/520) | 100% | ⚠ Near complete (16 missing) |
| Threats Summarized | 9% (6/66 pairs) | 100% | 🔴 Critical |
| Threats Scored | Avg 7.0/10 | ≥7/10 | ⚠ Passes but misleading (only 6 guardrails) |
| Evals Passing | 33% conflict-free | ≥80% | 🔴 Critical |

### Critical Root Cause Chain

```
loadDefaultSourceMappings() silently fails (layer slug mismatch)
    → Source routing has no effective mappings
    → 519/520 threats have 0 layer assignments
    → Guardrail generation has no threat data for 5/6 active layers
    → Coverage stuck at 9%, evals can't pass
    → Dashboard shows 0% "Threats in Layers" KPI
```

---

## CRITICAL BUGS (Blockers)

### BUG-C1 — `loadDefaultSourceMappings()` silently fails
**Severity:** Critical  
**Page:** `/admin/sources`  
**File:** `apps/web/features/admin-sources/actions/source-actions.ts`

**Reproduction:** Go to `/admin/sources`, click "Load recommended defaults" → page reloads but mappings remain missing. No error shown.

**Root cause:** The `SOURCE_TO_LAYER` constant uses slugs like `"input_validation_sanitization"`, `"authentication_session"`, `"supply_chain_deps"`. The actual DB slugs differ (likely `"input_validation"`, `"auth_session"`, `"supply_chain"` etc.). The function uses `if (!layerId) continue;` which silently skips all rows when slugs don't match — no error, no feedback.

**Impact:** This is the single action that would fix the 9% coverage problem. Without it, 519 of 520 threats have 0 layer assignments.

**Fix required:** Run this DB query to get actual slugs, then align the code constants:
```sql
SELECT slug, name FROM layer ORDER BY sort_order;
```
Then update `SOURCE_TO_LAYER` and `OWASP_TO_LAYER` in `source-actions.ts` to match.

---

### BUG-C2 — `ai_safety` layer is inactive but all routing targets it
**Severity:** Critical  
**Pages:** `/admin/sources`, `/admin/layers`

**State:** The `mitre_atlas` source maps to `ai_safety` layer. All 5 OWASP LLM ref mappings (LLM01, LLM03, LLM04, LLM07, LLM10) also map to `ai_safety`. But `ai_safety` has `is_active = false` in the database.

**Impact:** Even if routing were working, all ATLAS and LLM threats would be routed to an inactive layer — excluded from guardrail generation, not counted in coverage denominator.

**Fix:** Either activate `ai_safety` layer at `/admin/layers` → find it → check "Active" → Save, OR remap OWASP refs to active layers after running Load Defaults.

---

### BUG-C3 — `/admin/threats/new` intermittently returns 404
**Severity:** High  
**Page:** `/admin/threats/new`

**Reproduction:** Open any threat detail page (compiles the `[id]` route), then navigate to `/admin/threats/new` → 404 "This page could not be found."

**Root cause:** Next.js dev-mode compilation race between `new/page.tsx` (static) and `[id]/page.tsx` (dynamic). When the `[id]` route is compiled first, "new" is routed to it, which calls `getThreatById("new")` → returns null → `notFound()`.

**Impact:** Admin cannot manually create threats after visiting any threat detail.

**Fix:** Likely requires adding an explicit `notFound()` guard in `[id]/page.tsx` that checks if the param looks like a UUID/CVE ID before querying. Probably not present in production builds.

---

### BUG-C4 — All pipeline trigger buttons in Sync are stubs (do nothing)
**Severity:** High  
**Page:** `/admin/sync`  
**File:** `apps/web/features/admin-sync/actions/sync-actions.ts`

**State:** `triggerAmplification`, `triggerSummarizeRules`, `triggerSummarizeLayers`, `triggerExportCatalog`, `triggerPublishCatalog` all return `{ ok: true, message: "...queued" }` but perform NO actual work — they only call `revalidatePath`.

**Impact:** The Pipeline Control Center buttons create a false sense of control. Clicking "Run Amplification" or "Summarize Rules" shows a success message but does nothing. Admins cannot trigger pipeline phases from the UI.

**Fix:** Wire each action to spawn the corresponding script via child_process, a job queue, or a GitHub Actions API dispatch call.

---

### BUG-C5 — `GET /v1/rules/:ruleSlug` — `layers` field corrupted
**Severity:** High  
**Endpoint:** `GET http://localhost:4000/v1/rules/:ruleSlug`  
**File:** `apps/api/src/routes/v1.ts`

**Reproduction:** `curl http://localhost:4000/v1/rules/nextjs-security-patterns-v1 | jq .layers`  
**Result:** `["[object Object]"]` instead of actual layer objects.

**Root cause:** Route JSON schema declares `layers` as `type: "array", items: {type: "string"}`. But `getRuleBySlug()` returns full `LayerSummary[]` objects. Fastify's fast-json-stringify coerces objects to strings.

**Fix:** Change route schema to accept objects, or map layer rows to slugs before returning.

---

### BUG-C6 — API write endpoints have no authentication
**Severity:** High  
**File:** `apps/api/src/routes/v1.ts`

**Unauthenticated endpoints:**
- `POST /v1/layers/:slug/threats` — adds any threat to any layer
- `DELETE /v1/layers/:slug/threats/:threatId` — removes threat-layer assignments
- `POST /v1/summarize` — triggers LLM inference (cost)
- `POST /v1/guardrails/generate` — writes to DB + triggers LLM (cost)
- `POST /v1/guardrails/generate-bulk` — bulk LLM generation (high cost)
- `POST /v1/composer/export` — no auth

**Impact:** Anyone with network access to port 4000 can modify data and incur LLM costs.

---

## HIGH SEVERITY BUGS

### BUG-H1 — Guardrails generate form submits on dropdown change, not button
**Severity:** High  
**Page:** `/admin/guardrails`

**Reproduction:** Navigate to `/admin/guardrails`, click the Stack dropdown, select any option → form submits immediately (triggers `generateGuardrailAction`) without clicking the Generate button.

**Root cause:** The stack `<select name="stackSlug">` is directly inside `<form action={generateGuardrailAction}>`. Browser fires form submission on `change` event. No `event.preventDefault()` or explicit button-only submission guard.

**Impact:** Admin accidentally triggers guardrail generation whenever they browse the stack dropdown.

**Fix:** Add `<input type="hidden" name="submitted" value="1">` check in action, or move the select outside the form and use a controlled React state approach.

---

### BUG-H2 — `aiAmplification` still JSON.stringified in 3 files (schema v2 violation)
**Severity:** High  
**Files:**
- `apps/web/lib/amplifier/pipeline.ts` line 337
- `apps/web/scripts/ingest-url-threat.ts` line 316
- `apps/web/app/api/admin/snapshot/route.ts` lines 264–267, 283–286

**Problem:** The schema v2 migration changed `ai_amplification` from `text` to `jsonb`. CLAUDE.md rule: "Never `JSON.stringify()`. Drizzle handles serialization." These files still call `JSON.stringify(amplificationObj)` before writing — this double-encodes the data as `"{\"patternLines\":...}"` (a JSON string inside a jsonb column) rather than a proper object.

**Impact:** Amplification data stored by these code paths will be corrupt/double-encoded in the DB. Phase 2 script (`amplify-threats.ts`) was fixed, but `ingest-url-threat.ts` and `snapshot/route.ts` are still broken.

**Fix:** Pass raw objects: `aiAmplification: { patternLines, ruleContext, generatedAt, model }` — not `JSON.stringify({...})`.

---

### BUG-H3 — `ADMIN_BYPASS` not honored in layer create/edit actions
**Severity:** Medium-High  
**Files:**
- `apps/web/app/(admin)/admin/layers/new/page.tsx` line 11
- `apps/web/app/(admin)/admin/layers/[id]/page.tsx` line 16

**Problem:** These inline server actions use `const session = await auth(); if (!session) redirect("/")` without checking `ADMIN_BYPASS` first. When running locally with `ADMIN_BYPASS=true` (no valid NextAuth session), layer create and edit silently redirect to `/` and fail.

**Impact:** Can't create or update layers in local dev without a valid auth session.

**Fix:** Add `if (ADMIN_BYPASS) { /* skip auth check */ }` at the top of both functions, matching the pattern in all other action files.

---

### BUG-H4 — API threat count mismatch: DB=520, API=533
**Severity:** Medium-High  
**File:** `apps/api/src/repos/threatsRepo.ts`

**Problem:** `listThreats()` merges DB data with a static `public/data/catalog.json` file containing 13 additional threats (future-dated CVEs like `CVE-2026-31431`). API consumers see 533 threats while the DB only has 520.

**Impact:** API data is inconsistent with DB. Future-dated CVEs (2026) are served as real threats. All 13 extra threats exist only in the static JSON — they have no `aiAmplification`, no layer assignments, no guardrails.

---

### BUG-H5 — Stale v1 schema references in test script
**Severity:** Medium  
**File:** `apps/web/scripts/test-admin-crud.ts` lines 409–414, 619–629

**References dropped columns:**
- `layer.publicId` (line 620, 623) — column dropped in schema v2
- `stackSubmission.onboardingProgress` (lines 409–414, 627–629) — JSONB column replaced by 6 typed boolean columns

**Impact:** Test script will fail with runtime errors when run. Not blocking production but misleading.

---

## MEDIUM SEVERITY BUGS

### BUG-M1 — Per-stack coverage bars show 1/1 instead of 1/6
**Page:** `/admin/guardrails/evaluation`  
**File:** `apps/web/lib/admin-queries.ts` — `getGuardrailCoverage()` `perStack` section

**Problem:** `totalLayers` per stack is derived from `rule_layer_map` joins — i.e., only layers covered by rules (which is 1 for each stack). Should use `allActiveLayersCount` (6). Every stack shows "1 of 1 layers covered" instead of "1 of 6."

---

### BUG-M2 — NestJS score override masks quality problems
**Database:** `summarized_guardrail` table

**State:** NestJS / Authentication & Session has `quality_score = 0`, `score_override = 8`, `conflict_count = 61`. The override was applied to a guardrail with 61 conflicts and a zero auto-computed score — inflating the reported average score.

**Recommendation:** Remove override or document rationale; re-run regen after conflict cleanup.

---

### BUG-M3 — Layer create form missing `isActive` toggle
**Page:** `/admin/layers/new`

**Problem:** New layers default to `isActive = false` (inactive), but the create form has no `isActive` field. Admins creating new layers won't realize they need to manually edit the layer afterward to activate it.

---

### BUG-M4 — 11 of 12 rules have strength_score = 0 despite having content
**Database / Rules**

**Problem:** Rules have substantial `body_mdx` content (1K–22K chars) and correct `line_count` values, yet `strength_score = 0`. Only `nextjs-security-patterns-v1` is correctly scored at 55.

**Fix:** Run Phase 3 (`npm run summarize:rules`) — this recomputes strength scores. The `computeStrengthScore` function in `rules-directory-showcase.ts` is correct; scores just haven't been recalculated since content was added.

---

### BUG-M5 — Zombie sync run from 2026-05-13 (4,828+ hours in "running")
**Page:** `/admin/sync`  
**Fix:** Click "Clear 1 zombie run" button on the sync page. The `clearZombieRuns()` action is implemented and working — just needs to be triggered.

---

## UX ISSUES

| # | Page | Issue | Severity |
|---|------|-------|----------|
| UX-1 | Sources | "Load recommended defaults" button placed outside/below the urgency banner instead of inside it — easy to miss | Medium |
| UX-2 | Sources | Silent failure of `loadDefaultSourceMappings()` — no toast, no error, page looks unchanged after click | Critical (ops) |
| UX-3 | Sync | Pipeline described as "6-phase" but UI shows 7 phase cards (Export + Publish separated) | Low |
| UX-4 | Sync | `phaseSummary` JSON displayed as raw text in sync log table — unreadable | Low |
| UX-5 | LLM | "Test connection" returns "Connected · 1229ms" when Bedrock is configured but falls back to Anthropic — doesn't disclose which provider was tested | Medium |
| UX-6 | LLM | Bedrock configured but `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are missing — pipeline will fail if triggered with Bedrock | High |
| UX-7 | Users | Only admin user has a "Demote" button with no confirmation dialog — accidental click locks out admin access | High |
| UX-8 | Rules | 11/12 rules at strength 0 with no inline explanation or fix path (no tooltip, no "run summarize" affordance) | Medium |
| UX-9 | Threats | `aiAmplification` textarea shows raw JSON without validation — no visual indicator of valid/invalid JSON | Low |
| UX-10 | Eval | "Coverage by stack" mini-bars show 1/1 (100%) instead of 1/6 (17%) per stack — misleadingly implies complete coverage | Medium |
| UX-11 | Patterns | Empty state has no explanation of what policy patterns are or how to create them | Low |

---

## DATABASE HEALTH

### Schema v2 Migration: ✅ Applied Correctly
All v2 changes verified in DB:
- `threat.ai_amplification` → `jsonb` ✅
- `layer.public_id` → removed ✅
- `threat.details` → removed ✅
- `rule.complexity` → removed ✅
- `rule_severity_tag` → removed ✅
- `stack_submission.onboarding_progress` → removed ✅
- `stack_submission.step_stack_created` through `step_published` → 6 typed boolean columns ✅

### Indexes: ✅ All 21 Added (Minor Duplicate Issue)
All 13 new indexes from the schema v2 migration are confirmed in DB. Minor issue: `threat_layer` has duplicate indexes — `idx_threat_layer_threat` + `threat_layer_threat_id_idx` both index `threat_id`. Same for `layer_id`. Two equivalent unique constraints on `(threat_id, layer_id)`. Low priority cleanup.

### Data Health Summary

| Metric | Value | Health |
|--------|-------|--------|
| Total threats | 520 | ✅ |
| Amplified threats | 504 (97%) | ✅ |
| Unamplified | 16 | ⚠ |
| Threats with layer assignments | 1 (0.2%) | 🔴 |
| Source mappings configured | 1 of 7 | 🔴 |
| OWASP mappings configured | 5 (LLM only, to inactive layer) | 🔴 |
| Active layers | 6 of 15 | ⚠ |
| Layers with rules | 1 of 6 active | 🔴 |
| Guardrail coverage | 6/66 (9%) | 🔴 |
| Rules at strength 0 | 11 of 12 | 🔴 |
| Avg guardrail quality | 7.0/10 (6 guardrails only) | ⚠ |
| Conflict-free guardrails | 2/6 (33%) | 🔴 |
| Zombie sync runs | 1 | ⚠ |

---

## API LAYER AUDIT

### Server Status
- Fastify API: `http://localhost:4000` (not auto-started with dev server — must be started separately)
- Next.js: `http://localhost:3000` (admin + API routes)

### Endpoint Health

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /v1/health` | ✅ 200 | OK |
| `GET /v1/stacks` | ✅ 200 | 11 stacks — matches DB |
| `GET /v1/stacks/:slug` | ✅ 200/404 | securityGrade always null |
| `GET /v1/stacks/:slug/overview` | ✅ 200 | coverageAreas=[] (table dropped) |
| `GET /v1/threats` | ⚠ 200 | Returns 533 (DB has 520, +13 from static JSON overlay) |
| `GET /v1/rules` | ✅ 200 | 12 rules |
| `GET /v1/rules/:slug` | 🔴 200 | layers field returns `["[object Object]"]` |
| `GET /v1/layers` | ✅ 200 | 6 active only (correct) |
| `GET /v1/layers/:slug/threats` | ⚠ 200 | Only auth_session has threats (1); all others empty |
| `POST /v1/layers/:slug/threats` | 🔴 204 | No authentication |
| `DELETE /v1/layers/:slug/threats/:threatId` | 🔴 204 | No authentication |
| `POST /v1/summarize` | ⚠ 200/500 | Missing layerSlugs returns 500 not 400 |
| `POST /v1/guardrails/generate` | 🔴 200 | No authentication, writes to DB |
| `POST /v1/guardrails/generate-bulk` | 🔴 200 | No authentication, triggers bulk LLM |
| `GET /v1/llm-config` | ⚠ 401 | ADMIN_API_TOKEN not set → always 401 |
| `GET /docs` | ✅ 200 | Swagger UI accessible |

---

## SERVER ACTIONS AUDIT

### Completeness
| Module | Functions | Gaps |
|--------|-----------|------|
| admin-guardrails | scoreAndRegenerate | No deleteGuardrail action (inline only) |
| admin-llm | saveLLMConfig, saveTaskConfigs | ✅ |
| admin-rules | updateRule, setCertified, assignRuleLayers, assignRuleStacks | No createRule, no deleteRule |
| admin-sources | upsertSourceMapping, deleteSourceMapping, toggleActive, updateOwaspMapping, toggleOwaspActive, reAssignAllThreatLayers, loadDefaultSourceMappings | ✅ (but loadDefaults silently fails — BUG-C1) |
| admin-stacks | createStack, updateStack, deleteStack | ✅ |
| admin-submissions | startReview, approveAndOnboard, rejectSubmission, updateReviewNotes, updateOnboardingStep | ✅ (v2 typed columns correctly used) |
| admin-sync | triggerSync, triggerAmplification, triggerSummarizeRules, triggerSummarizeLayers, triggerExportCatalog, triggerPublishCatalog, clearZombieRuns | All triggers are stubs except clearZombieRuns |
| admin-threats | createThreat, updateThreat, assignThreatStacks, assignThreatLayers | No deleteThreat |
| admin-users | updateUserRole | ✅ |

### CLAUDE.md Violations
1. **`JSON.stringify(aiAmplification)`** — 3 files (BUG-H2 above)
2. **`layer.publicId` in test script** — column dropped in v2 (BUG-H5 above)
3. **`ADMIN_BYPASS` not honored** in layer create/edit inline actions (BUG-H3 above)

### Error Handling
- **Zero try/catch blocks** across all 9 action files
- `createThreat` / `createStack` — no guard on unique constraint violations (will throw raw DB error on duplicate slug)
- `scoreAndRegenerate` — calls 3 pipeline stages sequentially; any stage failure throws uncaught to client
- `approveAndOnboard` — partial failure risk: stack insert succeeds then submission update fails = orphaned stack

---

## RECOMMENDED ACTION ORDER

### Immediate (Unblocks All 4 Objectives)

1. **Fix `loadDefaultSourceMappings()` slug mismatch** (BUG-C1)
   - Query actual layer slugs from DB
   - Update `SOURCE_TO_LAYER` and `OWASP_TO_LAYER` constants in `source-actions.ts`
   - Test by clicking "Load recommended defaults" and verifying mappings appear

2. **Activate `ai_safety` layer** (BUG-C2)
   - Go to `/admin/layers` → find AI & LLM Safety → check "Active" → Save

3. **Clear zombie sync run** (BUG-M5)
   - Go to `/admin/sync` → click "Clear 1 zombie run"

4. **Run Phase 3 — Summarize Rules** (BUG-M4)
   - `npx tsx apps/web/scripts/summarize-rules.ts`
   - Raises 11 rules from strength 0 to correct values

5. **After steps 1-4: Run Phase 4 — Summarize Layers**
   - `npx tsx apps/web/scripts/summarize-layers.ts`
   - Generates guardrails for the other 60 missing stack×layer pairs

### Short-term (Code Fixes)

6. **Fix `loadDefaultSourceMappings()` to use correct slugs** — verify after step 1
7. **Fix `JSON.stringify(aiAmplification)`** in `amplifier/pipeline.ts`, `ingest-url-threat.ts`, `snapshot/route.ts`
8. **Fix guardrails generate form** — don't submit on dropdown change (BUG-H1)
9. **Fix per-stack coverage bars** denominator bug in eval page (BUG-M1)
10. **Fix `/admin/threats/new` 404** — add route guard in `[id]/page.tsx` (BUG-C3)
11. **Fix `ADMIN_BYPASS`** in layer actions (BUG-H3)
12. **Add API authentication** to write endpoints (BUG-C6)
13. **Fix `GET /v1/rules/:slug`** layers serialization (BUG-C5)
14. **Wire pipeline trigger actions** to actual script dispatch (BUG-C4)
15. **Fix `test-admin-crud.ts`** stale schema references (BUG-H5)

### Operational

16. **Switch LLM provider to Anthropic** (Bedrock creds missing) — go to `/admin/llm` → "Switch to Anthropic API →"
17. **Remove NestJS score override** (or document rationale) — go to `/admin/guardrails` → NestJS row → detail → clear override
18. **Add confirmation dialog** on Users page "Demote" button for self-user
19. **Add `isActive` toggle** to layer create form (BUG-M3)
20. **Remove static catalog.json overlay** from `threatsRepo.ts` (BUG-H4)

---

## Files Requiring Changes

| File | Issue | Priority |
|------|-------|----------|
| `apps/web/features/admin-sources/actions/source-actions.ts` | BUG-C1: Fix slug constants in OWASP_TO_LAYER and SOURCE_TO_LAYER | P0 |
| `apps/web/lib/amplifier/pipeline.ts` | BUG-H2: Remove JSON.stringify on aiAmplification | P1 |
| `apps/web/scripts/ingest-url-threat.ts` | BUG-H2: Remove JSON.stringify | P1 |
| `apps/web/app/api/admin/snapshot/route.ts` | BUG-H2: Remove JSON.stringify, fix type guard | P1 |
| `apps/web/app/(admin)/admin/guardrails/page.tsx` | BUG-H1: Fix generate form dropdown-triggers-submit | P1 |
| `apps/web/lib/admin-queries.ts` | BUG-M1: Fix perStack.totalLayers denominator | P2 |
| `apps/web/app/(admin)/admin/layers/new/page.tsx` | BUG-H3: Add ADMIN_BYPASS guard; add isActive field | P2 |
| `apps/web/app/(admin)/admin/layers/[id]/page.tsx` | BUG-H3: Add ADMIN_BYPASS guard | P2 |
| `apps/web/app/(admin)/admin/threats/[id]/page.tsx` | BUG-C3: Add guard to prevent "new" matching [id] | P2 |
| `apps/web/features/admin-sync/actions/sync-actions.ts` | BUG-C4: Wire stub triggers to actual script dispatch | P2 |
| `apps/api/src/routes/v1.ts` | BUG-C6: Add auth to write endpoints; BUG-C5: Fix layers serialization | P2 |
| `apps/api/src/repos/threatsRepo.ts` | BUG-H4: Remove static catalog.json overlay | P3 |
| `apps/web/scripts/test-admin-crud.ts` | BUG-H5: Remove stale schema references | P3 |
