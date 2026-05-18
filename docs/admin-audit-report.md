# Aigent.ly Admin Panel — Audit Report

**Date:** 2026-05-17
**Auditor:** Playwright MCP automated walkthrough (Claude Code)
**Base URL:** http://localhost:3000/admin
**Objective:** Verify all admin pages support the core workflow — threats amplified → summarized → scored → evaluated

---

## Executive Summary

### Core Objective Coverage

| Objective | Current State | Coverage | Severity |
|-----------|--------------|----------|----------|
| Threats Amplified | No visibility into which of 520 threats have `aiAmplification` populated | Unknown / 0% visible | CRITICAL |
| Threats Summarized | 5 of 165 stack×layer pairs have guardrails | 3% | CRITICAL |
| Threats Scored | Avg quality score 1.6/10; 3 of 5 guardrails at 0/10 | 20% passing | CRITICAL |
| Evals Passing | 168 max conflicts on a single guardrail; 0% of threats assigned to layers via pipeline | 0% automated | CRITICAL |

All four core objectives are critically under-served by the current admin UI.

---

### Critical Issues (blocking core objectives)

| # | Issue | Page | Impact |
|---|-------|------|--------|
| C1 | Guardrail coverage is 3%, not 83% — evaluation page misleads | Guardrail Eval | Objectives 2, 3, 4 |
| C2 | 519/520 threats have 0 layer assignments — source routing unconfigured | Source Routing | Objectives 1, 2, 4 |
| C3 | Avg guardrail quality 1.6/10; no alert on dashboard | Guardrails, Dashboard | Objective 3 |
| C4 | No "Threats Amplified" status column or KPI anywhere | Threats, Dashboard | Objective 1 |
| C5 | React hydration error (`<a>` inside `<a>`) on every page | All pages | Production stability |

### High Priority Gaps

| # | Gap | Page | Impact |
|---|-----|------|--------|
| H1 | No rule creation UI | Rules | Cannot expand rule catalog |
| H2 | Sync coverage stuck at 7% for 9 consecutive runs; zombie "running" job from 5/13 | Sync Logs | Objectives 1, 4 |
| H3 | 11 of 12 rules have strength score 0 | Rules | Objectives 2, 3 |
| H4 | 8 of 15 layers inactive; no bulk-activate path | Layers | Objectives 2, 4 |
| H5 | Source routing has zero OWASP ref → layer mappings | Source Routing | Objective 4 |

### Quick Wins

| # | Win | Page | Effort |
|---|-----|------|--------|
| QW1 | Add `aiAmplification` boolean column to Threats list | Threats | Low |
| QW2 | Fix nested `<a>` in sidebar logo — wrap in `<span>` instead | Layout | Low |
| QW3 | Add severity filter dropdown to Threats list | Threats | Low |
| QW4 | Add `securityGrade` column to Stacks table | Stacks | Low |
| QW5 | Fix dashboard KPIs to show guardrail coverage % and amplification % | Dashboard | Medium |
| QW6 | Add `expiresAt` column to Guardrails list | Guardrails | Low |
| QW7 | Flag zombie sync run (stuck "running" from 5/13) with timeout mechanism | Sync Logs | Low |

---

## Page-by-Page Findings

---

### 1. Dashboard — `/admin`

#### Observed State
- 4 health cards: **11 Stacks**, **12 Rules**, **520 Threats**, **0 Pending submissions**
- All cards show "0% increase" (static — no trend calculation)
- Pending submissions panel shows "No pending submissions."

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |

#### Console Errors
- `<a> cannot be a descendant of <a>` — sidebar logo link wraps a nested `<a>` tag
- `Hydration failed` — caused by the nested `<a>` DOM violation (persists on **every page**)

#### Misalignments with Core Objectives
- Zero representation of any of the 4 core objectives on the dashboard
- No KPI for: threats amplified %, guardrail coverage %, avg eval score, conflicts-clean %
- "0% increase" trend deltas are static placeholders — no real trend data

#### Proposed Upgrades
1. **Add 4 core objective KPI cards:** Threats Amplified (% with aiAmplification), Guardrail Coverage (N/165), Avg Eval Score, Conflict-Free Guardrails %
2. **Remove "0% increase" trend display** until real time-series data is available
3. **Fix nested `<a>` hydration error** in sidebar logo component — replace inner logo `<a>` with a `<span>` or `<div>`

---

### 2. Stacks — `/admin/stacks`

#### Observed State
11 stacks. 5 stacks have 0 rules (Django, Rails, Go, iOS/Swift, Android/Kotlin). All stacks are in "Launch" catalog status.

| Stack | Rules | Threats |
|-------|-------|---------|
| Next.js | 2 | 81 |
| Express/Node.js | 2 | 44 |
| FastAPI/Python | 2 | 18 |
| NestJS | 2 | 26 |
| Nuxt | 2 | 31 |
| React SPA | 2 | 37 |
| Django | 0 | 203 |
| Ruby on Rails | 0 | 111 |
| Go | 0 | 38 |
| iOS/Swift | 0 | 1 |
| Android/Kotlin | 0 | 3 |

#### Actions Tested
| Action | Result |
|--------|--------|
| Search "next" | Pass — returns Next.js only |
| Navigate to /admin/stacks/new | Pass |
| View first stack (Next.js) | Pass |

#### Console Errors
Persistent hydration error (nested `<a>`)

#### Misalignments with Core Objectives
- `securityGrade` field exists in the edit form but is not shown in the list — critical data hidden
- No guardrail coverage per stack visible
- 5 stacks with 0 rules are "Launch" status — they have threats but no guardrails possible

#### Proposed Upgrades
1. **Add `securityGrade` column** to the stacks table
2. **Add guardrail coverage column** (e.g. "2/15 layers covered")
3. **Add visual warning indicator** for stacks with 0 rules that are in "Launch" status
4. **Add threat amplification % per stack** (how many of N threats are amplified)

---

### 3. Stack Detail — `/admin/stacks/[id]`

#### Observed State
Edit form: Name, Slug, Ecosystem, Catalog Status, Security Grade, Sort Order. Save + Delete buttons.

#### Actions Tested
| Action | Result |
|--------|--------|
| Form render | Pass |
| Nested form detection | Fail — `<form>` nested inside `<form>` (Save wraps Delete) |

#### Console Errors
- Persistent hydration error
- **Additional error:** `<form> cannot contain a nested <form>` — the Delete Stack form is nested inside the main Save Changes form

#### Misalignments with Core Objectives
- No links to this stack's threats, rules, or guardrails
- `securityGrade` field is empty on Next.js (flagship stack)

#### Proposed Upgrades
1. **Fix nested `<form>` bug** — move Delete action to a separate `<form>` element outside the Save form
2. **Add related data panel:** linked rules count, linked threats count, guardrail coverage, direct links to filter Guardrails page by this stack
3. **Add shortcut:** "Generate all guardrails for this stack" button

---

### 4. Submissions — `/admin/submissions`

#### Observed State
0 submissions. Table shows "No submissions found." Status filter dropdown present with all 6 statuses.

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Status filter (all values) | Pass — UI works but no data |

#### Console Errors
Persistent hydration error

#### Misalignments with Core Objectives
None — page is structurally complete. No data to test workflows.

#### Proposed Upgrades
1. No changes needed — page is well-designed and ready

---

### 5. Threats — `/admin/threats`

#### Observed State
520 threats, paginated 25/page (21 pages). Mix of GHSA, OSV, NVD sources. First page shows critical and high severity threats. Vast majority show 0 layers assigned.

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Text search "CVE" | Pass (filtered to CVE-prefixed IDs) |
| Navigate to /admin/threats/new | Pass |
| Navigate to first threat detail | Pass |

#### Console Errors
- Persistent hydration error
- Image aspect ratio warning: logo-icon.svg has modified width but not height

#### Misalignments with Core Objectives
- **Objective 1 (Amplified):** No `aiAmplification` status column — impossible to see which of 520 threats have been AI-enriched
- **Objective 4 (Evals):** No `isActivelyExploited` flag in the list view
- No severity filter dropdown — only text search available
- No layer assignment status in list (0 layers is the norm but no visual indicator)

#### Proposed Upgrades
1. **Add "Amplified" boolean column** (✓ / ✗) to the threats table
2. **Add severity filter dropdown** (Critical / High / Medium / Low / Info) alongside text search
3. **Add "Actively Exploited" badge** for threats with `isActivelyExploited = true`
4. **Add "Layers" count column** showing how many layers each threat is assigned to, with 0 highlighted as a warning
5. **Add bulk actions:** "Amplify selected", "Assign selected to layer"

---

### 6. Threat Create — `/admin/threats/new`

#### Observed State
Well-structured form: Identity (publicId, cveId, source, family), Details (name, severity, sourceUrl, description, AI Amplification Narrative, activelyExploited), Attack Vector (OWASP checkboxes A01–A10 + LLM01–LLM10), Layer Assignment (15 layer checkboxes).

#### Actions Tested
| Action | Result |
|--------|--------|
| Form render — all sections | Pass |
| All fields interactive | Pass |

#### Misalignments with Core Objectives
- `aiAmplification` field is a free-text textarea — for manually-created threats this is fine, but there's no "Generate with AI" button next to it

#### Proposed Upgrades
1. **Add "Generate with AI" button** next to the AI Amplification Narrative field that calls the amplification service for auto-population

---

### 7. Threat Detail — `/admin/threats/[id]`

#### Observed State (CVE-2022-23541 — jsonwebtoken)
3 tabs: Details, Layers (0), Stacks (3). `aiAmplification` textarea is populated with raw JSON. Layers tab shows all 15 layer checkboxes, all unchecked for this threat. Stacks tab shows 11 stacks with per-stack severity dropdowns; 3 stacks pre-checked.

#### Actions Tested
| Action | Result |
|--------|--------|
| Details tab | Pass |
| Layers tab | Pass — 15 layer checkboxes rendered |
| Stacks tab | Pass — per-stack severity dropdowns rendered |

#### Console Errors
Persistent hydration error

#### Misalignments with Core Objectives
- **Objective 1:** `aiAmplification` stored as raw JSON string — unreadable and error-prone to edit manually
- **Objective 4:** This threat has OWASP A07 but 0 layers assigned — OWASP-to-layer routing is not working (confirming the source routing gap)
- No "Trigger Amplification" button

#### Proposed Upgrades
1. **Parse and render `aiAmplification` as structured fields** (attack_description, affected_code_patterns, exploitation_scenario, remediation_notes) instead of a raw JSON textarea
2. **Add "Re-amplify with AI" button** on the detail page
3. **Auto-suggest layers** based on OWASP refs — show which layers the OWASP refs map to and pre-check them
4. **Add "Save & Assign Layers" one-click action** when OWASP refs are set

---

### 8. Layers — `/admin/layers`

#### Observed State
15 layers total. Only 2 have any threats (Auth & Session: 1, and 1 other). 8 layers are inactive. 13 layers have 0 threats.

| Layer | Rules | Threats | Status |
|-------|-------|---------|--------|
| Authentication & Session | 10 | 1 | system |
| Authorization & Access Control | 0 | 0 | system |
| Input Validation & Sanitization | 0 | 0 | system |
| Secrets Management | 0 | 0 | system |
| Error Handling & Logging | 0 | 0 | system |
| Supply Chain & Deps | 0 | 0 | system |
| API Security | 0 | 0 | inactive |
| Database | 0 | 0 | inactive |
| Infrastructure | 0 | 0 | inactive |
| Caching | 0 | 0 | inactive |
| Frontend Security | 0 | 0 | inactive |
| Observability | 0 | 0 | inactive |
| Resilience | 0 | 0 | inactive |
| AI Safety | 0 | 0 | inactive |
| Code Quality | 0 | 0 | inactive |

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Navigate to /admin/layers/new | Pass |
| View layer detail (Auth & Session) | Pass |

#### Misalignments with Core Objectives
- 8 inactive layers have no threats or rules — Objectives 2 and 4 cannot be met for 53% of layers
- 13/15 layers have 0 threats — the threat-layer assignment pipeline is completely broken (source routing)
- No path to bulk-activate layers or bulk-assign threats to multiple layers

#### Proposed Upgrades
1. **Add bulk-activate UI** for inactive layers (checkbox selection + "Activate selected" action)
2. **Add threat assignment status** per layer row (e.g. "0/520 threats assigned — configure source routing")
3. **Add shortcut to source routing** with "Configure threat routing for this layer" link from each layer row
4. **Add guardrail coverage** column per layer (e.g. "0/11 stacks covered")

---

### 9. Rules — `/admin/rules`

#### Observed State
12 rules total. 11 have strength score 0. Only Next.js security patterns has score 55. No rule creation UI.

| Rule | Strength |
|------|----------|
| Next.js security patterns | 55 |
| All others | 0 |

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Search "auth" | Pass |
| Pagination | Pass |
| View Next.js rule detail | Pass |

#### Misalignments with Core Objectives
- **Objective 2:** Guardrails generated from 0-strength rules will have a weak foundation
- No rule creation button — cannot expand the catalog
- 5 stacks (Django, Rails, Go, iOS, Android) have zero rules across the entire catalog

#### Proposed Upgrades
1. **Add "New Rule" button** to the rules list page
2. **Investigate why 11 rules have strength 0** — the scoring formula gives 10 baseline + lineCount contribution; 0 likely means rules have empty bodies
3. **Add "Regenerate AI Summary" button** per rule on detail page
4. **Add bulk-strength-recalculate** action to update scores after rule bodies are populated

---

### 10. Guardrails — `/admin/guardrails`

#### Observed State
5 guardrails out of 165 possible (3% coverage). All 5 are for Authentication & Session layer only. 3 of 5 have score 0/10. Conflict counts: 168 (Express), 61 (Nuxt), 61 (NestJS), 28 (FastAPI), 0 (Next.js).

| Stack | Layer | Score | Conflicts |
|-------|-------|-------|-----------|
| Next.js | Auth & Session | 4/5 stars (8/10) | 0 |
| NestJS | Auth & Session | 4/5 stars (8/10) | 61 |
| Nuxt | Auth & Session | 0/5 stars (0/10) | 61 |
| FastAPI/Python | Auth & Session | 0/5 stars (0/10) | 28 |
| Express/Node.js | Auth & Session | 0/5 stars (0/10) | 168 |

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Regen button (Next.js row) | Pass — "Guardrail regenerated" toast |
| Bulk Generate panel open | Pass — shows Fill empty / Refresh stale / Regenerate all options |
| Navigate to guardrail detail | Pass |
| Score override form render | Pass (spinbutton 0–10 + note textarea) |

#### Misalignments with Core Objectives
- **Objective 2:** 97% of stack×layer pairs have no guardrail
- **Objective 3:** Average score 1.6/10; 60% of guardrails score 0
- **Objective 4:** Express has 168 conflicts — rule set needs deduplication before this can pass
- No `expiresAt` column — cannot identify stale guardrails at a glance
- No `summarizerVersion` column — cannot identify guardrails that need regeneration after algorithm upgrade
- No "View Threats Covered" link per guardrail

#### Proposed Upgrades
1. **Add coverage progress bar** at top: "5/165 pairs covered" with a visual fill indicator
2. **Add `expiresAt` column** showing cache expiry date (highlight red if expired)
3. **Add `summarizerVersion` column** (highlight if not on current version)
4. **Add conflict count column** (already visible in subtitle — promote to dedicated sortable column)
5. **Add score alert:** highlight rows with score < 5/10 in amber, score = 0 in red
6. **Add "Threats Covered" count** per guardrail row
7. **Link to "Bulk Generate"** prominently from coverage gap metric

---

### 11. Guardrail Detail — `/admin/guardrails/[id]`

#### Observed State
Shows full MDX content, score (8/10 = 4/5 stars), source rule IDs, conflict count (0 for Next.js). Score override form: spinbutton 0–10 + note + "Re-score & Regenerate" button. Copy button for content.

#### Actions Tested
| Action | Result |
|--------|--------|
| Score override form render | Pass |
| Copy button | Not tested (no clipboard access in audit) |

#### Misalignments with Core Objectives
- No `expiresAt` / freshness indicator
- No `summarizerVersion` shown
- "Re-score & Regenerate" is a combined action — no way to save score override without triggering a full regeneration

#### Proposed Upgrades
1. **Separate "Save Score Override" from "Regenerate"** — allow admin to save a score note without triggering LLM regeneration
2. **Add `expiresAt` and `summarizerVersion`** to the metadata section
3. **Add `provenance` viewer** — expandable section showing per-atom resolution (kept/merged/conflict_resolved/deduplicated)

---

### 12. Guardrail Evaluation — `/admin/guardrails/evaluation`

#### Observed State
Coverage metric shows 83% (5/6 pairs) but this denominator is only the 6 stack-layer pairs where at least one threat exists — not the full 165. True coverage is 3%. Avg quality score 1.6/10. Conflict-free: 20% (1/5). React SPA / Auth & Session is the only uncovered pair surfaced.

| Stack | Covered | Score | Conflicts |
|-------|---------|-------|-----------|
| Next.js | Yes | 8/10 | 0 |
| Express/Node.js | Yes | 0/10 | 168 |
| FastAPI/Python | Yes | 0/10 | 28 |
| NestJS | Yes | 8/10 (override ✎) | 61 |
| Nuxt | Yes | 0/10 | 61 |
| React SPA | **No** | — | — |

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Quality matrix render | Pass |
| "Generate →" link for React SPA | Present (not clicked) |

#### Misalignments with Core Objectives
- **Objective 2:** 83% metric is misleading — true coverage is 3%
- **Objective 3:** Avg 1.6/10 is a failing score with no alert/warning prominence
- **Objective 4:** No `summarizerVersion` column — cannot track algorithm version across guardrails
- Evaluation is limited to one layer — no way to see cross-layer coverage

#### Proposed Upgrades
1. **Fix coverage denominator** — compute against all 11 stacks × 15 layers = 165 pairs, not just pairs with existing threats
2. **Add stack × layer matrix view** — full 11×15 grid showing coverage at a glance (green = covered, yellow = stale, red = missing)
3. **Add `summarizerVersion` column** in quality matrix
4. **Add score distribution histogram** (bar chart: count of guardrails at each score tier 0-2, 3-5, 6-8, 9-10)
5. **Surface "Avg 1.6/10" as a prominent alert** — this should be a red warning card, not a quiet metric

---

### 13. LLM Config — `/admin/llm`

#### Observed State
Provider: AWS Bedrock (selected). All credentials detected (ANTHROPIC_API_KEY, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN). Default model: claude-sonnet-4-6. Per-task overrides: all tasks using claude-sonnet-4-6. Connectivity: **Connected • 887ms**.

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Test connection | Pass — "Connected • 887ms" |
| Form render (provider, model, task overrides) | Pass |

#### Console Errors
Persistent hydration error only

#### Misalignments with Core Objectives
None — this page is fully functional and well-designed.

#### Proposed Upgrades
1. **Add model-selection guidance** — tooltip or helper text explaining which model tier to use for which task (e.g., "Use Opus for amplification for highest quality; Sonnet for summarization for cost/speed")
2. **Add per-task "last run" timestamp** — when was each task type last executed?

---

### 14. Source Routing — `/admin/sources`

#### Observed State
All 7 sources present (nvd, osv, ghsa, cisa_kev, aigently, mitre_atlas, aigently_internal). **All 7 sources have "No layer mappings configured."** OWASP ref → layer routing section also appears empty. "Re-assign All Threat Layers" button is present at top.

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| All 7 sources rendered | Pass |
| "Re-assign All Threat Layers" button present | Pass (NOT clicked) |

#### Console Errors
Persistent hydration error

#### Misalignments with Core Objectives
- **This is the root cause of C2:** Zero source-layer mappings = zero automated layer assignment = 519/520 threats with 0 layers
- Without these mappings, the sync pipeline assigns threats to no layers, making guardrail generation impossible for most pairs
- **Objective 4 (Evals Passing):** Cannot pass if threats are not assigned to layers

#### Proposed Upgrades
1. **Add urgency banner:** "⚠️ No source-layer mappings configured. Threat layer assignment is disabled." with direct link to add mappings
2. **Add recommended default mappings** based on threat family — pre-populate NVD/GHSA/OSV → relevant layers based on OWASP family
3. **Add OWASP ref → layer default mappings** (e.g., A01-A03 → Auth, A07-A09 → API Security, LLM01-LLM10 → AI Safety)
4. **Add a "Preview" before Re-assign All** showing how many threats would move to which layers
5. **Add per-source threat count** showing how many threats come from each source (e.g. "nvd: 203 threats")

---

### 15. Sync Logs — `/admin/sync`

#### Observed State
SnapshotPanel: Download/Import snapshot buttons. 9 sync runs, all at 7% coverage (success). One run from 5/13 shows status "running" (zombie — 4 days old).

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Trigger Sync button present | Pass (NOT clicked) |

#### Console Errors
Persistent hydration error

#### Misalignments with Core Objectives
- **Objective 1:** No per-source breakdown of how many threats were ingested/updated per sync
- AI amplification pipeline status is not tracked in sync logs
- 7% coverage across all 9 runs suggests a systemic issue with the sync (possibly hitting the same data subset every time)
- Zombie "running" job from 5/13 needs auto-timeout

#### Proposed Upgrades
1. **Add per-source breakdown** to each sync run row (nvd: +N, ghsa: +M, etc.)
2. **Add AI amplification phase tracking** to sync logs (phase: threats_synced → amplification_ran → layers_assigned)
3. **Add auto-timeout** for sync runs stuck in "running" for > 30 minutes
4. **Add coverage trend sparkline** — visualize 7% flat line to make the stagnation visible
5. **Investigate why coverage is consistently 7%** — likely the sync is hitting a size limit or pagination issue

---

### 16. Users — `/admin/users`

#### Observed State
1 registered user: abdulrhman.elbuni@gmail.com (admin). Only action available is "Demote".

#### Actions Tested
| Action | Result |
|--------|--------|
| Page load | Pass |
| Search | Pass |

#### Console Errors
Persistent hydration error

#### Misalignments with Core Objectives
None — users page is not in the critical path for core objectives.

#### Proposed Upgrades
1. **Add "Invite User" / "Add User"** functionality
2. **Add last-login timestamp** column
3. **Add role assignment dropdown** instead of binary "Demote" button

---

## Technical Debt Summary

| Issue | File Area | Priority |
|-------|-----------|----------|
| `<a>` nested inside `<a>` — hydration error on every page | `components/nextadmin/admin-shell.tsx` or sidebar layout | HIGH |
| `<form>` nested inside `<form>` on stack detail | `app/(admin)/admin/stacks/[id]/page.tsx` | HIGH |
| Coverage denominator wrong in Guardrail Eval | `app/(admin)/admin/guardrails/evaluation/page.tsx` | HIGH |
| `aiAmplification` stored as raw JSON string in textarea | `features/admin-threats/` | MEDIUM |
| No severity filter dropdown on threats list | `app/(admin)/admin/threats/page.tsx` | MEDIUM |
| No rule creation UI | `app/(admin)/admin/rules/page.tsx` | MEDIUM |
| Sync coverage stuck at 7% | `apps/api/src/services/` sync pipeline | HIGH |
| Zombie sync run (5/13 "running") | `packages/db` sync_log table | MEDIUM |

---

## Recommended Action Order

1. **Configure source routing** (Source Routing page) — add layer mappings for all 7 sources + OWASP refs. This unblocks all 4 core objectives.
2. **Fix hydration errors** — nested `<a>` and nested `<form>` cause subtle rendering bugs in production.
3. **Fix sync coverage** — investigate why all runs return 7%; check for pagination limits in sync scripts.
4. **Bulk generate guardrails** — after source routing is configured and threats are assigned to layers, use Bulk Generate (Fill empty) to cover all 165 pairs.
5. **Investigate high conflict counts** — Express/Node.js at 168 conflicts; review rule body deduplication logic.
6. **Dashboard KPI upgrades** — add the 4 core objective metrics to the overview page.
7. **Threats list: add amplification column + severity filter** — quick wins for day-to-day admin operations.
