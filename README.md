# Aigent.ly

**Security posture catalog for builders.** Monorepo for the marketing site, rule/threat browser, Fastify JSON API, catalog sync tooling, and PostgreSQL-backed data layer—all wired around OpenAPI-first boundaries.

---

## Monorepo layout

| Path | Role |
|------|------|
| [`apps/web`](apps/web) | Next.js 15 (App Router), Auth.js, Drizzle migrations & seed scripts |
| [`apps/api`](apps/api) | Fastify API, `/docs` Swagger UI, `/openapi.json` |
| [`apps/sync`](apps/sync) | Catalog sync into Postgres |
| [`packages/db`](packages/db) | Shared Drizzle schema types |
| [`packages/api-client`](packages/api-client) | Typed client generated from OpenAPI |
| [`packages/mvp-catalog`](packages/mvp-catalog) | Launch-stack + threat-ship helpers |
| [`packages/catalog-data`](packages/catalog-data) | Seed JSON, stack rule sources (e.g. Next.js `.mdc`) |
| [`specs/openapi.yaml`](specs/openapi.yaml) | Source OpenAPI document |
| [`tests/e2e`](tests/e2e) | Playwright smoke tests |

---

## Prerequisites

- **Node.js** 20.x or newer (LTS recommended; workspace uses Node 20 types in `web`)
- **npm** (lockfile: [`package-lock.json`](package-lock.json))
- **Docker** (for local PostgreSQL via Compose)

---

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start Postgres** (PostgreSQL 16; host port **5433** per [`docker-compose.yml`](docker-compose.yml))

   ```bash
   npm run db:up
   ```

3. **Configure environment**

   Copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env.local` and set at minimum `AUTH_SECRET`, GitHub OAuth keys if you use GitHub login, and `DATABASE_URL` (defaults in the example match Compose).

4. **Migrate and seed**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   For iterative catalog JSON work without wiping the whole catalog, use:

   ```bash
   npm run db:seed:upsert
   ```

5. **Run apps**

   - **Web:** `npm run dev` → [http://localhost:3000](http://localhost:3000)
   - **API (separate terminal):** `npm run dev:api` → default [http://127.0.0.1:4000](http://127.0.0.1:4000)

---

## API & OpenAPI

- **Swagger UI:** `http://127.0.0.1:4000/docs` (after `npm run dev:api`)
- **Raw spec JSON:** `http://127.0.0.1:4000/openapi.json`
- **Lint bundled spec:** `npm run openapi:lint`
- **Regenerate TS client:** `npm run codegen:api-client`

The API loads metadata from [`specs/openapi.yaml`](specs/openapi.yaml); keep it aligned with route handlers under [`apps/api/src/routes`](apps/api/src/routes).

---

## Common npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server (`web` workspace) |
| `npm run dev:api` | Fastify API in watch mode |
| `npm run build` | Build `web` then `api` |
| `npm run lint` | ESLint (`web`) |
| `npm run db:up` | `docker compose up -d` |
| `npm run db:migrate` | Drizzle migrate (`web`) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Full catalog seed / reset path |
| `npm run db:seed:upsert` | Upsert catalog + rules by slug |
| `npm run sync:catalog` | Run `apps/sync` pipeline |
| `npm run verify:local-api` | Smoke-check local API |
| `npm run test:e2e` | Playwright tests |

---

## Documentation

- [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) — catalog curation, seed modes, manual verification
- [`docs/API.md`](docs/API.md), [`docs/DATABASE.md`](docs/DATABASE.md) — deeper references as needed

---

## Contributing

See [Contributing](.github/CONTRIBUTING.md). PRs should keep OpenAPI, generated client, and route behavior in sync.

---

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
