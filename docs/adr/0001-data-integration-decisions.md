# ADR 0001: Threat identity, catalog delivery, composed rulesets

## Status

Accepted (implementation baseline).

## Context

[data-integration-prd.md](../../data-integration-prd.md) requires external threat ingestion, richer UI data, and optional user-saved composer output.

## Decisions

1. **Threat keys** — Keep `threat.public_id` as the **primary key** and FK target for `rule_threat_map.threat_id`. Add **`external_id` UNIQUE** (nullable until backfilled) as the **upsert key** for OSV/GHSA/NVD rows. Add optional **`cve_id`** for display when `public_id` is not a CVE (e.g. internal `SLOP-SQT-11`). Curated rows use `source = 'aigently'` and may set `external_id = public_id` after backfill.

2. **Sync cadence** — **One-time / manual** regeneration via GitHub Actions **`workflow_dispatch`**. Primary artifact is **versioned `catalog.json`** committed or produced for the app. **Daily `cron`** is deferred. Optional same-job **Postgres upsert** when `DATABASE_URL` is present in CI.

3. **`composed_ruleset`** — **Deferred** until “My Library” + stable auth UX; no table in v1 schema slice (can add in a follow-up migration).

4. **Static catalog in app** — API and/or Next load **`catalog.json`** (path via `CATALOG_JSON_PATH` or default under repo) when serving read-only catalog slices, merging with DB where both exist (DB wins on conflict for same `public_id`).

## Consequences

- Migrations must **backfill** `external_id` from `public_id` for existing seeded threats before enforcing NOT NULL if we tighten later.
- OpenAPI `Threat` gains optional fields mirroring new columns; clients remain backward compatible.
