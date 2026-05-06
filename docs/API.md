# HTTP API boundary (web ↔ Fastify)

## Overview

- **Contract:** [`specs/openapi.yaml`](../specs/openapi.yaml) (OpenAPI 3.1). CI validates it with Redocly (`npm run openapi:lint`).
- **Runtime:** `apps/api` (Fastify) serves `/v1/*`, `/docs` (Swagger UI), and `/documentation/json` (generated OpenAPI from registered routes + shared components).
- **Typed client:** `packages/api-client` (`openapi-typescript` + `openapi-fetch`). Regenerate after spec changes: `npm run codegen:api-client`.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `INTERNAL_API_URL` | `apps/web` (server only) | Base URL for RSC and Route Handlers to call the Fastify API over loopback or private network (e.g. `http://127.0.0.1:4000`). **Do not** put secrets in `NEXT_PUBLIC_*`. |
| `DATABASE_URL` | `apps/api` | Postgres for Drizzle repositories. |
| `PORT` / `HOST` | `apps/api` | Listen address (default `4000` / `0.0.0.0`). |
| `CORS_ORIGIN` | `apps/api` | Optional comma-separated allowlist for browser origins if you add client-side calls later. |

## Auth and cookies

Next.js continues to use **Auth.js** with the Drizzle adapter in `apps/web` until dedicated auth endpoints exist on the API.

For **session-bound reads** from the API (future `/v1/me/*`, etc.), server components should forward the browser cookie:

1. Use `createServerApiClient` from `@aigently/api-client`.
2. Pass `headers().get("cookie")` into the optional `cookieHeader` argument (see `apps/web/lib/server-api.ts`).

This keeps sessions on the web origin while still allowing the API to validate the session when those routes are implemented.

## CORS

Default API CORS mirrors Fastify’s `origin: true` when `CORS_ORIGIN` is unset (development-friendly). Production should set **`CORS_ORIGIN`** to explicit web origins if any browser code calls the API directly.

## Health checks

- **API liveness:** `GET /v1/health` → `{ "status": "ok" }`.
- **Next aggregate:** `GET /api/health` proxies to `INTERNAL_API_URL/v1/health` and does **not** run domain SQL.

## Deprecations

Domain entities (stacks, rules, threats) must not be queried from `apps/web` via Drizzle. Use the generated client and `/v1/*` only, so the OpenAPI file remains the single contract.
