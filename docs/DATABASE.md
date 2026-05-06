# Database migrations (Drizzle Kit)

Canonical schema: `packages/db/src/schema.ts` (re-exported from `apps/web/lib/db/schema.ts`).  
Generated migrations: `apps/web/drizzle/` (committed).

## Local

1. **Start Postgres first.** From repo root: `docker compose up -d` (or `npm run db:up`). Default in `docker-compose.yml`: host **localhost**, port **5433**, user/password/db **aigently**. If `db:migrate` or `db:seed` fails with **`ECONNREFUSED`**, Postgres is not running or `DATABASE_URL` does not match that host/port.
2. Copy env: `cp apps/web/.env.example apps/web/.env` and set `AUTH_SECRET` (and GitHub keys if testing sign-in). `drizzle-kit` and `scripts/seed.ts` load **`apps/web/.env`** explicitly.
3. Apply schema: `npm run db:migrate -w web`.

## Commands

| Command | Description |
|---------|-------------|
| `npm run db:generate -w web` | After editing `schema.ts`, generate a new SQL migration under `drizzle/`. |
| `npm run db:migrate -w web` | Apply pending migrations to `DATABASE_URL`. |
| `npm run db:studio -w web` | Open Drizzle Studio (local dev). |
| `npm run db:seed -w web` | Seed reference `stack` / `ide` rows (optional). |

## CI / Hostinger

Run `db:migrate` with production `DATABASE_URL` **before** `next start` for that release. See `.github/workflows/db-migrate.yml` for a GitHub Actions pattern (use repository secrets for `DATABASE_URL`).
