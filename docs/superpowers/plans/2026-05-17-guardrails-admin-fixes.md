# Guardrails Admin Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three issues in the guardrails admin: (1) Regen button doesn't refresh the page after action, (2) guardrails list needs stack/layer filter, (3) generated guardrail content must use numbered sections aligned between aigently-v1 pipeline and aigently-catalog so individual layers can be composed/deselected.

**Architecture:** Task 1 is a two-line fix — add `router.refresh()` after the server action resolves. Task 2 adds a `stackSlug`/`layerSlug` filter param to `listGuardrails` and a filter bar UI. Task 3 changes the LLM prompt to emit numbered section headers (`## 1. AUTH_SESSION — Authentication & Session`) so individual sections can be extracted and composed by slug in the Composer.

**Tech Stack:** Next.js 15 App Router, React `useTransition` + `useRouter`, Drizzle ORM, Sonner toasts, TypeScript.

---

## File Map

| File | Change |
|------|--------|
| `apps/web/app/(admin)/admin/guardrails/evaluation/_regen-button.tsx` | Add `useRouter` + `router.refresh()` after action resolves |
| `apps/web/app/(admin)/admin/guardrails/_regen-row-button.tsx` | Same fix |
| `apps/web/lib/admin-queries.ts` | Add `stackSlug?` + `layerSlug?` filter to `listGuardrails()` |
| `apps/web/app/(admin)/admin/guardrails/page.tsx` | Add filter bar (stack + layer dropdowns), pass filter to query |
| `apps/web/lib/summarizer/prompt.ts` | Change `buildSummarizerPrompt` to emit numbered section header `## {N}. {LAYER_SLUG_UPPER} — {layerName}` |

---

## Task 1: Fix Regen button — add `router.refresh()` after action

**Files:**
- Modify: `apps/web/app/(admin)/admin/guardrails/evaluation/_regen-button.tsx`
- Modify: `apps/web/app/(admin)/admin/guardrails/_regen-row-button.tsx`

**Root cause:** `scoreAndRegenerate` calls `revalidatePath()` on the server. But when a server action is invoked via client-side JS (not `<form action>`), Next.js doesn't automatically push the cache invalidation to the client. `router.refresh()` is required to pull the fresh data into the current page.

- [ ] **Step 1: Fix `_regen-button.tsx`**

Replace the full file content:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scoreAndRegenerate } from "@/features/admin-guardrails/actions/guardrail-actions";

export function RegenButton({
  guardrailId,
  defaultScore,
}: {
  guardrailId: string;
  defaultScore?: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const scoreVal = fd.get("overrideScore");
    const parsed = scoreVal ? Number(scoreVal) : undefined;
    const score = parsed !== undefined && !isNaN(parsed) ? parsed : undefined;

    startTransition(() => {
      toast.promise(
        scoreAndRegenerate(guardrailId, score).then(() => router.refresh()),
        {
          loading: "Regenerating guardrail…",
          success: "Guardrail regenerated",
          error: (err) => `Regen failed: ${err instanceof Error ? err.message : "unknown error"}`,
        }
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center justify-end gap-2">
      <input
        type="number"
        name="overrideScore"
        min="0"
        max="10"
        placeholder="0–10"
        defaultValue={defaultScore ?? ""}
        className="w-16 h-8 rounded border border-stroke bg-gray-2 px-2 text-xs text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="h-8 rounded bg-primary px-3 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "…" : "Regen"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Fix `_regen-row-button.tsx`**

Replace the full file content:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scoreAndRegenerate } from "@/features/admin-guardrails/actions/guardrail-actions";
import { RefreshCw } from "lucide-react";

export function RegenRowButton({ guardrailId }: { guardrailId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(() => {
      toast.promise(
        scoreAndRegenerate(guardrailId).then(() => router.refresh()),
        {
          loading: "Regenerating…",
          success: "Guardrail regenerated",
          error: (err) => `Regen failed: ${err instanceof Error ? err.message : "unknown error"}`,
        }
      );
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-dark-6 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
      title="Regenerate"
    >
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
      <span className="sr-only">Regenerate</span>
    </button>
  );
}
```

- [ ] **Step 3: Build verify**

```bash
cd /Users/aelbuni/Projects/aelbuni/aigently-v1 && npm run build -w web 2>&1 | tail -5
```

Expected: clean build, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(admin\)/admin/guardrails/evaluation/_regen-button.tsx \
        apps/web/app/\(admin\)/admin/guardrails/_regen-row-button.tsx
git commit -m "fix: add router.refresh() to regen buttons so page updates after server action"
```

---

## Task 2: Add stack/layer filter to guardrails list page

**Files:**
- Modify: `apps/web/lib/admin-queries.ts` — `listGuardrails()` function (lines 323–357)
- Modify: `apps/web/app/(admin)/admin/guardrails/page.tsx` — add filter bar + pass params

### Step 2a: Update `listGuardrails` to accept filters

- [ ] **Step 1: Update `listGuardrails` signature and query**

In `apps/web/lib/admin-queries.ts`, replace the `listGuardrails` function:

```ts
export async function listGuardrails(params: {
  page: number;
  perPage: number;
  stackSlug?: string;
  layerSlug?: string;
}) {
  const { page, perPage, stackSlug, layerSlug } = params;
  const offset = (page - 1) * perPage;

  const conditions = [];
  if (stackSlug) conditions.push(eq(stack.slug, stackSlug));
  if (layerSlug) conditions.push(eq(layer.slug, layerSlug));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: summarizedGuardrail.id,
        stackId: summarizedGuardrail.stackId,
        stackSlug: stack.slug,
        stackName: stack.name,
        layerId: summarizedGuardrail.layerId,
        layerSlug: layer.slug,
        layerName: layer.name,
        ideSlug: summarizedGuardrail.ideSlug,
        summarizerVersion: summarizedGuardrail.summarizerVersion,
        conflictCount: summarizedGuardrail.conflictCount,
        generatedAt: summarizedGuardrail.generatedAt,
        expiresAt: summarizedGuardrail.expiresAt,
        cacheKey: summarizedGuardrail.cacheKey,
        content: summarizedGuardrail.content,
        sourceRuleIds: summarizedGuardrail.sourceRuleIds,
        qualityScore: summarizedGuardrail.qualityScore,
        scoreOverride: summarizedGuardrail.scoreOverride,
        scoreNote: summarizedGuardrail.scoreNote,
      })
      .from(summarizedGuardrail)
      .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
      .innerJoin(layer, eq(summarizedGuardrail.layerId, layer.id))
      .where(where)
      .orderBy(desc(summarizedGuardrail.generatedAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: count() })
      .from(summarizedGuardrail)
      .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
      .innerJoin(layer, eq(summarizedGuardrail.layerId, layer.id))
      .where(where),
  ]);
  return { rows, total: total.count };
}
```

Note: `and` is already imported at the top of `admin-queries.ts`. Verify it's in the drizzle-orm import line; if not, add it.

- [ ] **Step 2: Update `guardrails/page.tsx` to accept + pass filter params**

Change the `searchParams` type and data fetch at the top of `GuardrailsPage`:

```tsx
export default async function GuardrailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; stack?: string; layer?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const stackFilter = params.stack?.trim() || undefined;
  const layerFilter = params.layer?.trim() || undefined;

  const [{ rows, total }, allStacks, allLayers] = await Promise.all([
    listGuardrails({ page, perPage: 25, stackSlug: stackFilter, layerSlug: layerFilter }),
    db.select({ id: stack.id, slug: stack.slug, name: stack.name }).from(stack).orderBy(stack.sortOrder),
    db.select({ id: layer.id, slug: layer.slug, name: layer.name }).from(layer).orderBy(layer.sortOrder),
  ]);
```

- [ ] **Step 3: Add filter bar above the guardrails table**

After `<BulkGeneratePanel />` and before `{/* Guardrails table */}`, insert:

```tsx
      {/* Filter bar */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-dark-6 text-xs font-medium">Filter by stack</label>
          <select
            name="stack"
            defaultValue={stackFilter ?? ""}
            className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-9 min-w-[160px] rounded border px-3 text-sm outline-none"
          >
            <option value="">All stacks</option>
            {allStacks.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-dark-6 text-xs font-medium">Filter by layer</label>
          <select
            name="layer"
            defaultValue={layerFilter ?? ""}
            className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-9 min-w-[180px] rounded border px-3 text-sm outline-none"
          >
            <option value="">All layers</option>
            {allLayers.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="border-stroke bg-white text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white h-9 rounded border px-4 text-sm font-medium"
        >
          Filter
        </button>
        {(stackFilter || layerFilter) && (
          <a
            href="/admin/guardrails"
            className="text-dark-6 hover:text-primary h-9 flex items-center text-sm"
          >
            Clear
          </a>
        )}
      </form>
```

- [ ] **Step 4: Build verify**

```bash
cd /Users/aelbuni/Projects/aelbuni/aigently-v1 && npm run build -w web 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin-queries.ts \
        apps/web/app/\(admin\)/admin/guardrails/page.tsx
git commit -m "feat: add stack/layer filter to guardrails admin list"
```

---

## Task 3: Numbered section headers in guardrail prompt

**Goal:** Each guardrail section must start with `## {N}. {LAYER_SLUG_UPPER} — {layerName}` so individual layer sections can be identified, extracted, and composed or deselected in the Composer. This aligns the aigently-v1 output format with the aigently-catalog pipeline section numbering convention.

**Files:**
- Modify: `apps/web/lib/summarizer/prompt.ts` — `buildSummarizerPrompt` function

The layer taxonomy order (used as the canonical section number) is:
```
1  auth_session
2  authz_access
3  input_validation
4  secrets_credentials
5  dependency_supply
6  data_privacy
7  api_security
8  database
9  infrastructure
10 caching_cdn
11 frontend_network
12 observability
13 resilience
14 ai_safety
15 code_quality
```

- [ ] **Step 1: Add layer order constant to `prompt.ts`**

At the top of `apps/web/lib/summarizer/prompt.ts`, after the imports, add:

```ts
const LAYER_ORDER: Record<string, number> = {
  auth_session: 1, authz_access: 2, input_validation: 3, secrets_credentials: 4,
  dependency_supply: 5, data_privacy: 6, api_security: 7, database: 8,
  infrastructure: 9, caching_cdn: 10, frontend_network: 11, observability: 12,
  resilience: 13, ai_safety: 14, code_quality: 15,
};
```

- [ ] **Step 2: Update `buildSummarizerPrompt` to include numbered section header in the prompt instructions**

In `buildSummarizerPrompt`, change rule #5 (the comment block instruction) and add a new rule for the section header. The layer is singular here (one layer per call from `runSummarizerForLayer`).

Replace the `YOUR TASK:` block in the prompt (the string starting with `YOUR TASK:` through the end of the numbered rules) with:

```ts
  const layerN = layers.length === 1 ? (LAYER_ORDER[layers[0]!.slug] ?? 0) : 0;
  const sectionHeader = layers.length === 1
    ? `## ${layerN}. ${layers[0]!.slug.toUpperCase()} — ${layers[0]!.name}`
    : `## MULTI — ${layerNames}`;
```

Then inside the template string, replace the old rules block:

```
YOUR TASK:
Write a single, unified guardrail rule for the ${layerNames} layer(s) of a ${stack.name} project.
Keep the guardrail to 400 words maximum.

Rules:
1. Write as direct instructions TO the AI coding assistant (imperative voice)
2. Cover all unique concerns — name the specific CWE-NNN or CVE each directive addresses, not just "injection"
3. Be specific — name exact functions, packages, patterns to avoid or prefer
4. Use WHEN/THEN structure for context-dependent directives
5. Open with a comment block:
   # aigently: ${stack.slug}-${layers.map((l) => l.slug).join("+")}-guardrails v1.0 [summarized]
   # Merged from ${sourceRuleIds.length} rules
   # Protects: ${allCwes.length ? allCwes.join(", ") : "multiple threat vectors"}
6. End with a DO NOT section listing the most dangerous patterns
```

With:

```ts
`YOUR TASK:
Write a single, unified guardrail rule for the ${layerNames} layer(s) of a ${stack.name} project.
Keep the guardrail to 400 words maximum.

Rules:
1. Write as direct instructions TO the AI coding assistant (imperative voice)
2. Cover all unique concerns — name the specific CWE-NNN or CVE each directive addresses, not just "injection"
3. Be specific — name exact functions, packages, patterns to avoid or prefer
4. Use WHEN/THEN structure for context-dependent directives
5. Start the output with EXACTLY this section header (no changes):
   ${sectionHeader}
   Then on the next line, a comment block:
   # aigently: ${stack.slug}-${layers.map((l) => l.slug).join("+")}-guardrails v1.0 [summarized]
   # Merged from ${sourceRuleIds.length} rules
   # Protects: ${allCwes.length ? allCwes.join(", ") : "multiple threat vectors"}
6. End with a DO NOT section listing the most dangerous patterns`
```

The full updated `buildSummarizerPrompt` function after these changes:

```ts
export function buildSummarizerPrompt(
  atoms: DirectiveAtom[],
  layers: LayerInfo[],
  stack: StackInfo,
  previousScore?: number,
): string {
  const layerNames = layers.map((l) => l.name).join(" + ");
  const concerns = layers.map((l) => l.concernStatement).join("; ");
  const sourceRuleIds = unique(atoms.map((a) => a.sourceRuleId));
  const allCwes = unique(atoms.flatMap((a) => a.cweRefs));
  const conflicted = atoms.filter((a) => a.conflictResolution === "conflict_resolved");

  const layerN = layers.length === 1 ? (LAYER_ORDER[layers[0]!.slug] ?? 0) : 0;
  const sectionHeader = layers.length === 1
    ? `## ${layerN}. ${layers[0]!.slug.toUpperCase()} — ${layers[0]!.name}`
    : `## MULTI — ${layerNames}`;

  return `You are a principal security engineer synthesizing guardrail rules for AI coding assistants.

STACK: ${stack.name}
LAYER(S): ${layerNames}
CONCERN: ${concerns}

You have been given ${atoms.length} directive atoms extracted from ${sourceRuleIds.length} community-contributed rules.

DIRECTIVE ATOMS:
${atoms.map((a) => `[${a.severity.toUpperCase()}] ${a.content} (Source: ${a.sourceRuleId}${a.cweRefs.length ? `, CWE: ${a.cweRefs.join(", ")}` : ""})`).join("\n")}

${conflicted.length > 0 ? `CONFLICTS RESOLVED:\n${conflicted.map((a) => `- "${a.content}" was chosen over conflicting variant (reason: higher severity)`).join("\n")}\n` : ""}
YOUR TASK:
Write a single, unified guardrail rule for the ${layerNames} layer(s) of a ${stack.name} project.
Keep the guardrail to 400 words maximum.

Rules:
1. Write as direct instructions TO the AI coding assistant (imperative voice)
2. Cover all unique concerns — name the specific CWE-NNN or CVE each directive addresses, not just "injection"
3. Be specific — name exact functions, packages, patterns to avoid or prefer
4. Use WHEN/THEN structure for context-dependent directives
5. Start the output with EXACTLY this section header (no changes):
   ${sectionHeader}
   Then on the next line, a comment block:
   # aigently: ${stack.slug}-${layers.map((l) => l.slug).join("+")}-guardrails v1.0 [summarized]
   # Merged from ${sourceRuleIds.length} rules
   # Protects: ${allCwes.length ? allCwes.join(", ") : "multiple threat vectors"}
6. End with a DO NOT section listing the most dangerous patterns

Output the guardrail text only — no preamble, no markdown fencing, no explanation.${previousScore !== undefined && previousScore < 8 ? `

QUALITY FEEDBACK (previous score: ${previousScore}/10):
This guardrail needs improvement. Address the following before rewriting:
${previousScore <= 3 ? "- Content is too sparse — expand with specific WHEN/THEN patterns citing each CWE by number." : ""}
${atoms.filter((a) => a.conflictResolution === "conflict_resolved").length > 2 ? "- High conflict count — merge overlapping directives into one clear stance per topic." : ""}
${unique(atoms.map((a) => a.sourceRuleId)).length < 2 ? "- Thin coverage — ensure every atom's CWE is addressed with a named code pattern." : ""}
Target: 8/10 or higher. Write with specificity, completeness, and zero redundancy.` : ""}`.trim();
}
```

- [ ] **Step 3: Build verify**

```bash
cd /Users/aelbuni/Projects/aelbuni/aigently-v1 && npm run build -w web 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/summarizer/prompt.ts
git commit -m "feat: add numbered section headers to guardrail prompt (## N. LAYER_SLUG — Name)"
```

---

## Notes on aigently-catalog alignment

The aigently-catalog pipeline (`pipeline/scripts/summarize-rules.ts`) produces cluster-based output per stack using attack-vector themes. The section number convention from this plan (`## 1. AUTH_SESSION — Authentication & Session`) is the aigently-v1 canonical format. When the catalog pipeline is updated to match, it should use the same `LAYER_ORDER` mapping above and the same `## {N}. {SLUG_UPPER} — {Name}` header format. The section numbers are stable identifiers — they do not change when layers are added or reordered.

**Section extraction pattern** (for the Composer to filter/deselect layers):
```ts
// Split composed guardrail into sections by the numbered header pattern
const sections = content.split(/(?=^## \d+\. [A-Z_]+ — )/m);
// Filter to selected layers
const selected = sections.filter(s => selectedLayerSlugs.some(slug =>
  s.startsWith(`## ${LAYER_ORDER[slug]}. ${slug.toUpperCase()}`)
));
```

This is for future Composer work — not part of this plan.
