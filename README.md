# Aigent.ly — Web Application

**Private.** This is the hosted web application that runs [aigent.ly](https://aigent.ly).

The open-source CVE catalog, pipeline, and MCP server live in the public repo:
→ **[github.com/aelbuni/aigently-catalog](https://github.com/aelbuni/aigently-catalog)**

---

## What Aigent.ly does

Aigent.ly injects live CVE-backed security guardrails into AI coding IDEs (Cursor, Claude Code, Windsurf, Copilot). The MCP server is free, open-source, and requires no API key. The pipeline pulls from NVD, GHSA, CISA KEV, OSV, and npm Audit daily — so your IDE enforces this week's security rules, not last year's training data.

---

## Monorepo layout

| Path | Role |
| --- | --- |
| [`apps/web`](apps/web) | Next.js 15 App Router — marketing site + admin dashboard |
| [`apps/api`](apps/api) | Fastify API — public REST endpoints + Swagger UI |
| [`packages/db`](packages/db) | Shared Drizzle ORM schema (PostgreSQL) |
| [`packages/api-client`](packages/api-client) | TypeScript client generated from OpenAPI spec |
| [`packages/mvp-catalog`](packages/mvp-catalog) | Stack registry + threat-ship helpers |
| [`packages/catalog-data`](packages/catalog-data) | Seed JSON — synced from the public catalog repo |
| [`specs/openapi.yaml`](specs/openapi.yaml) | Source OpenAPI document |
| [`tests/e2e`](tests/e2e) | Playwright smoke tests |

---

## Prerequisites

- **Node.js** 20.x or newer
- **npm** (lockfile: [`package-lock.json`](package-lock.json))
- **Docker** (for local PostgreSQL via Compose)

---

## Quick start

```bash
npm install
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env — set DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY
npm run db:setup   # starts Postgres, migrates, seeds from packages/catalog-data/
npm run dev        # http://localhost:3000
npm run dev:api    # http://127.0.0.1:4000 (separate terminal)
```

See [`apps/web/.env.example`](apps/web/.env.example) for all environment variables.

### Local dev vs production server

Do **not** run `npm run dev` and `npm run start` at the same time in the same checkout. Both use `apps/web/.next`; dev overwrites static assets while `next start` keeps serving HTML that references old hashed CSS/JS files (network **400** on `/_next/static/*`).

- **Development:** `npm run dev` only → http://localhost:3000
- **Production-like test:** `npm run build -w web` then `npm run start -w web` (stop dev first)

### Marketing site vs admin dashboard CSS

- **Public site** — `apps/web/app/(marketing)/site.css` (Material-style tokens)
- **Admin** — `apps/web/app/(admin)/admin.css` (NextAdmin layout, scoped to the `(admin)` route group)

---

## Data pipeline

Rules are generated from live CVE data by the 6-phase pipeline in the public catalog repo. Phases run daily at 06:00 UTC via GitHub Actions.

| Phase | Script | What it does |
| --- | --- | --- |
| 1 | `sync:threats` | Fetches CVEs from NVD, GHSA, CISA KEV, OSV, npm Audit |
| 2 | `amplify:threats` | Claude generates ALWAYS/NEVER patterns per CVE |
| 3 | `summarize:rules` | Claude clusters CVEs into themed security rules |
| 4 | `synthesize:guardrails` | Claude generates per-stack guardrail summaries |
| 5 | `export:catalog` | Queries DB → writes JSON snapshots |
| 6 | `git commit+push` | Publishes to the public catalog repo |

Each stack gets two rule types:

| Rule type | Slug pattern | Covers |
| --- | --- | --- |
| **Patterns** | `{stack}-security-patterns-v1` | ALWAYS/NEVER safe-coding directives |
| **Deps** | `{stack}-security-deps-v1` | WARN/CONFIRM/CHECK dependency guidance |

---

## Admin access

Protected by GitHub OAuth + DB role check. Set `role = 'admin'` for your user row. `ADMIN_BYPASS=true` in `.env` skips auth in local dev — never deploy with this.

---

## Open-source catalog

The public sibling repo contains everything the community needs:

- **`packages/catalog-data/`** — JSON snapshots of threats, rules, guardrails, stacks
- **`packages/mcp-server/`** — `@aigently/mcp-server` on npm, free and keyless
- **`pipeline/`** — the full ingest → amplify → synthesize → export pipeline

→ [github.com/aelbuni/aigently-catalog](https://github.com/aelbuni/aigently-catalog)
