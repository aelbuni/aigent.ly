# Aigent.ly Engineering Rules

This file is loaded by Claude Code at the start of every session. Follow all rules here exactly.

---

## Project Skill

The full engineering context (architecture, schema, pipeline, patterns) is in `.claude/skills/aigently-project/SKILL.md`. Read it before making any non-trivial change.

---

## Admin UI: Framework Fidelity Rule

**Always compose admin pages exclusively from the next-shadcn-dashboard-starter component library.**

Before building any admin page or component:
1. Check `apps/web/components/nextadmin/admin-data-table.tsx` — `AdminDataTable`, `AdminTableHead`, `AdminTableCell`, `AdminPrimaryCell`, `AdminStatusPill`, `AdminRowActions`, `AdminDeleteButton`, `AdminEmptyState`
2. Check `apps/web/components/nextadmin/admin-page-header.tsx` — `AdminPageHeader`, `AdminPrimaryButton`, `AdminSearchForm`, `AdminSearchInput`, `AdminPagination`
3. Use shadcn/ui primitives for anything else: `apps/web/components/ui/`

**Design tokens — use these exact strings:**
```
Card:    "rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark"
Value:   "text-heading-5 font-bold text-dark dark:text-white"
Label:   "text-sm font-medium text-dark-6"
Green:   text-[#219653]  (success, active, amplified)
Amber:   text-[#FFA70B]  (warning, needs action)
Red:     text-[#D34053]  (critical, error, score 0)
Blue:    text-[#3C50E0]  (primary, medium, progress fill)
```

**Never write raw HTML layout (`<div className="rounded-lg border bg-card">`) where a framework component or token exists.**

---

## Admin Queries Rule

**Add all admin DB queries to `apps/web/lib/admin-queries.ts`.** Do not scatter queries across page files.

---

## Coverage Denominator Rule

**Guardrail coverage denominator = `allStacksCount × allActiveLayersCount` (Cartesian product).**

Never use distinct rule-covered pairs or stacks-with-threats as the denominator. That produces inflated percentages (the 83% bug).

---

## Schema Rules (v2)

**`threat.aiAmplification` is `jsonb`, not `text`.** Pass raw objects — never `JSON.stringify()`. Drizzle handles serialisation. To display in a form textarea, use `JSON.stringify(value, null, 2)`.

**`stackSubmission` onboarding uses typed columns**, not a JSONB blob:
```typescript
// Read: sub.stepStackCreated, sub.stepLogoUploaded, sub.stepRulesAssigned,
//       sub.stepThreatsSynced, sub.stepCoverageFilled, sub.stepPublished
// Write: db.update(stackSubmission).set({ stepStackCreated: true })
```

**`syncLog.phaseSummary`** (was `sourceSummary` — Drizzle field renamed, DB column unchanged).

**`layer` has no `publicId`** — `slug` is the only external identifier.

**Do not re-add:** `ruleLayerEnum`, `threat.details`, `rule.complexity`, `ruleSeverityTag`, `stackCoverageArea`, `stackFrameworkFeature`, `article.bodyMdx`. These were dropped in v2 as dead code.

---

## Client Component Rule

**Use `useTransition` for server action loading states in client components.** Never use `useState(isLoading)` for this purpose.

```tsx
"use client";
const [isPending, startTransition] = useTransition();
<Button disabled={isPending} onClick={() => startTransition(async () => { await myAction(); })}>
```

---

## Form Rules

1. **Never nest `<form>` inside `<form>`.** Save and Delete forms must be siblings, not nested.
2. **Never nest `<Link>` inside `<Link>` (or `<a>` inside `<Link>`).** Next.js `<Link>` renders as `<a>`, so nesting produces invalid HTML and React hydration errors.

---

## TypeScript Rule

**Run `npx tsc --noEmit -p apps/web/tsconfig.json` before every commit.** Zero errors required.

---

## Four Core Objectives

Every change to the admin UI or pipeline should advance at least one of:

1. **Threats Amplified** — `threat.aiAmplification` populated for all threats
2. **Threats Summarized** — `summarizedGuardrail` rows covering all stack×layer pairs
3. **Threats Scored** — avg `qualityScore` ≥ 7/10 across all guardrails
4. **Evals Passing** — `conflictCount = 0` for ≥ 80% of guardrails

When in doubt about whether a change is worth making, ask: "Does this advance any of the four objectives?"

---

## Pipeline Phase Map

```
Phase 1: npm run sync:threats       → Fetch CVEs (NVD, GHSA, CISA KEV, OSV)
Phase 2: npm run amplify:threats    → AI amplification per threat
Phase 3: npm run summarize:rules    → AI rule clustering
Phase 4: npm run summarize:layers   → AI guardrail generation per stack×layer
Phase 5: npm run export:catalog     → JSON snapshot export
Phase 6: git commit+push            → Publish to aigently-catalog repo
```

Triggered daily at 06:00 UTC via `.github/workflows/sync-threats.yml`. Individual phases can be triggered from `/admin/sync` (queued via server actions) or run locally with `npx tsx apps/web/scripts/<phase>.ts`.

---

## Source Routing Must Be Configured

`apps/web/app/(admin)/admin/sources/` — if `sourceLayerMapping` table is empty, **no threats will be assigned to layers during sync**. This cascades to zero guardrail coverage for all layers except manually assigned ones.

After any DB reset or new environment setup: go to `/admin/sources` → "Load recommended defaults".

---

## Composer Export Rule

**The Composer export runs inside `apps/web` — no external API service required.**

`postComposerExportAction` in `apps/web/app/actions/api-data.ts` calls `@/lib/composer-export` directly (Drizzle → DB). Do NOT add back an HTTP call to `INTERNAL_API_URL` for the export endpoint. The `apps/api` Fastify service is only needed locally for admin summarizer stream and health check — it is not deployed to production.

---

## Stack Catalog Status Rule

**Only set `catalogStatus = 'launch'` when a stack has summarized guardrails.** The 6 launch stacks are: nextjs, express, fastapi, nestjs, nuxt, react-spa. Django, Rails, Go, iOS, Android are `coming_soon` — no rules exist for them yet.

When a new stack is added:
1. Set `catalogStatus = 'coming_soon'` initially
2. Seed rules (`apps/web/scripts/seed.ts`)
3. Run `MODE=all npm run summarize:layers` to generate guardrails
4. Only then flip to `catalogStatus = 'launch'`

---

## Layer Assignment Rule

**Deps rules (`-security-deps-v*`) must only be assigned to `dependency_supply`.** Never assign them to `auth_session`. Cross-assigning floods the auth guardrail with package version advisories instead of session/auth patterns.

```typescript
// In seed.ts — keep this separation:
const patternLayers = ["auth_session", "input_validation", "authz_access", "secrets_credentials"];
const depsLayers = ["dependency_supply"]; // NOT auth_session
```

---

## Guardrail Prompt Rule

**Guardrail prompts must use WHEN/THEN/ELSE behavioral contracts, not passive reminders.**

- BAD: "ALWAYS use parameterized queries."
- GOOD: "WHEN generating any SQL query, THEN use parameterized syntax. If not possible, STOP and explain."

After any change to `apps/web/lib/summarizer/prompt.ts`, run `MODE=all npm run summarize:layers` to regenerate all guardrails.

---

## Admin Auth Rule

**Admin is protected by GitHub OAuth + DB role check.** `ADMIN_BYPASS` must be `false` in production.

- `ADMIN_BYPASS=true` in `.env` bypasses all auth (local dev only — never deploy with this)
- Role = 'admin' required in the `user` DB table
- To grant admin: `UPDATE "user" SET role = 'admin' WHERE email = '...'`
- The bypass is safe only when `NODE_ENV !== 'production'` — the middleware enforces this

---

## Key Files

```
apps/web/lib/admin-queries.ts              # All admin DB queries
apps/web/lib/catalog-from-db.ts            # All marketing/public DB queries (incl. composer export)
apps/web/lib/composer-export.ts            # Composer file builder (no API dependency)
apps/web/components/nextadmin/             # Admin UI framework
packages/db/src/schema.ts                  # DB schema (source of truth for column names)
apps/web/features/admin-*/actions/         # Server actions (one dir per entity)
apps/web/scripts/seed.ts                   # Rule + layer assignment seeding
apps/web/lib/summarizer/prompt.ts          # Guardrail summarizer prompts
.github/workflows/sync-threats.yml         # Daily pipeline
.claude/skills/aigently-project/SKILL.md   # Full engineering context
```
