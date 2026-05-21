# Launch Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0 and P1 launch blockers plus key P2 issues so Aigent.ly can go live today.

**Architecture:** Direct file edits across the Next.js monorepo — server components, query functions, and admin config. No new tables, no migrations. The LLM provider switch is a UI action (not code). Guardrail generation is an admin pipeline trigger (not code).

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM (PostgreSQL), Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `apps/web/components/layout/SiteHeader.tsx` | P1-1: fix GitHub href; P1-3: remove News from nav |
| `apps/web/components/layout/SiteFooter.tsx` | P1-2: replace dead links with real hrefs or remove |
| `apps/web/app/(marketing)/threats/page.tsx` | P1-4: change default sort to newest-first |
| `apps/web/lib/catalog-from-db.ts` | P1-4: change `asc(threat.publicId)` → `desc(threat.publishedAt)` in `listThreatsOnLaunchStacksFromDb`; also fix fake usage SQL |
| `apps/web/app/(marketing)/stacks/[stack]/page.tsx` | P1-5: fix Top Risks links to point to threat pages |
| `apps/web/lib/stack-overview-content.ts` | P1-5: add `cveId` / `publicId` to `RiskRow` type so links can be generated |
| `apps/web/lib/home-marketing-content.ts` | P2-1: fetch real counts dynamically or update stale "6/6" numbers |
| `apps/web/app/(marketing)/home/page.tsx` (or `app/page.tsx`) | P2-1: pass live counts to stat tiles |
| `apps/web/lib/rules-directory-showcase.ts` | PRD: remove fake `weeklyUses` hardcoded numbers; suppress the label |

---

## Non-Code Actions (do these FIRST, before any code)

### Action A: Switch LLM Provider (P0-1)
- [ ] Open http://localhost:3000/admin/llm
- [ ] Click **"Switch to Anthropic API →"** button
- [ ] Click **"Save provider"** button — confirm banner disappears

### Action B: Delete Test Threat (P0-2)
- [ ] Open http://localhost:3000/admin/threats
- [ ] Find **"Test Threat (Updated)"** (CVE-2021-3749)
- [ ] Click **View**, then delete it from the detail page

### Action C: Add aigently Source Mapping (P2-5)
- [ ] Open http://localhost:3000/admin/sources
- [ ] For the `aigently` source, add layer **Authentication & Session** (Primary)
- [ ] Save

### Action D: Assign Missing Rule Layers (P1-6)
- [ ] Open http://localhost:3000/admin/rules
- [ ] Click **View** on **"React SPA security patterns"** → go to Layers tab → assign **Authentication & Session** → Save
- [ ] Click **View** on **"Next.js security dependency alerts"** → go to Layers tab → assign **Authentication & Session** → Save

### Action E: Trigger Guardrail Generation (P0-4) — start this early, runs ~2 hours
- [ ] After Action A, open http://localhost:3000/admin/guardrails
- [ ] Click **Bulk Generate → "Fill empty"** (generates missing pairs for all active stacks × 8 layers)
- [ ] Monitor progress at http://localhost:3000/admin/guardrails/evaluation

---

## Task 1: Fix GitHub Header Link + Remove News from Nav (P1-1 + P1-3)

**Files:**
- Modify: `apps/web/components/layout/SiteHeader.tsx:7-15` (nav array)
- Modify: `apps/web/components/layout/SiteHeader.tsx:57-64` (GitHub link)

- [ ] **Step 1: Edit nav array — remove News**

In `apps/web/components/layout/SiteHeader.tsx`, change the `nav` constant at line 7:

```typescript
const nav = [
  { href: "/rules", label: "Rules" },
  { href: "/explore", label: "Explore" },
  { href: "/threats", label: "Threats" },
  { href: "/stacks", label: "Stacks" },
  { href: "/layers", label: "Layers" },
  { href: "/learn", label: "Learn" },
] as const;
```

(Remove `{ href: "/news", label: "News" }` — the page is empty and in main nav it signals "unfinished".)

- [ ] **Step 2: Fix GitHub href in desktop header (line ~59)**

Change:
```tsx
href="https://github.com/"
```
To:
```tsx
href="https://github.com/aelbuni/aigently-catalog"
```

Apply this to **both** instances — line ~59 (desktop) and line ~118 (mobile menu).

- [ ] **Step 3: Verify TypeScript compiles**
```bash
cd /Users/aelbuni/Projects/aelbuni/aigently-v1
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```
Expected: no output (zero errors).

- [ ] **Step 4: Commit**
```bash
git add apps/web/components/layout/SiteHeader.tsx
git commit -m "fix: remove empty News nav item, point GitHub link to catalog repo"
```

---

## Task 2: Fix Footer Dead Links (P1-2)

**Files:**
- Modify: `apps/web/components/layout/SiteFooter.tsx`

The simplest fix that doesn't require creating new pages: remove the dead items and keep only real links. "API Reference", "Status", "Network", "Privacy", "Security" have no backing pages — removing them is cleaner than stub pages.

- [ ] **Step 1: Rewrite SiteFooter to remove dead items**

Replace the full content of `apps/web/components/layout/SiteFooter.tsx` with:

```typescript
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-slate-800 bg-slate-950 py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <span className="mb-4 block font-bold text-indigo-500">Aigent.ly</span>
          <p className="font-mono text-[10px] uppercase leading-relaxed text-slate-500">
            © 2026 Aigent.ly Security. Technical Minimalism via DM Mono.
          </p>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">Resources</h4>
          <nav className="flex flex-col gap-2">
            <Link
              href="/learn"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Documentation
            </Link>
            <Link
              href="/rules"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Rules directory
            </Link>
          </nav>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">Platform</h4>
          <nav className="flex flex-col gap-2">
            <Link
              href="/stacks"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Stacks
            </Link>
            <Link
              href="/threats"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Threat feed
            </Link>
          </nav>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">Company</h4>
          <nav className="flex flex-col gap-2">
            <Link
              href="/work-with-us"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Work with us
            </Link>
            <a
              href="https://github.com/aelbuni/aigently-catalog"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Open source ↗
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```
Expected: no output.

- [ ] **Step 3: Commit**
```bash
git add apps/web/components/layout/SiteFooter.tsx
git commit -m "fix: replace footer dead links with real navigation"
```

---

## Task 3: Fix Threats Feed Sort (P1-4)

**Files:**
- Modify: `apps/web/lib/catalog-from-db.ts:557`

The `listThreatsOnLaunchStacksFromDb` function at line 557 uses `asc(threat.publicId)`. Change it to `desc(threat.publishedAt)` so the newest CVEs appear first — matching the "live awareness" brand promise.

- [ ] **Step 1: Update the ORDER BY clause**

In `apps/web/lib/catalog-from-db.ts`, find line 557:
```typescript
.orderBy(asc(threat.publicId));
```

Change to:
```typescript
.orderBy(desc(threat.publishedAt), desc(threat.publicId));
```

The `desc` import is already present on line 2 of the file. The secondary sort by `desc(threat.publicId)` ensures stable ordering for threats with the same publish date.

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```
Expected: no output.

- [ ] **Step 3: Verify at runtime — open threats page**
```bash
# In a browser: http://localhost:3000/threats
# First threat should be a 2025 or 2026 CVE, not CVE-2006-xxxx
```

- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/catalog-from-db.ts
git commit -m "fix: sort threat feed newest-first (publishedAt DESC)"
```

---

## Task 4: Fix Stack Detail "Top Risks" Links (P1-5)

**Files:**
- Modify: `apps/web/lib/stack-overview-content.ts` — add `threatId` to `RiskRow`
- Modify: `apps/web/app/(marketing)/stacks/[stack]/page.tsx:233` — use per-risk href

The `RiskRow` type doesn't carry a threat ID, so all cards share `rulesHref`. We need to add a `threatId` (the CVE public ID) to `RiskRow` and link each card to `/threats/[id]`.

- [ ] **Step 1: Find the RiskRow type definition**
```bash
grep -n "RiskRow\|type Risk\|interface Risk" /Users/aelbuni/Projects/aelbuni/aigently-v1/apps/web/lib/stack-overview-content.ts | head -10
```

- [ ] **Step 2: Add `threatId` to RiskRow**

In `apps/web/lib/stack-overview-content.ts`, find the `RiskRow` type and add an optional `threatId`:
```typescript
export type RiskRow = {
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  borderAccent: string;
  threatId?: string;  // ← add this: CVE public ID for direct linking
};
```

- [ ] **Step 3: Update risk data to include threatIds where known**

In `apps/web/lib/stack-overview-content.ts`, find where `RiskRow` arrays are defined (the per-stack risk lists) and populate `threatId` for known entries. Example pattern:
```typescript
{
  title: "Cross-Site Scripting in react",
  severity: "MEDIUM",
  description: "Tracked in Threats — align rules and stack coverage.",
  borderAccent: "border-l-amber-500",
  threatId: "ghsa_owasp_web-cross-site_scripting_in_react",  // use actual publicId from DB
},
```

If the exact publicIds are unknown for each risk row, set `threatId` to the CVE ID string (e.g., `"CVE-2024-46982"`) — we'll use it as a search query.

- [ ] **Step 4: Update the stack detail page to use per-risk href**

In `apps/web/app/(marketing)/stacks/[stack]/page.tsx` around line 230, change the risk card `Link` from:
```tsx
{overview.risks.map((risk) => (
  <Link
    key={risk.title}
    href={rulesHref}
```
To:
```tsx
{overview.risks.map((risk) => (
  <Link
    key={risk.title}
    href={risk.threatId ? `/threats?q=${encodeURIComponent(risk.threatId)}` : rulesHref}
```

This links cards that have a `threatId` to a pre-searched threats page, and falls back to the rules page for cards without one.

- [ ] **Step 5: TypeScript check**
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```
Expected: no output.

- [ ] **Step 6: Commit**
```bash
git add apps/web/lib/stack-overview-content.ts apps/web/app/(marketing)/stacks/[stack]/page.tsx
git commit -m "fix: link top-risks cards to threat search instead of generic rules page"
```

---

## Task 5: Fix Explore Deep Link (P0-3)

**Files:**
- Modify: `apps/web/app/(marketing)/explore/ExploreClient.tsx:68-70`

**Root cause:** The stack filter in `ExploreClient` at line 68–70 compares `activeStack` (e.g., `"nextjs"`) against `c.stacks` which contains display names like `"Next.js"`, `"Node.js / Express"`. The comparison `s.toLowerCase().includes(activeStack.toLowerCase())` works for slugs vs names IF the slug appears in the name — but `"nextjs"` doesn't appear in `"Next.js"`.

The layer filter works differently — it compares `activeLayer` (`"auth_session"`) against `cardLayerSlugs` which are actual slugs. This correctly works when `layersByRuleId` is populated. The explore page silently swallows the `loadDirectoryFilterMeta` error and leaves `layersByRuleId` empty — so ALL rules have `card.layers === undefined` → `cardLayerSlugs === []` → layer filter excludes everything.

**Fix:** Make `loadDirectoryFilterMeta` errors non-silent — or better, ensure the filter works even when layers are undefined by using a text-heuristic fallback that's already in the codebase for the `types` filter.

- [ ] **Step 1: Read the current ExploreClient stack filter**
```bash
sed -n '66,82p' /Users/aelbuni/Projects/aelbuni/aigently-v1/apps/web/app/(marketing)/explore/ExploreClient.tsx
```

- [ ] **Step 2: Fix the layer filter to fall back gracefully**

In `apps/web/app/(marketing)/explore/ExploreClient.tsx`, the `filteredCards` memo filters by `activeStack` before passing to `filterDirectoryCards`. The real issue is that `loadDirectoryFilterMeta` fails silently in `page.tsx`, leaving all cards without layer data.

Fix `apps/web/app/(marketing)/explore/page.tsx` lines 33-37 to re-throw the error visibly in dev but still produce a usable fallback. More importantly, when `layersByRuleId` is empty but layer filter is active, fall back to text-matching the layer name against the rule's haystack.

In `apps/web/lib/rules-directory-filters.ts`, update the layer filter block (lines 50-53):

```typescript
if (layerFilter.length > 0) {
  // Primary: match against DB-loaded layer slugs
  const slugMatch = layerFilter.some((slug) => cardLayerSlugs.includes(slug));
  if (slugMatch) return true;
  // Fallback: if card has no loaded layers, use text heuristic on the haystack
  // This covers cards where rule_layer_map had no rows loaded
  if (cardLayerSlugs.length === 0) {
    const layerTextMap: Record<string, RegExp> = {
      auth_session: /auth|session|login|credential|jwt|token|oauth|sign.?in/i,
      authz_access: /authoriz|rbac|permission|access.?control|idor|privilege/i,
      input_validation: /inject|xss|sanitiz|validat|escape|input|csrf|sql/i,
      secrets_credentials: /secret|api.?key|env|credential|hardcod|leak/i,
      dependency_supply: /depend|supply.?chain|package|npm|audit|outdated|ghsa/i,
      data_privacy: /pii|privacy|gdpr|encrypt|personal.?data|compliance/i,
      observability_incident: /log|observ|monitor|alert|trace|incident/i,
      ai_safety: /prompt.?inject|llm|ai.?safety|agent|mcp|jailbreak/i,
    };
    const re = layerTextMap[layerFilter[0]];
    if (re) return re.test(hay);
  }
  return false;
}
```

Also fix the stack slug→name mismatch in `ExploreClient.tsx` line 68-70. The `activeStack` is a slug like `"nextjs"` but `c.stacks` contains display names like `"Next.js"`. Add a slug-to-name map:

In `apps/web/app/(marketing)/explore/ExploreClient.tsx`, add before the `filteredCards` memo:

```typescript
const STACK_SLUG_TO_NAME: Record<string, string> = {
  nextjs: "next",
  express: "express",
  fastapi: "fastapi",
  nestjs: "nestjs",
  nuxt: "nuxt",
  "react-spa": "react",
  django: "django",
  rails: "rails",
  go: "go",
  ios: "ios",
  android: "android",
};
```

Then change the stack filter at lines 68-70:
```typescript
if (activeStack) {
  const nameHint = STACK_SLUG_TO_NAME[activeStack] ?? activeStack;
  cards = cards.filter((c) =>
    c.stacks.some((s) => s.toLowerCase().includes(nameHint.toLowerCase()))
  );
}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```
Expected: no output.

- [ ] **Step 4: Verify the fix**

Open http://localhost:3000/explore?stack=nextjs&layer=auth_session in the browser. Should show Next.js rules, not "0 rules".

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/rules-directory-filters.ts apps/web/app/(marketing)/explore/ExploreClient.tsx
git commit -m "fix: explore deep link — layer text-fallback filter + stack slug→name mapping"
```

---

## Task 6: Fix Layers List "0 Threats" Display Bug (P1-7)

**Files:**
- Investigate: `apps/web/lib/catalog-from-db.ts:648-650`

The query at line 648 counts `threat_layer` rows for each layer:
```sql
SELECT COUNT(*)::int FROM threat_layer tl WHERE tl.layer_id = ${layer.id}
```

This SQL is correct. The issue is data: run a quick DB check to confirm whether `threat_layer` rows exist.

- [ ] **Step 1: Check if threat_layer rows exist for auth_session**
```bash
cd /Users/aelbuni/Projects/aelbuni/aigently-v1
# Get auth_session layer id and count its threat_layer rows
npx tsx -e "
const { db } = await import('./apps/web/lib/db.js');
const { layer, threatLayer } = await import('./packages/db/src/schema.js');
const { eq, sql } = await import('drizzle-orm');
const rows = await db.select({ id: layer.id, slug: layer.slug }).from(layer).where(eq(layer.slug, 'auth_session'));
console.log('Layer:', rows[0]);
if (rows[0]) {
  const cnt = await db.select({ c: sql\`count(*)\` }).from(threatLayer).where(eq(threatLayer.layerId, rows[0].id));
  console.log('threat_layer rows:', cnt[0]);
}
process.exit(0);
" 2>&1 | tail -5
```

- [ ] **Step 2: If count > 0, the query is fine — check the layers page component**

Open `apps/web/app/(marketing)/layers/page.tsx` and verify that `listLayersWithStatsFromDb()` is being called and the result is rendered. The query filters by `eq(layer.isActive, true)` — if auth_session is active, it should return a non-zero count.

- [ ] **Step 3: If count is 0, re-assign threats to layers**

The issue is likely that `sourceLayerMapping` was empty during previous sync runs. After Action C (add aigently source mapping), re-run threat layer assignment from admin:
- Go to http://localhost:3000/admin/sources
- Click **"Re-assign All Threat Layers"** button

- [ ] **Step 4: Commit if code changes were needed; otherwise note data fix**
```bash
# If code was changed:
git add apps/web/app/(marketing)/layers/page.tsx
git commit -m "fix: layers list threat count — ensure active filter matches"
```

---

## Task 7: Fix Homepage Stats (P2-1)

**Files:**
- Modify: `apps/web/lib/home-marketing-content.ts:99-107`

The STAT_TILES array has hardcoded `"6"` for stacks and rules. The correct values are 11 stacks and 12 rules. But rather than hardcoding new numbers (which will go stale again), update to values that accurately describe the *launch configuration*.

- [ ] **Step 1: Update stat tile values**

In `apps/web/lib/home-marketing-content.ts`, update the `STAT_TILES` array:

```typescript
export const STAT_TILES = [
  {
    value: "—",
    label: "Verified threats (launch stacks)",
    footnote: "Replaced at runtime from the catalog database after seed.",
  },
  {
    value: "11",
    label: "Stacks in catalog",
    footnote: "Next.js, Express, FastAPI, NestJS, Nuxt, React SPA, Django, Rails, Go, iOS, Android.",
  },
  {
    value: "12",
    label: "Certified rules",
    footnote: "Each rule maps to real CVE rows via rule_threat_map.",
  },
  {
    value: "$0",
    label: "Apache-2.0 licensed",
    footnote: "See the LICENSE file in this repository.",
  },
] as const;
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```
Expected: no output.

- [ ] **Step 3: Commit**
```bash
git add apps/web/lib/home-marketing-content.ts
git commit -m "fix: update homepage stat tiles — 11 stacks, 12 rules"
```

---

## Task 8: Fix Fake Usage Numbers (PRD credibility)

**Files:**
- Modify: `apps/web/lib/catalog-from-db.ts:36-40` — fix SQL to use correct table/column names
- Modify: `apps/web/lib/rules-directory-showcase.ts:140` — suppress fake fallback numbers

The `rule_weekly_usage` table doesn't exist — schema has `rule_usage_daily` with `copy_count`. The subquery silently returns 0 (or errors). The showcase fallback generates fake numbers like `200 + (h % 800)`.

- [ ] **Step 1: Fix the weeklyUsesSubquery to use the real table**

In `apps/web/lib/catalog-from-db.ts`, replace lines 36-40:

```typescript
const weeklyUsesSubquery = sql<number>`(
  SELECT COALESCE(SUM(wu.total_copies), 0)::int
  FROM rule_weekly_usage AS wu
  WHERE wu.rule_id = ${rule.id}
)`.as("weeklyUses");
```

With:

```typescript
const weeklyUsesSubquery = sql<number>`(
  SELECT COALESCE(SUM(ud.copy_count), 0)::int
  FROM rule_usage_daily AS ud
  WHERE ud.rule_id = ${rule.id}
    AND ud.bucket_date >= CURRENT_DATE - INTERVAL '7 days'
)`.as("weeklyUses");
```

This sums `copy_count` from `rule_usage_daily` for the last 7 days — matching "weekly uses" semantics.

- [ ] **Step 2: Remove the fake number fallback in showcase**

In `apps/web/lib/rules-directory-showcase.ts`, line 140 currently:
```typescript
const usesLabel = rule.weeklyUses > 0 ? formatUsesLabel(rule.weeklyUses) : usesK >= 1 ? `${usesK.toFixed(1)}k` : `${200 + (h % 800)}`;
```

Change to:
```typescript
const usesLabel = rule.weeklyUses > 0 ? formatUsesLabel(rule.weeklyUses) : "";
```

When `weeklyUses` is 0 (no one has copied yet), show nothing rather than a fabricated number. The rule card component should already handle an empty `usesLabel` gracefully (check if it renders an empty string safely — if it shows "0" that's fine too).

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```
Expected: no output.

- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/catalog-from-db.ts apps/web/lib/rules-directory-showcase.ts
git commit -m "fix: correct rule usage query (rule_usage_daily) and remove fake usage number fallback"
```

---

## Task 9: Investigate + Fix GHSA Sync Failure (P0-5)

**Files:**
- Investigate: `apps/web/scripts/sync-threats.ts` — GHSA source handler
- Investigate: `apps/web/.env` — `GITHUB_TOKEN` presence

- [ ] **Step 1: Check if GITHUB_TOKEN is set**
```bash
grep -n "GITHUB_TOKEN\|GITHUB_PAT" /Users/aelbuni/Projects/aelbuni/aigently-v1/apps/web/.env 2>/dev/null || echo "Not in .env — check environment"
printenv GITHUB_TOKEN 2>/dev/null | head -c 20 || echo "GITHUB_TOKEN not in environment"
```

- [ ] **Step 2: Check the last sync error details**

Open http://localhost:3000/admin/sync — read the "Details" JSON for the failed 5/20/2026 run. The phaseSummary JSON should show which phase failed and what error.

- [ ] **Step 3: If GITHUB_TOKEN is missing, add it**

The `.env.example` says:
> `GITHUB_TOKEN` — A GitHub PAT with `read:packages` scope. Required for GHSA source.

```bash
# Create a GitHub PAT at https://github.com/settings/tokens
# Add to apps/web/.env:
echo "GITHUB_TOKEN=<your-pat-here>" >> /Users/aelbuni/Projects/aelbuni/aigently-v1/apps/web/.env
```

Then restart the dev server and re-trigger sync from http://localhost:3000/admin/sync.

- [ ] **Step 4: Re-run sync to confirm success**
- Go to http://localhost:3000/admin/sync
- Click **"Trigger Sync"**
- Wait for completion — status should be "success"
- GHSA `fetched` count should be > 0 this time

- [ ] **Step 5: Note (no code commit needed unless GHSA fetch code was broken)**

---

## Final Verification Checklist

After all tasks and actions are complete:

- [ ] http://localhost:3000 — homepage stats show 11 and 12; no fake usage numbers on rules
- [ ] http://localhost:3000/stacks/nextjs — "Explore →" link works (shows rules, not "0 rules")
- [ ] http://localhost:3000/explore?stack=nextjs&layer=auth_session — shows Next.js rules for auth layer
- [ ] http://localhost:3000/threats — first result is a 2025/2026 CVE (not 2006)
- [ ] http://localhost:3000/layers — auth_session shows threat count > 0
- [ ] http://localhost:3000 → nav — no "News" link; GitHub → catalog repo
- [ ] Footer on any page — all links are real and clickable
- [ ] http://localhost:3000/admin/llm — provider is "Anthropic API" ✓
- [ ] http://localhost:3000/admin/threats — no "Test Threat (Updated)" row
- [ ] http://localhost:3000/admin/guardrails/evaluation — coverage > 7% (target: 50%+ after bulk generate)
- [ ] http://localhost:3000/admin/sync — latest run shows "success"
- [ ] `npx tsc --noEmit -p apps/web/tsconfig.json` — zero errors
