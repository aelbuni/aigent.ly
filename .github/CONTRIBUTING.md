# Contributing

## Unlocking a “coming soon” stack

Stacks marked **coming soon** need more **verified** CVE (or real GHSA) rows before we ship posture and rules.

1. Gather advisories with stable IDs (`CVE-YYYY-NNNNN` or real `GHSA-xxxx-xxxx-xxxx`) and HTTPS `sourceUrl` values.
2. Open a PR that extends `packages/catalog-data/seed-master.json` and `seed-threat-stack.json` (or the sync pipeline that feeds them), then re-run `npm run db:seed`.
3. Ensure each new rule maps to those threats via `rule_threat_map` and that rule MDX uses `### Prevents CVE-…` sections with actionable NEVER/ALWAYS guidance.

See also the in-app guide: `/contributing`.

## Catalog guardrail fields (`seed-master.json`)

Threat rows drive composite stack rules (`{stackSlug}-security-guardrails-v1`) via `apps/web/scripts/seed.ts`.

Optional curator fields (all backward-compatible):

| Field | Purpose |
|--------|---------|
| `ruleContext` | Short paragraph for the printed **Context:** line (prefer over long `description` blobs). |
| `mustLines` | Array of short imperative strings; each becomes **`MUST: …`** in the rule body. If omitted, `ruleHint` becomes **`MUST apply vendor guidance: …`**. |
| `alwaysPin` | Overrides the **ALWAYS use patched version:** line; otherwise derived from `affectedProducts[].patchedVersions`. |

**Next.js** still uses hand-authored `packages/catalog-data/nextjs-cursor-security.mdc`; other launch stacks use the generator.

### Applying catalog changes to PostgreSQL

- **`npm run db:seed`** — Full reset of catalog-related tables (threats, rules, stacks in catalog set), then insert. Use for clean dev DBs.
- **`npm run db:seed:upsert`** — Upserts stacks/threats and **updates rule rows by `slug`** (including `body_mdx`), reconciles `rule_threat_map` so removed threats drop off the composite rule. Use when iterating on JSON without wiping the whole catalog.

You can also set `SEED_MODE=upsert` when running `tsx scripts/seed.ts`.

**Ordering:** If you use `apps/sync` to refresh threats, run sync before seed when both touch the same data, or rely on seed’s upsert path for threats.

### AI-assisted curation

When using an LLM to draft `ruleContext` / `mustLines` / `alwaysPin`, constrain output to facts present in each threat row (no invented CVEs or versions). Merge via PR after `JSON.parse` validation.

## Manual verification (Playwright MCP, localhost)

After `npm run db:seed` (or `db:seed:upsert`) and `npm run dev`, use Cursor **user-playwright** MCP (read tool schemas under the project MCP descriptors first):

1. Open `/rules` — counts and filters behave; no duplicate cards per slug.
2. Open `/rules/fastapi-security-guardrails-v1` — **Rule body** shows Raw | Preview; Preview renders headings and lists.
3. Open `/rules/nextjs-security-guardrails-v1` — same toggle behavior.
4. Load `/rules/fastapi-security-guardrails-v1?view=preview` — starts in Preview.

Requires Chromium/Chrome for MCP (`npx playwright install chromium` if needed).
