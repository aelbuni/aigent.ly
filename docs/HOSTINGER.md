# Deploying Aigent.ly on Hostinger (Phase 0 + API)

## Two processes (web + API)

The product ships **two Node processes**: Next (`apps/web`) and Fastify (`apps/api`). Both need the same `DATABASE_URL` if the API reads domain data (Drizzle runs only in the API for domain routes).

| Process | Typical env | Start command (from repo root) |
|---------|----------------|----------------------------------|
| **Web** | `PORT` (Hostinger), `INTERNAL_API_URL`, `AUTH_*`, `DATABASE_URL` (Auth adapter only) | `npm run start -w web` → `next start -p ${PORT:-3000}` |
| **API** | `PORT` / `API_PORT` for listen port, `DATABASE_URL`, optional `CORS_ORIGIN` | `npm run start:prod -w api` or `node apps/api/dist/index.js` after `npm run build -w api` |

**`INTERNAL_API_URL`** on the web host should point at the API over loopback, e.g. `http://127.0.0.1:4000`, so RSC never calls the public internet for `/v1/*`.

Use a **process supervisor** (systemd, PM2, or Hostinger’s Node “custom start” with two apps) so both processes restart on failure.

## Node.js Web App (Git deploy)

1. Create a **PostgreSQL** database in hPanel and note host, port, database name, user, and password.
2. Set environment variables in Hostinger (see `apps/web/.env.example` and [API.md](./API.md)):
   - `DATABASE_URL` — `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
   - `AUTH_SECRET` — random 32+ bytes (e.g. `openssl rand -base64 32`)
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth app; set **Authorization callback URL** to `https://YOUR_DOMAIN/api/auth/callback/github`
   - `AUTH_URL` — `https://YOUR_DOMAIN`
   - `INTERNAL_API_URL` — e.g. `http://127.0.0.1:4000` (same host as the API process)
3. **Build command:** `npm ci && npm run build` (root builds **web and api** per `package.json`).
4. **Migrate before rollout:** `npm run db:migrate -w web` (Drizzle migrations; same `DATABASE_URL` the API uses) **before** switching traffic to the new build.
5. **Start commands:** start the **API** first, then the **web** app (web health checks assume the API is reachable at `INTERNAL_API_URL`).
6. Put **Nginx** (or Hostinger’s reverse proxy) in front of **only** the Next `PORT` for public HTTPS. The API can remain on loopback-only unless you intentionally expose it.

## VPS

Use the same env vars. Run `npm run db:migrate -w web` after deploy (or in a release script) with `DATABASE_URL` pointing at your Postgres instance. Put **Nginx** in front of `next start` on the loopback port Hostinger assigns or bind explicitly to `PORT`.
