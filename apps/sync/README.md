# Catalog sync (`apps/sync`)

Regenerates `apps/web/public/data/catalog.json` from public feeds (CISA KEV, OSV sample, optional GitHub Security Advisories).

## Commands

- From repo root: `npm run sync:catalog`
- Output path override: `CATALOG_OUT=/path/catalog.json`
- Cap KEV rows: `CATALOG_KEV_CAP=50` (default 40, max 500)

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `CISA_KEV_URL` | No | Override KEV JSON URL |
| `CATALOG_KEV_CAP` | No | Max KEV vulnerabilities to embed |
| `CATALOG_OSV_ECOSYSTEM` / `CATALOG_OSV_PACKAGE` | No | OSV.dev query defaults (`npm`, `next`) |
| `GITHUB_TOKEN` | No | Enables GHSA GraphQL sample in `syncMeta` |
| `NVD_API_KEY` | No | Reserved for future NVD enrichment |
| `DATABASE_URL` | No | Postgres connection |
| `CATALOG_UPSERT_DB` | No | Set to `1` with `DATABASE_URL` to upsert threats / `threat_stack`, append `sync_log`, and `REFRESH MATERIALIZED VIEW rule_weekly_usage` |

`apps/web/.env` is loaded automatically when present (for `DATABASE_URL` during local upsert tests).
