# Platform Objectivity — Design Spec
**Date:** 2026-06-08  
**Status:** Approved  
**Scope:** Two targeted changes to surface data provenance and remove IDE-ordering bias

---

## Context

A first-time security-literate visitor has two immediate credibility concerns:

1. **Threat cards hide provenance.** A CISA KEV threat (confirmed active exploitation) looks identical to an OSV advisory. The platform's claim to be objective is undermined if the data's source and methodology are invisible.
2. **The composer defaults to Cursor.** The IDE selector order and homepage copy both list Cursor first, implying endorsement. An open-source platform that serves all IDEs equally should not visually privilege one.

---

## Change A — Source Chip with Methodology Tooltip

### Component: `apps/web/components/ui/source-chip.tsx`

A single reusable chip component. Props: `{ source: string; size?: "sm" | "md" }`.

**Source → display mapping:**

| `source` value | Label | Color class | Tooltip text |
|---|---|---|---|
| `cisa_kev` | `CISA KEV` | `bg-error/10 text-error border-error/30` | "CISA Known Exploited Vulnerabilities — confirmed active exploitation. Highest priority." |
| `nvd` | `NVD` | neutral surface | "NIST National Vulnerability Database — the authoritative CVE registry. Primary enrichment source." |
| `ghsa` | `GHSA` | neutral surface | "GitHub Security Advisories — maintainer-reported vulnerabilities for open-source packages." |
| `osv` | `OSV` | neutral surface | "Open Source Vulnerabilities — cross-ecosystem advisory database by Google." |
| `npm_audit` | `npm Audit` | neutral surface | "npm Audit — package-level vulnerability data from the npm registry." |
| `aigently` / other | `Aigently` | `bg-primary/10 text-primary border-primary/30` | "Aigently internal — curated threat not yet in a public CVE database." |

**Style pattern:** matches `EpssChip` exactly — `rounded-full border px-2.5 py-0.5 font-mono-label text-xs`. Tooltip via `title` attribute (no Radix dep). CISA KEV uses `bg-error/10 text-error` — factually justified since it is the confirmed-exploitation tier. All others are `bg-surface-container text-on-surface-variant`.

**Returns `null` for empty/unknown source** — no placeholder.

### Placement

Add `<SourceChip source={t.source} />` in the badge cluster on:
- `apps/web/app/(marketing)/threats/page.tsx` — inside each threat card's top-right badge row, after EPSS chip
- `apps/web/components/home/HomeLiveThreatFeed.tsx` — in the severity column alongside `SeverityBadge`
- `apps/web/app/(marketing)/stacks/[stack]/page.tsx` — on threat rows in the stack detail list

**ThreatFeedItem already carries `t.source`** — no type changes needed.

---

## Change B — IDE Selector Neutrality

### Reorder to alphabetical

Alphabetical is the only ordering with no implied endorsement.

New order: **Claude Code → Cline → Cursor → GitHub Copilot → Windsurf**

### Add neutral micro-copy

Below the IDE selector buttons, add one line:
> *"All IDEs receive the identical rules file — no IDE is preferred or required."*

### Files affected

| File | Change |
|---|---|
| `apps/web/scripts/seed.ts` (lines 507–511 and 637–641) | Update `sortOrder` for IDEs to alphabetical: Claude Code=1, Cline=2, Cursor=3, GitHub Copilot=4, Windsurf=5. Run `npx tsx scripts/seed.ts` after. |
| `apps/web/lib/home-marketing-content.ts` | Update `MCP_SECTION.ides` array from `["Cursor", "Claude Code", "Windsurf", "Copilot", "Cline"]` to `["Claude Code", "Cline", "Cursor", "GitHub Copilot", "Windsurf"]`. Also update `HERO.subcopy` and `JTBD_STEPS[0].body` which list "Cursor" first. |
| `apps/web/app/(marketing)/composer/page.tsx` | Update `metadata.description` — "Cursor, Claude Code, Windsurf, or Copilot" → "Claude Code, Cline, Cursor, GitHub Copilot, or Windsurf" |
| `apps/web/components/composer/ComposerPageClient.tsx` (line ~201) | Add neutral micro-copy below the IDE button grid: *"All IDEs receive the identical rules file — no IDE is preferred or required."* |

---

## Files to create/modify

```
NEW   apps/web/components/ui/source-chip.tsx
MOD   apps/web/app/(marketing)/threats/page.tsx
MOD   apps/web/components/home/HomeLiveThreatFeed.tsx
MOD   apps/web/app/(marketing)/stacks/[stack]/page.tsx
MOD   apps/web/app/(marketing)/composer/page.tsx
MOD   apps/web/lib/home-marketing-content.ts
MOD   apps/web/components/home/HomeMcpSection.tsx  (if needed)
```

---

## What is explicitly out of scope

- Radix tooltip — `title` attribute is sufficient for this iteration
- Admin threat list source column — already shows source as text; no change needed
- Any other objectivity signals (contributor counts, GitHub stars, last-sync timestamp) — deferred
- Mobile tooltip behavior — `title` doesn't fire on touch; acceptable for v1

---

## Verification

1. Visit `/threats` — every card shows a source chip; CISA KEV chips are red-tinted; hovering shows the tooltip text
2. Visit `/threats?stack=nextjs` — source chips still present on filtered view
3. Visit `/` → HomeLiveThreatFeed — source chips visible on homepage threat rows
4. Visit `/stacks/nextjs` — source chips on threat rows in stack detail
5. Visit `/composer` — IDE order is Claude Code → Cline → Cursor → GitHub Copilot → Windsurf; neutral micro-copy present
6. Run `npx tsc --noEmit -p apps/web/tsconfig.json` — zero errors
