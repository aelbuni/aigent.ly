# Aigent.ly — Web Application

**Private.** This is the hosted web application that runs [aigent.ly](https://aigent.ly).

The open-source CVE catalog and pipeline live in the separate public repo:
→ **[github.com/aelbuni/aigently-catalog](https://github.com/aelbuni/aigently-catalog)**

---

## Monorepo layout

| Path | Role |
|---|---|
| [`apps/web`](apps/web) | Next.js 15 (App Router), Auth.js, rule browser UI |
| [`apps/api`](apps/api) | Fastify API, `/docs` Swagger UI, `/openapi.json` |
| [`apps/sync`](apps/sync) | Internal catalog sync orchestration |
| [`packages/db`](packages/db) | Shared Drizzle schema types |
| [`packages/api-client`](packages/api-client) | Typed client generated from OpenAPI |
| [`packages/mvp-catalog`](packages/mvp-catalog) | Launch-stack + threat-ship helpers |
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
# Edit apps/web/.env — set AUTH_SECRET (openssl rand -base64 32)
npm run db:setup   # starts Postgres, migrates, seeds from packages/catalog-data/
npm run dev        # http://localhost:3000
npm run dev:api    # http://127.0.0.1:4000 (separate terminal)
```

See [`apps/web/.env.example`](apps/web/.env.example) for all environment variables.

### Local dev vs production server

Do **not** run `npm run dev` and `npm run start` at the same time in the same checkout. Both use `apps/web/.next`; dev overwrites static assets while `next start` keeps serving HTML that references old hashed CSS/JS files, which shows up as an unstyled page (network **400** on `/_next/static/*`).

- **Development:** `npm run dev` only → http://localhost:3000
- **Production-like test:** `npm run build -w web` then `npm run start -w web` (stop dev first)

If Next prints `Port 3000 is in use… using 3001`, kill the process on 3000 (`lsof -ti :3000 | xargs kill`) instead of browsing the wrong port.

### Marketing site vs admin dashboard CSS

The App Router uses separate route groups so styles do not mix:

- **Public site** — [`apps/web/app/(marketing)/site.css`](apps/web/app/(marketing)/site.css) (Material-style tokens, SiteHeader/Footer)
- **Admin** — [`apps/web/app/(admin)/admin.css`](apps/web/app/(admin)/admin.css) (NextAdmin layout/CSS, scoped to the `(admin)` route group only)

`/admin` does not render the marketing header. Restart `npm run dev` after changing `next.config.ts` or layout CSS files.

---

## Data pipeline & rule generation

### How rules are built

Rules are generated programmatically from CVE/threat data, not hand-authored. Each of the 6 launch stacks gets two rule types:

| Rule type | Slug pattern | Covers |
|---|---|---|
| **Patterns** | `{stack}-security-patterns-v1` | ALWAYS/NEVER safe-coding directives from CVE amplification |
| **Deps** | `{stack}-security-deps-v1` | WARN/CONFIRM/CHECK dependency upgrade guidance |

Each rule is assigned to multiple security layers:
- **Patterns rules** → Authentication & Session, Input Validation, Authorization & Access Control, Secrets & Credentials
- **Deps rules** → Dependency & Supply Chain, Authentication & Session

### Running the full pipeline locally

```bash
cd apps/web

# 1. Sync latest CVEs from NVD, GHSA, OSV, CISA KEV
npm run sync:threats

# 2. Amplify threats with AI (generates ALWAYS/NEVER patterns per CVE)
npm run amplify:threats

# 3. Regenerate rule bodies from current threat data and layer assignments
SEED_MODE=upsert npx tsx scripts/seed.ts

# 4. Generate AI guardrails for all stack×layer pairs (calls Claude)
MODE=all npm run summarize:layers

# 5. Export updated catalog to packages/catalog-data/ JSON
npm run export:catalog
```

After step 3 you can also run `npx tsx scripts/fix-rule-layers.ts` to reassign existing rules to the correct layers without a full seed.

### Rule-layer assignment logic (seed.ts)

Rules are only generated for the 6 LAUNCH stacks (nextjs, express, fastapi, nestjs, nuxt, react-spa). The `COMING_SOON` stacks (django, rails, go, ios, android) are seeded into the DB but have no rules until promoted.

```
LAUNCH_STACK_SLUGS = stacks where catalogStatus === "launch"
```

To promote a stack from `coming_soon` to `launch`: update `catalogStatus` in `packages/mvp-catalog/src/stack-registry.ts`, then run the full pipeline.

### Seeding catalog data from the public repo

This repo does not run the CVE pipeline — that lives in the public catalog repo. To get fresh catalog data locally, either:

- Pull the latest `packages/catalog-data/` JSON from the catalog repo and run `npm run db:seed:upsert`
- Or run the pipeline scripts directly from [`aelbuni/aigently-catalog`](https://github.com/aelbuni/aigently-catalog) against the same local Postgres instance

---

## API & OpenAPI

- **Swagger UI:** `http://127.0.0.1:4000/docs` (after `npm run dev:api`)
- **Raw spec JSON:** `http://127.0.0.1:4000/openapi.json`
- **Lint spec:** `npm run openapi:lint`
- **Regenerate TS client:** `npm run codegen:api-client`

Keep [`specs/openapi.yaml`](specs/openapi.yaml) aligned with route handlers under [`apps/api/src/routes`](apps/api/src/routes).

---

## Common npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run dev:api` | Fastify API in watch mode |
| `npm run build` | Build `web` then `api` |
| `npm run lint` | ESLint (`web`) |
| `npm run db:up` | `docker compose up -d` |
| `npm run db:setup` | Start Postgres + migrate + seed (one-shot) |
| `npm run db:migrate` | Drizzle migrate |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Full catalog seed from `packages/catalog-data/` JSON |
| `npm run db:seed:upsert` | Non-destructive upsert |
| `npm run verify:local-api` | Smoke-check local API |
| `npm run test:e2e` | Playwright smoke tests (desktop) |
| `npm run test:e2e:responsive` | Marketing layout checks at mobile, tablet, and desktop viewports |

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, features, data flows (start here)
- [`docs/API.md`](docs/API.md) — API reference
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema and migration notes

---

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
