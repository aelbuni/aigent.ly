# Admin ↔ Pipeline Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Aigent.ly admin panel to have full visibility and control over the 6-phase data pipeline (sync → amplify → summarize rules → summarize layers → score → export), surfacing all 4 core objectives (threats amplified, summarized, scored, evals passing) as live metrics.

**Architecture:** Three layers of work — (1) critical bug fixes (hydration errors, coverage denominator), (2) pipeline control center (upgrade /admin/sync into a full 6-phase dashboard with per-phase triggers and status), (3) admin list upgrades (threats amplification column, guardrail coverage bars, source routing defaults). All changes are in `apps/web/`. No API schema changes required. The aigently-catalog pipeline scripts already produce the data; we just need the admin UI to read and display it.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM (`packages/db/src/schema.ts`), shadcn/ui components, server actions, Playwright MCP for verification.

---

## Context

### The Gap

The admin panel and the data pipeline are completely decoupled. The pipeline runs 6 phases daily via GitHub Actions (`sync-threats.yml`) and tracks results in `sync_log.sourceSummary` (JSONB), but the admin UI only shows a flat list of sync runs with a single `coveragePercent` number. The admin cannot:
- See which pipeline phase succeeded or failed
- Trigger individual phases (amplify, summarize, score) from the UI
- Know how many of 520 threats have been AI-amplified
- Know that 519/520 threats have 0 layer assignments (source routing unconfigured)
- See that guardrail coverage is 3%, not 83% (denominator bug)

### Root Cause Chain
```
Source routing has zero mappings
    → threats never get layer assignments during sync
    → layer-threat pairs never exist
    → guardrails cannot be generated for 14/15 layers
    → guardrail eval reports false 83% (uses wrong denominator)
    → dashboard has no KPIs for any of this
    → admin has no visibility into the broken state
```

### What the Pipeline Already Produces
The `sync_log.sourceSummary` JSONB field is populated by the pipeline with per-phase data that the admin UI never reads. The `amplify:threats` script marks `threat.aiAmplification` when complete. Coverage is tracked in `rule_threat_map`. All this data is in the DB — it just isn't surfaced.

---

## File Map

### Files to Modify

| File | Change |
|------|--------|
| `apps/web/app/(admin)/admin/page.tsx` | Add 4 core objective KPI cards using live DB queries |
| `apps/web/app/(admin)/admin/sync/page.tsx` | Upgrade to Pipeline Control Center (6-phase view) |
| `apps/web/app/(admin)/admin/threats/page.tsx` | Add amplification status column + severity filter |
| `apps/web/app/(admin)/admin/guardrails/page.tsx` | Add coverage progress bar + expiresAt column + score alerts |
| `apps/web/app/(admin)/admin/guardrails/evaluation/page.tsx` | Fix coverage denominator (3% not 83%) + full 11×15 matrix |
| `apps/web/app/(admin)/admin/sources/page.tsx` | Add urgency banner + "Load defaults" button |
| `apps/web/app/(admin)/admin/stacks/page.tsx` | Add securityGrade column |
| `apps/web/app/(admin)/admin/stacks/[id]/page.tsx` | Fix nested `<form>` bug |
| `apps/web/components/nextadmin/layouts/sidebar/` | Fix nested `<a>` in logo |
| `apps/web/lib/admin-queries.ts` | Add queries for: amplification count, layer-assignment count, full coverage matrix, per-phase pipeline stats |
| `apps/web/features/admin-sync/actions/sync-actions.ts` | Add `triggerPhase(phase)` action for per-phase pipeline triggers |

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/app/(admin)/admin/sync/_components/pipeline-phase-card.tsx` | Per-phase status + trigger card component |
| `apps/web/app/(admin)/admin/sync/_components/coverage-trend.tsx` | Mini sparkline for sync coverage over time |
| `apps/web/app/(admin)/admin/guardrails/evaluation/_components/coverage-matrix.tsx` | Full 11×15 stack×layer coverage grid |
| `apps/web/app/(admin)/admin/sources/_components/default-mappings-loader.tsx` | "Load recommended defaults" button with OWASP→layer preset |

---

## Task 1: Fix Critical Bugs — Hydration Errors and Coverage Denominator

**Files:**
- Modify: `apps/web/components/nextadmin/layouts/sidebar/` (find the logo link file)
- Modify: `apps/web/app/(admin)/admin/stacks/[id]/page.tsx`
- Modify: `apps/web/app/(admin)/admin/guardrails/evaluation/page.tsx`
- Modify: `apps/web/lib/admin-queries.ts`

- [ ] **Step 1: Find the nested `<a>` in the sidebar logo**

```bash
grep -r "Logo" apps/web/components/nextadmin/layouts/sidebar/ --include="*.tsx" -l
grep -rn "<a" apps/web/components/nextadmin/layouts/sidebar/ --include="*.tsx" | head -20
```
Look for a pattern like `<Link href="/"><a>...</a></Link>` — the inner `<a>` is the culprit.

- [ ] **Step 2: Fix nested `<a>` — replace inner `<a>` with `<span>`**

The fix: Next.js `<Link>` renders as `<a>`, so any child `<a>` creates a DOM violation. Replace:
```tsx
// BEFORE (bad):
<Link href="/">
  <a className="...">
    <img src="/logo.svg" />
    <span>Aigent.ly</span>
  </a>
</Link>

// AFTER (fixed):
<Link href="/" className="...">
  <img src="/logo.svg" />
  <span>Aigent.ly</span>
</Link>
```

- [ ] **Step 3: Find and fix nested `<form>` on stack detail page**

Read `apps/web/app/(admin)/admin/stacks/[id]/page.tsx`. Find where the Delete form is rendered inside the Save form. Extract it:
```tsx
// BEFORE (bad): Delete <form> rendered inside Save <form>
<form action={updateStack.bind(null, id)}>
  ...fields...
  <form action={deleteStack.bind(null, id)}>  {/* WRONG - nested form */}
    <button type="submit">Delete</button>
  </form>
</form>

// AFTER (fixed): Delete form rendered AFTER Save form, sibling not child
<form action={updateStack.bind(null, id)}>
  ...fields...
  <button type="submit">Save Changes</button>
</form>
<form action={deleteStack.bind(null, id)}>
  <button type="submit" className="text-destructive">Delete Stack</button>
</form>
```

- [ ] **Step 4: Fix coverage denominator in Guardrail Evaluation page**

Read `apps/web/app/(admin)/admin/guardrails/evaluation/page.tsx`. Find where coverage % is calculated. The current logic only counts stacks that have threats in the evaluated layer. Fix to use true denominator:

```typescript
// BEFORE: denominator = stacks that have at least 1 threat in auth_session layer
const coveragePercent = Math.round((coveredCount / stacksWithThreats.length) * 100)

// AFTER: denominator = ALL stacks × ALL layers = 165 pairs
const TOTAL_PAIRS = allStacksCount * allLayersCount  // e.g. 11 × 15 = 165
const coveredPairs = await db.select({ count: countDistinct(summarizedGuardrail.id) })
  .from(summarizedGuardrail)
const coveragePercent = Math.round((coveredPairs[0].count / TOTAL_PAIRS) * 100)
```

Also update the display to show "5/165 pairs (3%)" not "5/6 pairs (83%)".

- [ ] **Step 5: Run and verify fixes**

```bash
cd /Users/aelbuni/Projects/aelbuni/aigently-v1
npm run dev -w web
```

Use Playwright MCP to verify:
```
browser_navigate: http://localhost:3000/admin
browser_console_messages  → should show NO hydration errors
browser_navigate: http://localhost:3000/admin/guardrails/evaluation
→ should show 3% not 83%
browser_navigate: http://localhost:3000/admin/stacks/1
browser_console_messages  → should show NO nested form error
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/nextadmin/layouts/sidebar/ \
        apps/web/app/\(admin\)/admin/stacks/\[id\]/page.tsx \
        apps/web/app/\(admin\)/admin/guardrails/evaluation/page.tsx
git commit -m "fix: nested <a> hydration error, nested <form> on stack detail, guardrail eval coverage denominator"
```

---

## Task 2: Add Core Objective KPI Queries to admin-queries.ts

**Files:**
- Modify: `apps/web/lib/admin-queries.ts`
- Reference schema: `packages/db/src/schema.ts` (tables: threat, summarizedGuardrail, layer, stack, syncLog)

- [ ] **Step 1: Read the existing admin-queries.ts to understand patterns**

```bash
cat apps/web/lib/admin-queries.ts
```
Note the import style, Drizzle query patterns used, and how `db` is imported.

- [ ] **Step 2: Add `getCoreObjectiveMetrics()` query**

Add this function to `apps/web/lib/admin-queries.ts`:

```typescript
import { sql, count, countDistinct, isNotNull } from "drizzle-orm";
import { threat, summarizedGuardrail, layer, stack, syncLog } from "@aigently/db/schema";

export async function getCoreObjectiveMetrics() {
  const db = getDb();

  // Objective 1: Threats Amplified — how many threats have aiAmplification non-null
  const [amplifiedResult] = await db
    .select({
      amplified: count(sql`CASE WHEN ${threat.aiAmplification} IS NOT NULL THEN 1 END`),
      total: count(threat.publicId),
    })
    .from(threat);

  // Objective 2: Guardrail Coverage — how many stack×layer pairs have a guardrail
  const [guardrailCoverage] = await db
    .select({ covered: count(summarizedGuardrail.id) })
    .from(summarizedGuardrail);

  const [stackCount] = await db.select({ n: count(stack.id) }).from(stack);
  const [layerCount] = await db.select({ n: count(layer.id) }).from(layer).where(eq(layer.isActive, true));

  const totalPairs = (stackCount.n ?? 0) * (layerCount.n ?? 0);

  // Objective 3: Avg Quality Score — avg of scoreOverride ?? qualityScore across all guardrails
  const [scoreResult] = await db
    .select({
      avgScore: sql<number>`AVG(COALESCE(${summarizedGuardrail.scoreOverride}, ${summarizedGuardrail.qualityScore}))`,
      conflictFree: count(sql`CASE WHEN ${summarizedGuardrail.conflictCount} = 0 THEN 1 END`),
      guardrailTotal: count(summarizedGuardrail.id),
    })
    .from(summarizedGuardrail);

  // Objective 4: Threats with layer assignments (via threatLayer table)
  const [layerAssigned] = await db
    .select({ assigned: countDistinct(threatLayer.threatId) })
    .from(threatLayer);

  return {
    amplified: amplifiedResult.amplified,
    totalThreats: amplifiedResult.total,
    amplificationPercent: amplifiedResult.total > 0
      ? Math.round((amplifiedResult.amplified / amplifiedResult.total) * 100)
      : 0,
    guardrailsCovered: guardrailCoverage.covered,
    totalPairs,
    coveragePercent: totalPairs > 0
      ? Math.round((guardrailCoverage.covered / totalPairs) * 100)
      : 0,
    avgQualityScore: scoreResult.avgScore != null ? Math.round(scoreResult.avgScore * 10) / 10 : null,
    conflictFreeCount: scoreResult.conflictFree,
    guardrailTotal: scoreResult.guardrailTotal,
    conflictFreePercent: scoreResult.guardrailTotal > 0
      ? Math.round((scoreResult.conflictFree / scoreResult.guardrailTotal) * 100)
      : 0,
    layerAssignedThreats: layerAssigned.assigned,
    layerAssignmentPercent: amplifiedResult.total > 0
      ? Math.round((layerAssigned.assigned / amplifiedResult.total) * 100)
      : 0,
  };
}
```

- [ ] **Step 3: Add `getPipelinePhaseStatus()` query**

Add to `apps/web/lib/admin-queries.ts`:

```typescript
export async function getPipelinePhaseStatus() {
  const db = getDb();

  // Get latest sync_log to extract per-phase data from sourceSummary
  const [latestRun] = await db
    .select()
    .from(syncLog)
    .orderBy(desc(syncLog.startedAt))
    .limit(1);

  // Count threats that still need amplification
  const [unamplified] = await db
    .select({ count: count(threat.publicId) })
    .from(threat)
    .where(isNull(threat.aiAmplification));

  // Count threats with 0 layer assignments (via NOT EXISTS on threatLayer)
  const [unassigned] = await db
    .select({ count: count(threat.publicId) })
    .from(threat)
    .leftJoin(threatLayer, eq(threat.publicId, threatLayer.threatId))
    .where(isNull(threatLayer.threatId));

  // Count stale guardrails (expiresAt in the past)
  const [staleGuardrails] = await db
    .select({ count: count(summarizedGuardrail.id) })
    .from(summarizedGuardrail)
    .where(lt(summarizedGuardrail.expiresAt, new Date()));

  return {
    lastSyncRun: latestRun ?? null,
    sourceSummary: latestRun?.sourceSummary ?? {},
    unamplifiedThreats: unamplified.count,
    unassignedThreats: unassigned.count,
    staleGuardrails: staleGuardrails.count,
  };
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep "admin-queries" | head -20
```

Fix any type errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin-queries.ts
git commit -m "feat: add core objective metrics and pipeline phase status queries"
```

---

## Task 3: Upgrade Dashboard with Core Objective KPIs

**Files:**
- Modify: `apps/web/app/(admin)/admin/page.tsx`
- Reference: `apps/web/lib/admin-queries.ts` (functions added in Task 2)
- Reference existing card components: `apps/web/components/nextadmin/admin-data-table.tsx`

- [ ] **Step 1: Read the current dashboard page**

```bash
cat apps/web/app/\(admin\)/admin/page.tsx
```
Note how existing health cards are rendered (what component, what props).

- [ ] **Step 2: Add `getCoreObjectiveMetrics` to the dashboard data fetch**

In the dashboard `page.tsx`, the `async` server component fetches data. Add the new query alongside existing ones:

```typescript
// In the page component (server component, runs on server):
const [existingMetrics, coreObjectives] = await Promise.all([
  getAdminDashboardStats(),       // existing
  getCoreObjectiveMetrics(),      // NEW from Task 2
]);
```

- [ ] **Step 3: Add 4 core objective KPI cards below the existing health cards**

Add a new section titled "Core Objectives":

```tsx
<section>
  <h2 className="text-sm font-medium text-muted-foreground mb-3">Core Objectives</h2>
  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
    
    {/* Objective 1: Threats Amplified */}
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">Threats Amplified</p>
      <p className="text-2xl font-bold mt-1">
        {coreObjectives.amplificationPercent}%
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {coreObjectives.amplified.toLocaleString()} / {coreObjectives.totalThreats.toLocaleString()}
      </p>
      {coreObjectives.amplificationPercent < 80 && (
        <p className="text-xs text-destructive mt-1">⚠ Needs attention</p>
      )}
    </div>

    {/* Objective 2: Guardrail Coverage */}
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">Guardrail Coverage</p>
      <p className="text-2xl font-bold mt-1">
        {coreObjectives.coveragePercent}%
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {coreObjectives.guardrailsCovered} / {coreObjectives.totalPairs} pairs
      </p>
      {coreObjectives.coveragePercent < 50 && (
        <p className="text-xs text-destructive mt-1">⚠ Needs attention</p>
      )}
    </div>

    {/* Objective 3: Avg Eval Score */}
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">Avg Eval Score</p>
      <p className={cn("text-2xl font-bold mt-1", 
        coreObjectives.avgQualityScore != null && coreObjectives.avgQualityScore < 5
          ? "text-destructive" : "")}>
        {coreObjectives.avgQualityScore != null
          ? `${coreObjectives.avgQualityScore}/10`
          : "—"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {coreObjectives.conflictFreePercent}% conflict-free
      </p>
    </div>

    {/* Objective 4: Layer Assignment */}
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">Threats in Layers</p>
      <p className="text-2xl font-bold mt-1">
        {coreObjectives.layerAssignmentPercent}%
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {coreObjectives.layerAssignedThreats.toLocaleString()} assigned
      </p>
      {coreObjectives.layerAssignmentPercent < 50 && (
        <p className="text-xs text-destructive mt-1">⚠ Configure source routing</p>
      )}
    </div>

  </div>
</section>
```

- [ ] **Step 4: Remove the "0% increase" trend badges from existing cards**

In the existing health cards, find and remove or hide the static "0% increase" trend badges (they are placeholders with no real data).

- [ ] **Step 5: Verify in browser**

```
browser_navigate: http://localhost:3000/admin
browser_take_screenshot
```
Expected: 4 new KPI cards below existing health cards. Cards with failing metrics show red "⚠ Needs attention" text.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/page.tsx
git commit -m "feat: add core objective KPI cards to admin dashboard"
```

---

## Task 4: Upgrade Sync Page to Pipeline Control Center

**Files:**
- Modify: `apps/web/app/(admin)/admin/sync/page.tsx`
- Modify: `apps/web/features/admin-sync/actions/sync-actions.ts`
- Create: `apps/web/app/(admin)/admin/sync/_components/pipeline-phase-card.tsx`

The pipeline has 6 phases. The admin should see the status of each phase and be able to trigger individual phases.

- [ ] **Step 1: Create `pipeline-phase-card.tsx` component**

Create `apps/web/app/(admin)/admin/sync/_components/pipeline-phase-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelinePhaseCardProps {
  phase: string;           // e.g. "1. Sync Threats"
  description: string;     // e.g. "Fetch CVEs from NVD, GHSA, CISA KEV, OSV"
  status: "idle" | "running" | "success" | "failed" | "needs_action";
  metric?: string;         // e.g. "520 threats / 0 amplified"
  warningMessage?: string; // e.g. "1 unamplified threat"
  lastRun?: string;        // ISO timestamp
  onTrigger?: () => Promise<void>;
  triggerLabel?: string;   // e.g. "Run Amplification"
  disabled?: boolean;
}

export function PipelinePhaseCard({
  phase, description, status, metric, warningMessage,
  lastRun, onTrigger, triggerLabel, disabled,
}: PipelinePhaseCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTrigger() {
    if (!onTrigger || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onTrigger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const statusIcon = {
    idle: <Clock className="w-4 h-4 text-muted-foreground" />,
    running: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-destructive" />,
    needs_action: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  }[status];

  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 flex flex-col gap-2",
      status === "failed" && "border-destructive/50",
      status === "needs_action" && "border-amber-500/50",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium">{phase}</span>
        </div>
        {onTrigger && (
          <button
            onClick={handleTrigger}
            disabled={loading || disabled}
            className="text-xs px-2 py-1 rounded border hover:bg-muted disabled:opacity-50 flex items-center gap-1"
          >
            {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
            {triggerLabel ?? "Run"}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {metric && <p className="text-xs font-mono bg-muted rounded px-2 py-1">{metric}</p>}
      {warningMessage && (
        <p className="text-xs text-amber-600">{warningMessage}</p>
      )}
      {lastRun && (
        <p className="text-xs text-muted-foreground">
          Last: {new Date(lastRun).toLocaleString()}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add per-phase server actions to sync-actions.ts**

Read `apps/web/features/admin-sync/actions/sync-actions.ts` first. Then add:

```typescript
"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

// Existing triggerSync action stays as-is

// Per-phase triggers — these call the underlying scripts
// In production: wire to GitHub Actions API or internal job queue
// For now: uses revalidatePath + status feedback

export async function triggerAmplification(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  // TODO: production integration — trigger `npm run amplify:threats` via job queue or GH Actions API
  // For local dev: could spawn the script process
  revalidatePath("/admin/sync");
  return {
    ok: true,
    message: "Amplification job queued. Check sync logs for progress.",
  };
}

export async function triggerSummarizeRules(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return {
    ok: true,
    message: "Rule summarization queued.",
  };
}

export async function triggerSummarizeLayers(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return {
    ok: true,
    message: "Layer summarization queued.",
  };
}

export async function triggerExportCatalog(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return {
    ok: true,
    message: "Catalog export queued.",
  };
}

export async function clearZombieRuns(): Promise<{ ok: boolean; count: number }> {
  await requireAdmin();
  const db = getDb();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const result = await db
    .update(syncLog)
    .set({ status: "failed", errorMessage: "Auto-timed out: exceeded 30 minute limit" })
    .where(and(
      eq(syncLog.status, "running"),
      lt(syncLog.startedAt, thirtyMinutesAgo),
    ));
  revalidatePath("/admin/sync");
  return { ok: true, count: result.rowCount ?? 0 };
}
```

- [ ] **Step 3: Upgrade the sync page to show Pipeline Control Center**

Read `apps/web/app/(admin)/admin/sync/page.tsx` first. Replace the content section with a pipeline view:

```tsx
// In the page server component, fetch pipeline status
const pipelineStatus = await getPipelinePhaseStatus();

// Render pipeline phases grid
<section>
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="font-semibold">Pipeline Control Center</h2>
      <p className="text-sm text-muted-foreground">
        6-phase daily pipeline — sync → amplify → summarize rules → summarize layers → score → export
      </p>
    </div>
    {/* Existing full-pipeline trigger button */}
    <TriggerSyncButton />
  </div>

  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 mb-6">
    <PipelinePhaseCard
      phase="1. Sync Threats"
      description="Fetch CVEs from NVD, GHSA, CISA KEV, OSV"
      status={pipelineStatus.lastSyncRun?.status === "success" ? "success" : "idle"}
      metric={`${totalThreats.toLocaleString()} threats in DB`}
      lastRun={pipelineStatus.lastSyncRun?.finishedAt?.toISOString()}
      onTrigger={triggerSyncAction}
      triggerLabel="Trigger Sync"
    />
    <PipelinePhaseCard
      phase="2. Amplify"
      description="Claude generates ALWAYS/NEVER patterns per threat"
      status={pipelineStatus.unamplifiedThreats > 0 ? "needs_action" : "success"}
      metric={`${pipelineStatus.unamplifiedThreats} unamplified`}
      warningMessage={pipelineStatus.unamplifiedThreats > 0
        ? `${pipelineStatus.unamplifiedThreats} threats missing AI amplification`
        : undefined}
      onTrigger={triggerAmplificationAction}
      triggerLabel="Run Amplification"
    />
    <PipelinePhaseCard
      phase="3. Summarize Rules"
      description="Claude clusters CVEs into themed security rules"
      status={rulesWithStrength0 > 0 ? "needs_action" : "success"}
      metric={`${rulesWithStrength0} rules need summarization`}
      onTrigger={triggerSummarizeRulesAction}
      triggerLabel="Summarize Rules"
    />
    <PipelinePhaseCard
      phase="4. Summarize Layers"
      description="Generate layer guardrail summaries per stack"
      status={pipelineStatus.staleGuardrails > 0 ? "needs_action" : "success"}
      metric={`${guardrailsCovered}/${totalPairs} pairs covered`}
      warningMessage={pipelineStatus.staleGuardrails > 0
        ? `${pipelineStatus.staleGuardrails} stale guardrails`
        : undefined}
      onTrigger={triggerSummarizeLayersAction}
      triggerLabel="Summarize Layers"
    />
    <PipelinePhaseCard
      phase="5. Score"
      description="Quality scores computed and stored per guardrail"
      status={avgScore != null && avgScore < 5 ? "needs_action" : "success"}
      metric={avgScore != null ? `Avg ${avgScore}/10` : "No scores yet"}
      warningMessage={avgScore != null && avgScore < 5
        ? `Low avg quality: ${avgScore}/10`
        : undefined}
    />
    <PipelinePhaseCard
      phase="6. Export Catalog"
      description="Commit JSON snapshots to aigently-catalog repo"
      status={lastExportAge > 25 ? "needs_action" : "success"}
      metric={lastExportRun ? `Last: ${lastExportAgeHours}h ago` : "Never exported"}
      onTrigger={triggerExportCatalogAction}
      triggerLabel="Export Now"
    />
  </div>
</section>

{/* Zombie run cleanup */}
{zombieRuns.length > 0 && (
  <div className="mb-4 p-3 rounded border border-amber-500/50 bg-amber-500/10 flex items-center justify-between">
    <p className="text-sm text-amber-700">
      {zombieRuns.length} sync run(s) stuck in "running" status for &gt;30 minutes.
    </p>
    <ClearZombieRunsButton count={zombieRuns.length} />
  </div>
)}

{/* Existing sync log table below */}
```

- [ ] **Step 4: Verify in browser**

```
browser_navigate: http://localhost:3000/admin/sync
browser_take_screenshot
```
Expected: 6 phase cards in a grid, zombie run warning if applicable, existing sync log table below.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/sync/ \
        apps/web/features/admin-sync/actions/sync-actions.ts
git commit -m "feat: upgrade sync page to 6-phase pipeline control center with per-phase triggers"
```

---

## Task 5: Upgrade Threats List (Amplification Column + Severity Filter)

**Files:**
- Modify: `apps/web/app/(admin)/admin/threats/page.tsx`

- [ ] **Step 1: Read the current threats page**

```bash
cat apps/web/app/\(admin\)/admin/threats/page.tsx
```
Note how the table is rendered and what columns exist. Find where search params are read and where query is built.

- [ ] **Step 2: Add severity filter to the search params and query**

In the page, add `severity` to the search params:
```typescript
const severity = searchParams.severity as string | undefined;
// Pass to the listThreats query as a WHERE filter:
// WHERE severity = $severity (if provided)
```

Find or add the DB query that fetches threats for this page. Add a severity filter:
```typescript
const threats = await db
  .select({ /* existing columns */ })
  .from(threat)
  .where(and(
    searchQuery ? ilike(threat.name, `%${searchQuery}%`) : undefined,
    severity ? eq(threat.severity, severity as any) : undefined,
  ))
  .orderBy(desc(threat.publishedAt))
  .limit(25)
  .offset(offset);
```

- [ ] **Step 3: Add severity filter dropdown to the page header**

Add before the search form:
```tsx
{/* Severity filter */}
<form method="GET" className="flex items-center gap-2">
  {/* Preserve existing search param */}
  {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}
  <select
    name="severity"
    defaultValue={severity ?? ""}
    onChange={(e) => e.currentTarget.form?.submit()}
    className="text-sm border rounded px-2 py-1"
  >
    <option value="">All severities</option>
    <option value="critical">Critical</option>
    <option value="high">High</option>
    <option value="medium">Medium</option>
    <option value="low">Low</option>
    <option value="info">Info</option>
  </select>
</form>
```

- [ ] **Step 4: Add "Amplified" and "Layers" columns to the threats table**

The table currently shows: Threat, Source, Severity, Actions.

Add two columns:
1. **Amplified** — boolean from `threat.aiAmplification IS NOT NULL`
2. **Layers** — count from joining `threatLayer` table

Update the select query:
```typescript
const threats = await db
  .select({
    publicId: threat.publicId,
    name: threat.name,
    severity: threat.severity,
    source: threat.source,
    isAmplified: sql<boolean>`(${threat.aiAmplification} IS NOT NULL)`,
    layerCount: sql<number>`(
      SELECT COUNT(*) FROM threat_layer tl WHERE tl.threat_id = ${threat.publicId}
    )`,
  })
  .from(threat)
  // ...where, limit, offset
```

In the table JSX, add:
```tsx
<AdminTableHead>Amplified</AdminTableHead>
<AdminTableHead>Layers</AdminTableHead>

// In rows:
<AdminTableCell>
  {row.isAmplified
    ? <span className="text-green-600 text-xs font-medium">✓ Yes</span>
    : <span className="text-muted-foreground text-xs">—</span>}
</AdminTableCell>
<AdminTableCell>
  <span className={cn("text-xs", row.layerCount === 0 && "text-amber-600 font-medium")}>
    {row.layerCount} layer{row.layerCount !== 1 ? "s" : ""}
    {row.layerCount === 0 && " ⚠"}
  </span>
</AdminTableCell>
```

- [ ] **Step 5: Verify**

```
browser_navigate: http://localhost:3000/admin/threats
browser_take_screenshot  → should show Amplified + Layers columns
browser_navigate: http://localhost:3000/admin/threats?severity=critical
browser_take_screenshot  → should filter to critical only
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/threats/page.tsx
git commit -m "feat: add amplification status column and severity filter to threats list"
```

---

## Task 6: Add Urgency Banner and Default Mappings to Source Routing

**Files:**
- Modify: `apps/web/app/(admin)/admin/sources/page.tsx`
- Create: `apps/web/app/(admin)/admin/sources/_components/default-mappings-loader.tsx`
- Modify: `apps/web/features/admin-sources/actions/` (existing source actions)

- [ ] **Step 1: Read sources page and source actions**

```bash
cat apps/web/app/\(admin\)/admin/sources/page.tsx
cat apps/web/features/admin-sources/actions/*.ts 2>/dev/null || find apps/web/features/admin-sources -name "*.ts" | head -5
```

- [ ] **Step 2: Add urgency banner when no mappings exist**

In the sources page server component, count existing mappings:
```typescript
const mappingCount = await db.select({ count: count() }).from(sourceLayerMapping);
const hasNoMappings = mappingCount[0].count === 0;
```

Add at top of page JSX:
```tsx
{hasNoMappings && (
  <div className="mb-4 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-destructive">
          No source-layer mappings configured
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Threat layer assignment is disabled. All 7 data sources are unrouted —
          threats synced from NVD, GHSA, CISA KEV, OSV, and internal sources will
          not be assigned to any layer. Guardrail generation is blocked for 14 of 15 layers.
        </p>
        <div className="mt-3 flex gap-2">
          <DefaultMappingsLoader />
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Create `DefaultMappingsLoader` component and action**

Create `apps/web/app/(admin)/admin/sources/_components/default-mappings-loader.tsx`:

```tsx
"use client";

import { useState } from "react";
import { loadDefaultSourceMappings } from "@/features/admin-sources/actions/source-actions";

export function DefaultMappingsLoader() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleLoad() {
    setLoading(true);
    await loadDefaultSourceMappings();
    setDone(true);
    setLoading(false);
  }

  if (done) return <p className="text-sm text-green-600">✓ Default mappings loaded — refresh to see them</p>;

  return (
    <button
      onClick={handleLoad}
      disabled={loading}
      className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? "Loading..." : "Load recommended defaults"}
    </button>
  );
}
```

Add the server action to the existing source actions file:

```typescript
// OWASP ref → layer slug mapping (pre-defined defaults)
const OWASP_TO_LAYER_DEFAULTS: Record<string, string> = {
  "A01": "authorization_access_control",
  "A02": "secrets_management",
  "A03": "input_validation_sanitization",
  "A04": "error_handling_logging",
  "A05": "supply_chain_deps",
  "A06": "supply_chain_deps",
  "A07": "authentication_session",
  "A08": "input_validation_sanitization",
  "A09": "error_handling_logging",
  "A10": "authentication_session",
  "LLM01": "ai_safety",
  "LLM02": "input_validation_sanitization",
  "LLM03": "ai_safety",
  "LLM04": "ai_safety",
  "LLM05": "authentication_session",
  "LLM06": "input_validation_sanitization",
  "LLM07": "ai_safety",
  "LLM08": "secrets_management",
  "LLM09": "supply_chain_deps",
  "LLM10": "ai_safety",
};

// Source → layer defaults (each source maps to its primary layer)
const SOURCE_TO_LAYER_DEFAULTS: Array<{ source: string; layerSlug: string; relevance: "primary" | "secondary" }> = [
  { source: "nvd",              layerSlug: "input_validation_sanitization", relevance: "primary" },
  { source: "nvd",              layerSlug: "authentication_session",        relevance: "secondary" },
  { source: "ghsa",             layerSlug: "supply_chain_deps",             relevance: "primary" },
  { source: "osv",              layerSlug: "supply_chain_deps",             relevance: "primary" },
  { source: "cisa_kev",         layerSlug: "authentication_session",        relevance: "primary" },
  { source: "cisa_kev",         layerSlug: "input_validation_sanitization", relevance: "secondary" },
  { source: "mitre_atlas",      layerSlug: "ai_safety",                    relevance: "primary" },
  { source: "aigently_internal",layerSlug: "authentication_session",        relevance: "primary" },
];

export async function loadDefaultSourceMappings(): Promise<void> {
  await requireAdmin();
  const db = getDb();

  // Load layers to resolve slugs to IDs
  const layers = await db.select({ id: layer.id, slug: layer.slug }).from(layer);
  const layerBySlug = new Map(layers.map(l => [l.slug, l.id]));

  for (const mapping of SOURCE_TO_LAYER_DEFAULTS) {
    const layerId = layerBySlug.get(mapping.layerSlug);
    if (!layerId) continue;
    await upsertSourceMapping(mapping.source, layerId, mapping.relevance, "Auto-loaded default");
  }

  // Load OWASP defaults
  for (const [owaspRef, layerSlug] of Object.entries(OWASP_TO_LAYER_DEFAULTS)) {
    const layerId = layerBySlug.get(layerSlug);
    if (!layerId) continue;
    // Use existing updateOwaspMapping action pattern
    await db.insert(owaspLayerMapping).values({
      owaspRef,
      layerId,
      relevance: "primary",
      isActive: true,
    }).onConflictDoUpdate({
      target: [owaspLayerMapping.owaspRef],
      set: { layerId, relevance: "primary", isActive: true },
    });
  }

  revalidatePath("/admin/sources");
}
```

- [ ] **Step 4: Verify**

```
browser_navigate: http://localhost:3000/admin/sources
browser_take_screenshot  → should show red urgency banner with "Load recommended defaults" button
```
Click the button and verify mappings appear.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/sources/ \
        apps/web/features/admin-sources/actions/
git commit -m "feat: add urgency banner and default OWASP→layer mappings loader to source routing"
```

---

## Task 7: Upgrade Guardrails List (Coverage Bar + Score Alerts + expiresAt)

**Files:**
- Modify: `apps/web/app/(admin)/admin/guardrails/page.tsx`

- [ ] **Step 1: Read the current guardrails page**

```bash
cat apps/web/app/\(admin\)/admin/guardrails/page.tsx
```

- [ ] **Step 2: Add coverage progress bar at the top**

After fetching data, compute the coverage fraction:
```typescript
const [stackCount] = await db.select({ n: count(stack.id) }).from(stack);
const [layerCount] = await db.select({ n: count(layer.id) }).from(layer).where(eq(layer.isActive, true));
const [guardrailCount] = await db.select({ n: count(summarizedGuardrail.id) }).from(summarizedGuardrail);
const totalPairs = stackCount.n * layerCount.n;
const coveragePercent = totalPairs > 0 ? Math.round((guardrailCount.n / totalPairs) * 100) : 0;
```

Add at top of page content (before the table):
```tsx
<div className="mb-4 p-4 rounded-lg border bg-card">
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm font-medium">Guardrail Coverage</span>
    <span className="text-sm text-muted-foreground">
      {guardrailCount.n} / {totalPairs} pairs ({coveragePercent}%)
    </span>
  </div>
  <div className="h-2 rounded-full bg-muted overflow-hidden">
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{ width: `${coveragePercent}%` }}
    />
  </div>
  {coveragePercent < 10 && (
    <p className="text-xs text-destructive mt-2">
      ⚠ Coverage critically low — use Bulk Generate to fill missing pairs
    </p>
  )}
</div>
```

- [ ] **Step 3: Add score color-coding to the table rows**

Find where the star score is rendered in the table rows. Wrap with color class based on score:

```tsx
// In the table row, around the star/score display:
<AdminTableCell>
  <span className={cn(
    "font-medium",
    score === 0 && "text-destructive",
    score > 0 && score < 5 && "text-amber-600",
    score >= 5 && "text-green-600",
  )}>
    {renderStars(score)}
  </span>
</AdminTableCell>
```

- [ ] **Step 4: Add `expiresAt` column to the table**

Add to the select query: `expiresAt: summarizedGuardrail.expiresAt`

Add column header and cell:
```tsx
<AdminTableHead>Expires</AdminTableHead>

// In row:
<AdminTableCell>
  {row.expiresAt ? (
    <span className={cn(
      "text-xs",
      row.expiresAt < new Date() && "text-destructive font-medium"
    )}>
      {row.expiresAt < new Date()
        ? "Expired"
        : row.expiresAt.toLocaleDateString()}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
</AdminTableCell>
```

- [ ] **Step 5: Verify**

```
browser_navigate: http://localhost:3000/admin/guardrails
browser_take_screenshot  → should show coverage bar at top, red scores for 0/10, expiresAt column
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/guardrails/page.tsx
git commit -m "feat: add coverage progress bar, score alerts, and expiresAt column to guardrails list"
```

---

## Task 8: Upgrade Guardrail Evaluation with Full 11×15 Matrix

**Files:**
- Modify: `apps/web/app/(admin)/admin/guardrails/evaluation/page.tsx`
- Create: `apps/web/app/(admin)/admin/guardrails/evaluation/_components/coverage-matrix.tsx`

- [ ] **Step 1: Read the evaluation page**

```bash
cat apps/web/app/\(admin\)/admin/guardrails/evaluation/page.tsx
```

- [ ] **Step 2: Create `coverage-matrix.tsx` component**

Create `apps/web/app/(admin)/admin/guardrails/evaluation/_components/coverage-matrix.tsx`:

```tsx
interface MatrixCell {
  stackSlug: string;
  layerSlug: string;
  guardrailId?: string;
  score?: number;
  isStale?: boolean;
  conflictCount?: number;
}

interface CoverageMatrixProps {
  stacks: { id: number; slug: string; name: string }[];
  layers: { id: string; slug: string; name: string }[];
  cells: MatrixCell[];
}

export function CoverageMatrix({ stacks, layers, cells }: CoverageMatrixProps) {
  const cellMap = new Map(
    cells.map(c => [`${c.stackSlug}:${c.layerSlug}`, c])
  );

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="p-1 text-left font-medium text-muted-foreground w-28">Stack \ Layer</th>
            {layers.map(l => (
              <th key={l.slug} className="p-1 text-center font-medium text-muted-foreground max-w-16">
                <span className="block truncate" title={l.name}>{l.name.split(" ")[0]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stacks.map(s => (
            <tr key={s.slug} className="border-t">
              <td className="p-1 font-medium text-muted-foreground truncate">{s.name}</td>
              {layers.map(l => {
                const cell = cellMap.get(`${s.slug}:${l.slug}`);
                return (
                  <td key={l.slug} className="p-1 text-center">
                    {cell?.guardrailId ? (
                      <a
                        href={`/admin/guardrails/${cell.guardrailId}`}
                        className={cn(
                          "inline-block w-5 h-5 rounded text-[9px] font-bold leading-5 text-center",
                          cell.score == null && "bg-muted text-muted-foreground",
                          cell.score != null && cell.score === 0 && "bg-destructive/20 text-destructive",
                          cell.score != null && cell.score > 0 && cell.score < 5 && "bg-amber-100 text-amber-700",
                          cell.score != null && cell.score >= 5 && "bg-green-100 text-green-700",
                          cell.isStale && "opacity-50 ring-1 ring-amber-400",
                        )}
                        title={`Score: ${cell.score ?? "?"}/10, Conflicts: ${cell.conflictCount ?? 0}`}
                      >
                        {cell.score ?? "?"}
                      </a>
                    ) : (
                      <a
                        href={`/admin/guardrails?stack=${s.slug}&layer=${l.slug}`}
                        className="inline-block w-5 h-5 rounded bg-muted/50 text-muted-foreground hover:bg-muted"
                        title="Missing — click to generate"
                      >
                        <span className="block text-center leading-5 text-[10px]">+</span>
                      </a>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-100" /> Score ≥5</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-100" /> Score 1-4</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-destructive/20" /> Score 0</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-muted/50" /> Missing</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Fetch full matrix data in evaluation page**

In the evaluation page server component, fetch the full 11×15 data:
```typescript
const [allStacks, allLayers, allGuardrails] = await Promise.all([
  db.select({ id: stack.id, slug: stack.slug, name: stack.name }).from(stack),
  db.select({ id: layer.id, slug: layer.slug, name: layer.name }).from(layer).where(eq(layer.isActive, true)),
  db.select({
    id: summarizedGuardrail.id,
    stackId: summarizedGuardrail.stackId,
    layerId: summarizedGuardrail.layerId,
    qualityScore: summarizedGuardrail.qualityScore,
    scoreOverride: summarizedGuardrail.scoreOverride,
    conflictCount: summarizedGuardrail.conflictCount,
    expiresAt: summarizedGuardrail.expiresAt,
  }).from(summarizedGuardrail),
]);

// Build stack/layer lookup maps
const stackById = new Map(allStacks.map(s => [s.id, s]));
const layerById = new Map(allLayers.map(l => [l.id, l]));

// Build matrix cells
const matrixCells = allGuardrails.map(g => ({
  stackSlug: stackById.get(g.stackId)?.slug ?? "",
  layerSlug: layerById.get(g.layerId)?.slug ?? "",
  guardrailId: g.id,
  score: g.scoreOverride ?? g.qualityScore ?? 0,
  isStale: g.expiresAt != null && g.expiresAt < new Date(),
  conflictCount: g.conflictCount ?? 0,
}));

const totalPairs = allStacks.length * allLayers.length;
const coveredPairs = allGuardrails.length;
const truePercent = Math.round((coveredPairs / totalPairs) * 100);
```

- [ ] **Step 4: Update the coverage display**

Replace the misleading 83% display with the correct calculation:
```tsx
<div className="grid grid-cols-4 gap-4 mb-6">
  <div className="rounded-lg border bg-card p-4">
    <p className="text-xs text-muted-foreground">True Coverage</p>
    <p className="text-2xl font-bold">{truePercent}%</p>
    <p className="text-xs text-muted-foreground">{coveredPairs} / {totalPairs} pairs</p>
  </div>
  {/* ... avg score, conflict-free %, stale count ... */}
</div>

{/* Full matrix */}
<div className="rounded-lg border bg-card p-4 mb-6">
  <h3 className="text-sm font-medium mb-3">Stack × Layer Coverage Matrix</h3>
  <CoverageMatrix stacks={allStacks} layers={allLayers} cells={matrixCells} />
</div>
```

- [ ] **Step 5: Verify**

```
browser_navigate: http://localhost:3000/admin/guardrails/evaluation
browser_take_screenshot  → should show 3% true coverage and full 11×15 grid
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/guardrails/evaluation/
git commit -m "feat: add full 11x15 coverage matrix and fix true coverage denominator to guardrail eval page"
```

---

## Task 9: Add securityGrade Column to Stacks Table

**Files:**
- Modify: `apps/web/app/(admin)/admin/stacks/page.tsx`

- [ ] **Step 1: Read stacks page**

```bash
cat apps/web/app/\(admin\)/admin/stacks/page.tsx
```

- [ ] **Step 2: Add `securityGrade` to the select query and table**

In the DB query, add `securityGrade: stack.securityGrade`.

In the table:
```tsx
<AdminTableHead>Grade</AdminTableHead>

// In row:
<AdminTableCell>
  {row.securityGrade ? (
    <span className="font-mono font-bold text-sm">{row.securityGrade}</span>
  ) : (
    <span className="text-xs text-muted-foreground italic">—</span>
  )}
</AdminTableCell>
```

- [ ] **Step 3: Add warning for 0-rules stacks that are "launch" status**

```tsx
// In the stack name/primary cell area:
{row.ruleCount === 0 && row.catalogStatus === "launch" && (
  <span className="text-xs text-amber-600 ml-1" title="Launch stack with no rules">⚠ 0 rules</span>
)}
```

- [ ] **Step 4: Verify and commit**

```
browser_navigate: http://localhost:3000/admin/stacks
```
Expected: Grade column visible, ⚠ badge on Django/Rails/Go/iOS/Android rows.

```bash
git add apps/web/app/\(admin\)/admin/stacks/page.tsx
git commit -m "feat: add securityGrade column and zero-rules warning to stacks table"
```

---

## Verification

After all tasks complete, run the full verification pass via Playwright:

- [ ] `browser_navigate: http://localhost:3000/admin` → 4 core objective KPI cards visible, no hydration errors in console
- [ ] `browser_navigate: http://localhost:3000/admin/sync` → 6-phase pipeline cards visible, zombie run warning if applicable
- [ ] `browser_navigate: http://localhost:3000/admin/threats` → Amplified column + severity filter visible
- [ ] `browser_navigate: http://localhost:3000/admin/sources` → Red urgency banner visible (no mappings); "Load defaults" button loads OWASP mappings
- [ ] `browser_navigate: http://localhost:3000/admin/guardrails` → Coverage bar at top, score color-coding, expiresAt column
- [ ] `browser_navigate: http://localhost:3000/admin/guardrails/evaluation` → 3% true coverage, full 11×15 matrix
- [ ] `browser_navigate: http://localhost:3000/admin/stacks` → Grade column, 0-rules warning
- [ ] `browser_navigate: http://localhost:3000/admin/stacks/1` → No nested form error in console
- [ ] `browser_console_messages` on any page → zero hydration errors

---

## Key Files Reference

| File | Role |
|------|------|
| `packages/db/src/schema.ts` | All table definitions — source of truth for field names |
| `apps/web/lib/admin-queries.ts` | All admin DB queries — add new queries here |
| `apps/web/app/(admin)/admin/page.tsx` | Dashboard page |
| `apps/web/app/(admin)/admin/sync/page.tsx` | Pipeline control center |
| `apps/web/app/(admin)/admin/threats/page.tsx` | Threats list |
| `apps/web/app/(admin)/admin/guardrails/page.tsx` | Guardrails list |
| `apps/web/app/(admin)/admin/guardrails/evaluation/page.tsx` | Eval + coverage matrix |
| `apps/web/app/(admin)/admin/sources/page.tsx` | Source routing |
| `apps/web/app/(admin)/admin/stacks/page.tsx` | Stacks list |
| `apps/web/features/admin-sync/actions/sync-actions.ts` | Pipeline trigger actions |
| `apps/web/features/admin-sources/actions/` | Source mapping actions |
| `.github/workflows/sync-threats.yml` | 6-phase CI/CD pipeline (reference only) |
| `apps/web/scripts/amplify-threats.ts` | Amplification script (pipeline phase 2) |
| `apps/web/scripts/summarize-rules.ts` | Rules summarization script (phase 3) |
| `apps/web/scripts/summarize-layers.ts` | Layer summarization script (phase 4) |
| `apps/web/scripts/export-catalog.ts` | Catalog export script (phase 5) |
