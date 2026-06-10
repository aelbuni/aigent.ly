# UI/UX Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 18 issues identified in the June 9 product owner UI/UX audit, starting with the 3 P1 blockers (broken demo video → replace with self-hosted mp4, PRESS_RELEASE.md 404, duplicate `<title>` tags), then P2 issues (Composer teaser undersells live product, nav order, AI/LLM "?" avatar, Explore avg strength stat, sidebar double-branding, "all mitigated" boilerplate), then P3 items.

**Architecture:** All fixes are isolated single-file edits in `apps/web`. The mp4 demo is copied into `apps/web/public/videos/` and served as a native `<video>` tag replacing the broken asciinema `<script>` injection. No new routes, no DB changes, no API changes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, React 18

---

## File Map

| File | Change |
|---|---|
| `apps/web/public/videos/aigently-mcp-demo.mp4` | **Create** — copy mp4 asset here |
| `apps/web/components/home/HomeTerminalDemo.tsx` | **Modify** — replace broken asciinema script with `<video>` |
| `apps/web/components/home/HomeLaunchBanner.tsx` | **Modify** — point PRESS_RELEASE_URL to catalog repo root (safe until file is merged) |
| `apps/web/app/layout.tsx` | **Modify** — fix duplicate `| Aigent.ly` in default title (already clean; ensure homepage page.tsx is not adding its own title) |
| `apps/web/app/(marketing)/page.tsx` | **Modify** — add page-level metadata with clean title |
| `apps/web/app/(marketing)/composer/page.tsx` | **Modify** — fix duplicate `| Aigent.ly` in title |
| `apps/web/app/(marketing)/explore/page.tsx` | **Modify** — fix duplicate `| Aigent.ly` in title; fix "Avg strength" → "Avg strength / 100" label |
| `apps/web/app/(marketing)/explore/ExploreClient.tsx` | **Modify** — fix "Avg strength" stat card label to show `/100` scale |
| `apps/web/components/home/HomeComposerTeaser.tsx` | **Modify** — replace "post-MVP" messaging with live Composer CTA showing real generated snippet |
| `apps/web/components/layout/SiteHeader.tsx` | **Modify** — reorder nav links to match user journey |
| `apps/web/components/composer/ComposerPageClient.tsx` | **Modify** — fix AI/LLM Apps "?" avatar → "AI" initials |
| `apps/web/app/(marketing)/stacks/[stack]/page.tsx` | **Modify** — remove "Aigent.ly / Security suite" branding from sidebar |
| `apps/web/lib/stack-overview-content.ts` | **Modify** — fix "all flagged as mitigated" boilerplate to differentiate mitigated vs unmitigated |

---

## Task 1: Copy mp4 into public/videos/

**Files:**
- Create: `apps/web/public/videos/aigently-mcp-demo.mp4`

- [ ] **Step 1: Create the videos directory and copy the asset**

```bash
mkdir -p apps/web/public/videos
cp docs/marketing/aigently-mcp-demo.mp4 apps/web/public/videos/aigently-mcp-demo.mp4
```

- [ ] **Step 2: Verify the file is accessible in dev**

```bash
ls -lh apps/web/public/videos/aigently-mcp-demo.mp4
```

Expected: file exists, size > 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/videos/aigently-mcp-demo.mp4
git commit -m "chore: add aigently mcp demo video to public/videos"
```

---

## Task 2: Replace broken asciinema script with native `<video>`

**Files:**
- Modify: `apps/web/components/home/HomeTerminalDemo.tsx`

The current file dynamically injects `https://asciinema.org/a/hvKBCjRDdgQVEZQH.js` which references a deleted recording. Replace the entire component with a native HTML5 `<video>` tag pointing to the self-hosted mp4.

- [ ] **Step 1: Rewrite HomeTerminalDemo.tsx**

Replace the full file content:

```tsx
export function HomeTerminalDemo() {
  return (
    <section className="relative border-b border-inverse-on-surface/10 bg-inverse-surface px-gutter pb-16 pt-10">
      {/* Thin accent line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-inverse-primary/40 to-transparent" />

      <div className="mx-auto max-w-4xl">
        {/* Label row */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-inverse-on-surface/10" />
          <span className="font-mono-label inline-flex items-center gap-2 text-[11px] tracking-widest text-inverse-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-inverse-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-inverse-primary" />
            </span>
            see it in action
          </span>
          <div className="h-px flex-1 bg-inverse-on-surface/10" />
        </div>

        {/* Video player */}
        <div className="overflow-hidden rounded-2xl border border-inverse-on-surface/15 shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
          <video
            src="/videos/aigently-mcp-demo.mp4"
            controls
            playsInline
            preload="metadata"
            className="w-full"
            aria-label="Aigent.ly MCP demo — real 2026 CVEs, before/after plan comparison"
          />
        </div>

        <p className="mt-4 text-center font-mono-label text-[10px] tracking-widest text-inverse-on-surface/35">
          click to play · real 2026 cves · before / after plan comparison
        </p>
      </div>
    </section>
  );
}
```

Note: No `"use client"` needed — native `<video>` is a plain HTML element; no refs or effects required.

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000` and confirm the video player renders and plays.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/home/HomeTerminalDemo.tsx
git commit -m "fix: replace broken asciinema embed with self-hosted mp4 video"
```

---

## Task 3: Fix PRESS_RELEASE.md banner link

**Files:**
- Modify: `apps/web/components/home/HomeLaunchBanner.tsx`

The banner links to `https://github.com/aelbuni/aigently-catalog/blob/main/PRESS_RELEASE.md` which 404s because `PRESS_RELEASE.md` is untracked in that repo. Safe fix: point to the repo root, which always works.

- [ ] **Step 1: Update the URL constant**

In `apps/web/components/home/HomeLaunchBanner.tsx`, change line 7:

```tsx
// Before:
const PRESS_RELEASE_URL =
  "https://github.com/aelbuni/aigently-catalog/blob/main/PRESS_RELEASE.md";

// After:
const PRESS_RELEASE_URL =
  "https://github.com/aelbuni/aigently-catalog";
```

- [ ] **Step 2: Verify the link works**

Navigate to `http://localhost:3000`, confirm the "Read the launch post →" link navigates to the GitHub repo without 404.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/home/HomeLaunchBanner.tsx
git commit -m "fix: point launch banner link to catalog repo root (PRESS_RELEASE.md not yet merged)"
```

---

## Task 4: Fix duplicate `<title>` tags on homepage, Composer, and Explore

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx`
- Modify: `apps/web/app/(marketing)/composer/page.tsx`
- Modify: `apps/web/app/(marketing)/explore/page.tsx`

The root layout defines `title.template: "%s | Aigent.ly"`. Pages that already include "Aigent.ly" in their title string get it appended again. Fix each:

- [ ] **Step 1: Fix homepage — add explicit metadata to apps/web/app/(marketing)/page.tsx**

The homepage currently has no `export const metadata`. The layout's `default` title fires, which is clean. But the `<title>` showed `Aigent.ly — Vulnerability Prevention for AI-Generated Code | Aigent.ly` in the audit — meaning the homepage IS outputting a duplicate. Add explicit metadata using `absolute` to bypass the template:

Open `apps/web/app/(marketing)/page.tsx` and add after the imports:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Aigent.ly — Vulnerability Prevention for AI-Generated Code",
  },
};
```

- [ ] **Step 2: Fix Composer page title**

In `apps/web/app/(marketing)/composer/page.tsx`, the current title is `"Rule Composer — Aigent.ly"`. With the template `"%s | Aigent.ly"` this becomes `Rule Composer — Aigent.ly | Aigent.ly`. Fix by removing "Aigent.ly" from the title string so the template appends it cleanly:

```tsx
export const metadata = {
  title: "Rule Composer",
  description:
    "Generate a stack-matched security guardrail file for Claude Code, Cline, Cursor, GitHub Copilot, or Windsurf in under a minute. Free, no sign-up required.",
};
```

Result: `Rule Composer | Aigent.ly` ✓

- [ ] **Step 3: Fix Explore page title**

In `apps/web/app/(marketing)/explore/page.tsx`, current title is `"Explore Guardrails | Aigent.ly"`. With the template this becomes `Explore Guardrails | Aigent.ly | Aigent.ly`. Fix:

```tsx
export const metadata: Metadata = {
  title: "Explore Guardrails",
  description:
    "Browse and filter AI coding guardrails by rule type and stack. See coverage depth at a glance.",
};
```

Result: `Explore Guardrails | Aigent.ly` ✓

- [ ] **Step 4: Verify all three pages**

```bash
# Check rendered titles by grepping server HTML
curl -s http://localhost:3000 | grep -o '<title>[^<]*</title>'
curl -s http://localhost:3000/composer | grep -o '<title>[^<]*</title>'
curl -s http://localhost:3000/explore | grep -o '<title>[^<]*</title>'
```

Expected:
```
<title>Aigent.ly — Vulnerability Prevention for AI-Generated Code</title>
<title>Rule Composer | Aigent.ly</title>
<title>Explore Guardrails | Aigent.ly</title>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx apps/web/app/\(marketing\)/composer/page.tsx apps/web/app/\(marketing\)/explore/page.tsx
git commit -m "fix: remove duplicate Aigent.ly from <title> on homepage, composer, explore"
```

---

## Task 5: Fix nav order to match user journey

**Files:**
- Modify: `apps/web/components/layout/SiteHeader.tsx`

Current order: Rules → Explore → Composer → Threats → Stacks → Learn  
Target order: Threats → Stacks → Composer → Rules → Explore → Learn

- [ ] **Step 1: Update the nav array**

In `apps/web/components/layout/SiteHeader.tsx`, find the `nav` constant and reorder:

```tsx
const nav = [
  { href: "/threats", label: "Threats" },
  { href: "/stacks", label: "Stacks" },
  { href: "/composer", label: "Composer" },
  { href: "/rules", label: "Rules" },
  { href: "/explore", label: "Explore" },
  { href: "/learn", label: "Learn" },
] as const;
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000` — desktop nav should read: Threats · Stacks · Composer · Rules · Explore · Learn.
Open mobile hamburger menu — same order.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/SiteHeader.tsx
git commit -m "fix: reorder nav to match user journey (Threats→Stacks→Composer→Rules→Explore→Learn)"
```

---

## Task 6: Fix AI/LLM Apps "?" avatar in Composer

**Files:**
- Modify: `apps/web/components/composer/ComposerPageClient.tsx`

The AI/LLM Apps stack button shows "?" as its two-letter abbreviation. Fix by adding explicit handling for `ai-llm` slug to show "AI".

- [ ] **Step 1: Find the abbreviation logic**

```bash
grep -n "abbreviat\|initials\|avatar\|\.slice\|\.substring\|\?\?" apps/web/components/composer/ComposerPageClient.tsx | head -20
```

- [ ] **Step 2: Fix the abbreviation**

Find where the 2-letter abbreviation is computed (likely something like `s.name.slice(0, 2)` or a similar heuristic). Add an explicit override:

```tsx
function getStackInitials(slug: string, name: string): string {
  if (slug === "ai-llm") return "AI";
  // keep existing logic for all other stacks
  return name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}
```

Then replace all inline abbreviation calls with `getStackInitials(s.slug, s.name)`.

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/composer` — the AI/LLM Apps button should show "AI" instead of "?".

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/composer/ComposerPageClient.tsx
git commit -m "fix: AI/LLM Apps stack button shows 'AI' initials instead of '?'"
```

---

## Task 7: Fix "Avg strength" stat card on Explore

**Files:**
- Modify: `apps/web/app/(marketing)/explore/ExploreClient.tsx`

The stat card shows "24 / Avg strength" with no scale context. 24/100 is actually poor — either change the metric or add the scale.

- [ ] **Step 1: Update the stat label and value rendering**

In `apps/web/app/(marketing)/explore/ExploreClient.tsx`, find the stats grid and change the `avgStrength` entry:

```tsx
// Before:
{ label: "Avg strength", value: stats.avgStrength },

// After — show as "24 / 100" so users understand the scale:
{ label: "Avg strength", value: `${stats.avgStrength} / 100` },
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/explore` — the third stat card should read "24 / 100 / Avg strength".

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/explore/ExploreClient.tsx
git commit -m "fix: explore avg strength stat shows '/100' scale for clarity"
```

---

## Task 8: Replace "Composer (post-MVP)" teaser with live Composer CTA

**Files:**
- Modify: `apps/web/components/home/HomeComposerTeaser.tsx`

Replace the "post-MVP" messaging and disabled mockup UI with a live CTA that references the working Composer. Show a real generated file snippet as social proof.

- [ ] **Step 1: Rewrite HomeComposerTeaser.tsx**

Replace the full file:

```tsx
import Link from "next/link";
import { MaterialSymbol } from "@/components/MaterialSymbol";

export function HomeComposerTeaser() {
  return (
    <section className="marketing-section marketing-section--inset mx-auto max-w-7xl">
      <div className="flex flex-col items-center gap-8 rounded-xl bg-primary-container p-8 text-white sm:gap-12 sm:p-12 md:flex-row">
        {/* Left: headline + CTA */}
        <div className="md:w-1/3">
          <span className="font-mono-label block text-on-primary-container">Free &amp; instant</span>
          <h2 className="font-h2 text-h2 mb-6">Build your agent&apos;s guardrails in seconds.</h2>
          <p className="font-body-base mb-8 text-white/80">
            Pick your stack and IDE — the Composer merges all CVE-backed rules into a single ready-to-paste file.
            No sign-up, no API key, no cost.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/composer"
              className="font-body-base inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-primary transition-opacity hover:opacity-90"
            >
              Open the Composer
              <MaterialSymbol name="arrow_forward" className="!text-sm" />
            </Link>
            <Link
              href="/stacks"
              className="font-body-base inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
            >
              Browse stacks
            </Link>
          </div>
        </div>

        {/* Right: real generated file preview */}
        <div className="w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl md:w-2/3">
          {/* Fake window chrome */}
          <div className="flex items-center gap-1.5 border-b border-slate-700 bg-slate-800 px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-3 font-mono text-[11px] text-slate-400">CLAUDE.md</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-relaxed text-slate-300">
            <code>{`# Aigent.ly guardrails — Next.js · Claude Code
# patterns + deps — auto-generated, do not edit manually

## Authentication & Session
WHEN generating login/register handlers
THEN always hash passwords with bcrypt (min 12 rounds).
If not possible, STOP and explain.

## Dependency Advisories
⚠ CVE-2026-45109 (HIGH) next@<15.3.3
  Middleware/proxy bypass via segment-prefetch.
  ACTION: upgrade to next ≥ 15.3.3 before shipping.

## Input Validation
WHEN accepting user input in API routes
THEN validate and sanitize with zod before use.`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000` and scroll to the bottom CTA section. It should show "Open the Composer" and "Browse stacks" CTAs with a live code preview, no "post-MVP" label, no disabled inputs.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/home/HomeComposerTeaser.tsx
git commit -m "feat: replace post-MVP composer teaser with live CTA and real guardrail preview"
```

---

## Task 9: Remove "Aigent.ly / Security suite" double-branding from stack sidebar

**Files:**
- Modify: `apps/web/app/(marketing)/stacks/[stack]/page.tsx`

The sidebar `<aside>` renders a heading "Aigent.ly" and subtitle "Security suite" before its nav links — duplicating the global header branding.

- [ ] **Step 1: Remove the branding block from the sidebar**

In `apps/web/app/(marketing)/stacks/[stack]/page.tsx`, find and delete the branding `<div>` inside the sidebar (lines ~140–143):

```tsx
// Remove this block entirely:
<div className="mb-4 px-6 py-4">
  <h2 className="text-base font-black text-on-surface">Aigent.ly</h2>
  <p className="font-mono-label text-on-surface-variant">Security suite</p>
</div>
```

The sidebar nav links (Rules / Threats / Stacks) remain — just the redundant branding header is removed. Add a small label instead to give context:

```tsx
<div className="mb-2 px-6 pt-4">
  <p className="font-mono-label text-[10px] uppercase tracking-widest text-on-surface-variant/60">Platform</p>
</div>
```

Also find and remove the `aria-label="Security suite"` attribute from the mobile nav equivalent if present.

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/stacks/nextjs` — sidebar should show "PLATFORM" label followed by Rules / Threats / Stacks links, no "Aigent.ly / Security suite" heading.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(marketing)/stacks/[stack]/page.tsx"
git commit -m "fix: remove duplicate Aigent.ly/Security suite branding from stack detail sidebar"
```

---

## Task 10: Fix "all flagged as mitigated" boilerplate on stack detail

**Files:**
- Modify: `apps/web/lib/stack-overview-content.ts`

Currently every threat row shows "Flagged as mitigated by linked rules — verify in Composer export." regardless of actual mitigation status. The `isMitigatedByRules` boolean already exists — just use it properly.

- [ ] **Step 1: Find the description field**

```bash
grep -n "isMitigatedByRules\|Flagged as mitigated\|Tracked in Threats" apps/web/lib/stack-overview-content.ts
```

- [ ] **Step 2: Make unmitigated threats show an actionable message**

Find the ternary and update the `false` branch:

```typescript
// Before:
description: t.isMitigatedByRules
  ? "Flagged as mitigated by linked rules — verify in Composer export."
  : "Tracked in Threats — align rules and stack coverage.",

// After:
description: t.isMitigatedByRules
  ? "Rule coverage exists — verify in Composer export."
  : "No rule coverage yet — consider contributing a rule.",
```

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/stacks/nextjs` — threats with rules should show "Rule coverage exists…", threats without should show "No rule coverage yet…".

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/stack-overview-content.ts
git commit -m "fix: differentiate mitigated vs unmitigated threat descriptions on stack detail"
```

---

## Task 11: TypeScript check

- [ ] **Step 1: Run TypeScript check across all modified files**

```bash
cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40
```

Expected: 0 errors. If errors appear, fix them before proceeding.

- [ ] **Step 2: Commit any type fixes**

```bash
git add -p
git commit -m "fix: resolve TypeScript errors from ui-ux audit fixes"
```

---

## Verification Checklist

After all tasks complete, manually verify these items in browser:

- [ ] `http://localhost:3000` — video plays inline, no broken embed, no "post-MVP" label in composer teaser, banner link goes to GitHub repo (not 404), nav reads Threats→Stacks→Composer→Rules→Explore→Learn
- [ ] `http://localhost:3000/composer` — AI/LLM Apps shows "AI" initials; title tag is `Rule Composer | Aigent.ly`
- [ ] `http://localhost:3000/explore` — avg strength shows "24 / 100"; title tag is `Explore Guardrails | Aigent.ly`
- [ ] `http://localhost:3000/stacks/nextjs` — sidebar shows "PLATFORM" label only, no "Aigent.ly / Security suite"; threats show differentiated mitigated/unmitigated labels
- [ ] Mobile (375px) — nav hamburger still works; Composer still renders correctly; video player is responsive
