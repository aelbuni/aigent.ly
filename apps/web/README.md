# apps/web

Next.js 15 (App Router) — the marketing site and admin dashboard for [aigent.ly](https://aigent.ly).

## Routes

| Group | URL prefix | What it is |
|-------|-----------|------------|
| Marketing | `/` `/stacks` `/threats` `/composer` `/explore` `/rules` `/learn` | Public-facing pages |
| Admin | `/admin/*` | Protected dashboard (GitHub OAuth + DB role check) |
| API (internal) | `/api/*` | Server actions and admin stream endpoints |

## Local dev

```bash
# From repo root
npm install
cp apps/web/.env.example apps/web/.env
# Fill in DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY
npm run db:setup   # starts Postgres, migrates, seeds
npm run dev        # http://localhost:3000
```

## CSS / styling

- **Marketing** — `app/(marketing)/site.css` (Material-style design tokens)
- **Admin** — `app/(admin)/admin.css` (NextAdmin layout, scoped to admin route group)

Restart `npm run dev` after changing `next.config.ts` or layout CSS files.

## Key directories

```
app/(marketing)/    # Public pages — threats, stacks, composer, explore, rules
app/(admin)/admin/  # Admin dashboard pages
components/
  home/             # Homepage sections (Hero, MCP, JTBD, StatBand, etc.)
  composer/         # Rule Composer client component
  nextadmin/        # Admin UI framework (AdminDataTable, AdminPageHeader, etc.)
lib/
  admin-queries.ts          # All admin DB queries
  catalog-from-db.ts        # All public DB queries
  composer-export.ts        # Guardrail file builder
  home-marketing-content.ts # Homepage copy (single source of truth)
scripts/            # Pipeline scripts (sync, amplify, summarize, export)
```

## Build

```bash
npm run build -w web   # production build
npm run start -w web   # serve production build (stop dev first)
```
