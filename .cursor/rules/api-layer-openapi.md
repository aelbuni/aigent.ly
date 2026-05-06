---
description: Domain data and mutations go through an OpenAPI HTTP API with Swagger docs; no direct DB access from the Next app.
alwaysApply: true
---

# API layer and OpenAPI (principal standard)

## Non-negotiables

1. **No direct database access from `apps/web` for domain logic**  
   Do not import Drizzle/`db` or run SQL from Next.js pages, layouts, route handlers, or shared UI components for **rules, threats, stacks, articles, reviews, usage, or any product entity**. Those concerns live in the **HTTP API service** (`apps/api` or the repo’s designated API package).

2. **Contract-first**  
   Every versioned backend operation is defined in an **OpenAPI 3.x** document (committed YAML/JSON or machine-generated from Zod with an equivalent exported spec). Request/response bodies and error shapes must match the published components/schemas.

3. **Swagger documentation**  
   The API process must expose **machine-readable OpenAPI** (e.g. `/openapi.json`) and **Swagger UI** (e.g. `/docs`) for local/staging; production may gate `/docs` behind auth or disable it per security policy, but the **spec artifact** stays in-repo and up to date with code.

4. **Single typed client**  
   The web app consumes the API only through a **generated typed client** (`openapi-typescript` + `openapi-fetch`, Orval, or equivalent) from the same spec—avoid one-off `fetch('/v1/...')` without going through that client layer.

5. **Repository pattern inside the API**  
   Drizzle (or any ORM) appears **behind** small repository modules called from route handlers—not from handlers as 200-line inline queries. One operation ↔ one handler ↔ one repo method where practical.

## Transitional note (Auth.js)

Next.js may still use a database adapter for **Auth.js session/user** tables until those flows are moved behind auth APIs. **Do not** extend that exception to new domain features—new tables and reads/writes for product data go through the OpenAPI API.

## When adding a feature

- Add or extend the OpenAPI path + schemas first (or generate and export spec in the same PR).  
- Implement the handler in the API + repository.  
- Regenerate the client package and use it from `apps/web`.  
- Update Swagger if route metadata changes.

## Anti-patterns

- `import { db } from '@/lib/db'` inside `apps/web/app/**` for domain entities.  
- Undocumented JSON responses not reflected in the OpenAPI spec.  
- “Temporary” Server Actions that mutate Postgres for product data without an API contract.
