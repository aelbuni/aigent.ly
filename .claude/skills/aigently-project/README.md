# Aigent.ly Project Skill

Engineering context for the `aigently-v1` monorepo — loaded automatically when working on this project.

## What this skill covers

- **Architecture** — monorepo structure, app boundaries, public vs private repos
- **Data pipeline** — 6-phase daily CVE sync (sync → amplify → summarize → score → export)
- **Database schema** — all key tables, column names, junction tables
- **Admin UI rules** — next-shadcn-dashboard-starter patterns, design tokens, component library
- **4 core objectives** — threats amplified, summarized, scored, evals passing
- **Operational runbook** — how to onboard a stack, generate guardrails, fix low scores, clear zombie runs
- **Critical bugs to avoid** — nested `<a>`, nested `<form>`, wrong coverage denominator

## Quick Reference

| Question | Answer |
|----------|--------|
| Where are admin pages? | `apps/web/app/(admin)/admin/` |
| Where are DB queries? | `apps/web/lib/admin-queries.ts` |
| Where are server actions? | `apps/web/features/admin-*/actions/` |
| What's the admin UI framework? | `apps/web/components/nextadmin/` |
| How do I add a new admin feature? | Read `admin-data-table.tsx` first, compose from existing components |
| Why are guardrail counts low? | Source routing has no mappings — go to `/admin/sources` |
| What's the pipeline trigger? | `.github/workflows/sync-threats.yml` (daily 06:00 UTC) |
| How do I run a pipeline phase locally? | `npx tsx apps/web/scripts/<phase>.ts` |

## Installation

This skill is already in the project at `.claude/skills/aigently-project/`. Claude Code picks it up automatically.
