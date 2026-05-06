# Aigent.ly — Full Product Build Prompt
## Security-First AI Coding Rules Directory for Vibe Coders
### Community-Powered · Open Source · OWASP + MITRE ATLAS Integrated
### Version 1.0

---

## MISSION & PRODUCT VISION

Build **Aigent.ly** — the definitive open-source, community-powered directory where developers
find, copy, and compose security guardrail prompts for their AI coding tool of choice.

**The core insight driving this product:**
> Vibe coding is here to stay. 45% of AI-generated code ships with security vulnerabilities.
> 35 CVEs were created by AI coding tools in March 2026 alone. Developers need a tool that
> turns security expertise into copy-paste prompt rules — making secure coding the path of
> least resistance, not the path of most effort.

A developer selects their **stack** (e.g. Next.js) and their **IDE** (e.g. Cursor), and gets:
1. A curated set of security guardrail rules ready to paste into their IDE
2. A visual map of which CVEs and OWASP vulnerabilities those rules protect against
3. Community ratings, reviews, and real-world usage reports on each rule set
4. A live feed of emerging AI vulnerabilities relevant to their stack

**Who this is for**: AI Engineers, developers using vibe coding tools (Cursor, Claude Code,
Windsurf, Copilot, Cline), solo founders shipping fast, and junior developers who don't have
a senior security engineer on their team.

**Aigent.ly's role**: Curator, annotator, and trusted authority. All rule sets are reviewed
by the Aigent.ly team before being marked "Certified". Community can submit and review.

---

## TECH STACK — USE EXISTING OSS, DO NOT REINVENT

```
Framework         Next.js 15 (App Router, TypeScript strict)
Styling           Tailwind CSS v4  ← utility-first, zero custom CSS unless absolutely needed
Components        shadcn/ui        ← install via CLI, use as-is
Icons             Lucide React     ← already bundled with shadcn/ui
Fonts             Geist via next/font/google (fallback: Inter)
Code highlight    Shiki            ← github-light / github-dark, server-side rendering
Search            Fuse.js          ← client-side fuzzy search across all entries
URL state         nuqs             ← URL-synced filters, shareable/bookmarkable
Markdown/MDX      next-mdx-remote  ← rule descriptions and articles
Animations        Framer Motion    ← entrance animations and page transitions only
Copy to clip      usehooks-ts useClipboard  ← no custom implementation
Database          PostgreSQL 15+  ← Hostinger-managed or VPS; single source of truth for users, reviews, usage
ORM               Drizzle ORM     ← type-safe queries; schema as code in `lib/db/schema.ts`
Schema migrations drizzle-kit     ← `generate` → versioned SQL + journal; `migrate` in CI/deploy; best fit with Drizzle for long-term schema growth
Auth              Auth.js (v5)    ← sessions in DB; OAuth: GitHub (required), Google optional
Server mutations  Next.js Server Actions + Zod  ← reviews, helpful votes, copy metrics, profile (no ad-hoc REST unless needed)
Ratings / reviews Server Actions → PostgreSQL  ← replaces localStorage for durable community data
Toast notifs      sonner           ← already in shadcn/ui ecosystem
Analytics         Plausible or Cloudflare Web Analytics  ← Hostinger-friendly; avoid vendor lock-in where possible
Deployment        Hostinger        ← Node.js Web App or VPS; DATABASE_URL to PostgreSQL
```

### shadcn/ui components — install all at project start:
```bash
npx shadcn@latest init
npx shadcn@latest add button badge card input select separator sheet
npx shadcn@latest add command dialog drawer tabs toggle tooltip
npx shadcn@latest add avatar progress skeleton alert scroll-area
npx shadcn@latest add dropdown-menu popover accordion collapsible
npx shadcn@latest add table pagination hover-card
```

---

## PROJECT STRUCTURE

```
aigently/
├── app/
│   ├── layout.tsx                      # Root layout: nav, footer, analytics
│   ├── page.tsx                        # Homepage
│   ├── rules/
│   │   ├── page.tsx                    # Rules directory — main listing page
│   │   └── [slug]/
│   │       └── page.tsx                # Rule detail page
│   ├── threats/
│   │   ├── page.tsx                    # Threat intelligence dashboard
│   │   └── [id]/page.tsx               # Individual CVE/vulnerability detail
│   ├── stacks/
│   │   └── [stack]/page.tsx            # Stack-specific security overview page
│   ├── composer/
│   │   └── page.tsx                    # Rule Composer (interactive builder)
│   ├── learn/
│   │   ├── page.tsx                    # Articles and guides listing
│   │   └── [slug]/page.tsx             # Article detail
│   └── work-with-us/
│       └── page.tsx                    # Aigent.ly consulting CTA
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── MobileNav.tsx
│   ├── directory/
│   │   ├── RuleCard.tsx                # Primary card used in listings
│   │   ├── RuleDetail.tsx              # Full rule detail view
│   │   ├── FilterSidebar.tsx           # Collapsible filter panel
│   │   ├── FilterChips.tsx             # Active filter pills (dismissible)
│   │   ├── SearchBar.tsx               # Fuzzy search with keyboard shortcut
│   │   ├── SortDropdown.tsx
│   │   └── EmptyState.tsx
│   ├── security/
│   │   ├── ThreatBadge.tsx             # OWASP / MITRE / CVE severity badges
│   │   ├── ThreatMap.tsx               # Visual vulnerability matrix per stack
│   │   ├── CveFeed.tsx                 # Live CVE ticker/feed component
│   │   ├── ProtectionMeter.tsx         # % of threats covered by selected rules
│   │   ├── VulnCard.tsx                # Individual vulnerability card
│   │   └── StackSecureScore.tsx        # Security posture score for a stack
│   ├── composer/
│   │   ├── StackSelector.tsx
│   │   ├── IdeSelector.tsx
│   │   ├── RuleLayer.tsx               # One rule layer (code quality / arch / security)
│   │   ├── ComposedOutput.tsx          # Final assembled rule set with copy button
│   │   └── ExportMenu.tsx             # Export to different IDE formats
│   ├── community/
│   │   ├── StarRating.tsx              # 1-5 star rating with half-stars
│   │   ├── ReviewList.tsx              # Community reviews
│   │   ├── ReviewForm.tsx              # Submit a review
│   │   ├── UsageCounter.tsx            # "X developers use this rule"
│   │   └── ContributeButton.tsx        # Links to GitHub PR flow
│   └── ui/                             # shadcn/ui components (auto-generated)
├── content/
│   ├── rules/                          # MDX files, one per rule entry
│   │   └── [slug].mdx
│   ├── threats/                        # Static vulnerability data
│   │   ├── owasp-web.json
│   │   ├── owasp-llm.json
│   │   ├── mitre-atlas.json
│   │   └── vibe-coding-cves.json
│   └── articles/                       # MDX files for learn section
├── lib/
│   ├── rules.ts                        # Rule loading and parsing utilities
│   ├── search.ts                       # Fuse.js configuration
│   ├── filters.ts                      # Filter logic and URL sync
│   ├── threats.ts                      # Threat data loading and mapping
│   ├── export.ts                       # Cross-IDE rule export engine
│   ├── db/                             # Drizzle client, schema re-exports
│   │   ├── index.ts
│   │   └── schema.ts                   # Mirrors SQL tables (generated or hand-written)
│   └── auth.ts                         # Auth.js helpers (session, requireUser)
├── db/
│   └── schema/
│       └── 001_aigently_core.sql       # Optional bootstrap SQL; fold into drizzle-kit migrations, then deprecate
├── drizzle/                            # drizzle-kit output: migration SQL + meta journal (commit to git)
└── public/
    └── stacks/                         # Stack logos (SVG)
```

---

## PAGE 1: HOMEPAGE (/)

### Hero Section
Use shadcn/ui typography. Keep it high-signal, no fluff.

```
Eyebrow (small, uppercase, brand color):
  "Open source · Community-powered · Security-first"

H1 (large, tight letter-spacing):
  "The security layer your
   AI code assistant doesn't have"

Subtext (16px, muted):
  "Vibe coding is fast. It's also shipping vulnerabilities at scale.
   Aigent.ly gives developers copy-paste guardrail rules that protect
   against OWASP, MITRE ATLAS, and the new class of AI-specific CVEs —
   matched to your stack and your IDE."

CTAs:
  [Primary]   "Find rules for my stack →"     → /composer
  [Secondary] "Browse the directory"          → /rules

Social proof line below CTAs:
  "Protecting against 24 OWASP vulnerabilities · 84 MITRE ATLAS techniques
   · 6 vibe coding CVEs · Used by 4,200 developers"
```

### Threat Reality Strip (full-width, light warning background)
A scrolling or static strip of real stats to establish urgency:
```
45% of AI-generated code has security vulnerabilities  ·
35 CVEs directly from AI coding tools in March 2026 alone  ·
72% of LLM-generated Java code is vulnerable  ·
20% of AI code references packages that don't exist (slopsquatting)  ·
2,000 critical vulns found in 5,600 vibe-coded production apps
```
Use marquee scroll (CSS animation, pause on hover) or a static grid of stat cards.

### Stack Selector — "Pick your stack, see your risks"
Grid of the top 10 stacks as clickable cards. Each shows:
- Stack logo + name
- Security score badge (A/B/C/D rating based on default framework security posture)
- Top 3 vulnerability risks for that stack (pill badges)
- "X rules available" count

```
Top 10 stacks:
Next.js      Python/FastAPI    React SPA     Node/Express
Django       Ruby on Rails     Go/Gin        Laravel/PHP
iOS/Swift    Android/Kotlin

Security score methodology:
  A = strong framework defaults (Rails, Django)
  B = moderate defaults, some manual config needed (Next.js, FastAPI)
  C = minimal defaults, extensive config needed (Express, React SPA)
  D = low-level, security entirely manual (Go, raw Node)
```

Clicking a stack card goes to `/stacks/[stack]` — the stack-specific security overview.

### Threat Intelligence Preview (live-feel section)
Show the last 5 CVEs/vulnerabilities relevant to AI coding tools. Each entry:
- CVE ID or OWASP ref
- Severity badge (Critical/High/Medium)
- One-line description
- "Affected stacks" pill tags
- "Protected by X rules →" link

```
LIVE THREATS (last 30 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CRITICAL] CVE-2025-54135 CurXecute
  RCE via Cursor MCP prompt injection. Affects: All stacks using Cursor
  → 3 guardrail rules protect against this

[CRITICAL] CVE-2025-54136 MCPoison
  Persistent code execution via poisoned MCP config in shared repos
  → 2 guardrail rules protect against this

[HIGH] Slopsquatting Supply Chain
  AI-hallucinated package names registered with malware (npm, PyPI)
  → 4 guardrail rules protect against this
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"View all threats →"
```

### Rule Composer Preview (interactive teaser)
Simplified 3-step version of the full composer embedded on homepage:
```
Step 1: [Select stack dropdown]   → Next.js ▾
Step 2: [Select IDE dropdown]     → Cursor ▾
Step 3: [Select layer checkboxes] → ☑ Code quality  ☑ Architecture  ☑ Security

→ [Build my rules →]  (goes to full /composer page with selections pre-filled)
```

### Community Stats Bar
```
[4,200 developers using rules]  [186 rules published]  [1,240 reviews]
[10 stacks covered]  [5 IDEs supported]  [Open Source on GitHub ↗]
```

### Aigent.ly Brand Section
Split layout (text left, subtle visual right):
```
Headline: "Need an AI security architect on your team?"
Body: "We design and build production AI systems for teams that can't
       afford to find out the hard way. From threat modelling to
       guardrail architecture to full-stack AI delivery."
CTAs: [Work with us] [See our approach]
```

---

## PAGE 2: RULES DIRECTORY (/rules)

### Layout
Two-column layout:
- Left sidebar (280px, sticky): filter panel
- Right content: search bar + sort + result count + card grid/list

### Search Bar
- Keyboard shortcut: `Cmd+K` / `Ctrl+K` opens global command palette
- Uses shadcn/ui `<Command>` component with Fuse.js backing
- Searches: rule name, description, stack tags, vulnerability IDs
- Results grouped: Rules / Threats / Articles

### Active Filters (below search, above results)
Dismissible pill chips for each active filter.
Show: "Showing 24 of 186 rules" result count with live update.
"Clear all" link when filters are active.

### Filter Sidebar — Full Specification

Each filter section uses shadcn/ui `<Accordion>` — collapsible, remembers state in localStorage.

```
SEARCH
  [Full-text search input]

TECH STACK (multi-select checkboxes)
  ☐ Next.js          ☐ Python / FastAPI
  ☐ React SPA        ☐ Node.js / Express
  ☐ Django           ☐ Ruby on Rails
  ☐ Go / Gin         ☐ Laravel / PHP
  ☐ iOS / Swift      ☐ Android / Kotlin
  ☐ Vue.js           ☐ Nuxt.js
  ☐ NestJS           ☐ Spring Boot
  (expandable: "Show 8 more stacks")

AI CODING TOOL (multi-select)
  ☐ Cursor (.mdc format)
  ☐ Claude Code (CLAUDE.md)
  ☐ Windsurf (.windsurfrules)
  ☐ GitHub Copilot (.github/copilot-instructions.md)
  ☐ Cline (.clinerules)
  ☐ Aider (CONVENTIONS.md)
  ☐ Generic / All IDEs

RULE LAYER (multi-select)
  ☐ Security guardrails        ← the primary category
  ☐ Code quality & conventions
  ☐ Architecture patterns
  ☐ Testing & QA
  ☐ Performance
  ☐ Documentation

PROTECTION SCOPE — What vulnerabilities does this rule protect against?
  OWASP Web Top 10:
  ☐ A01 Broken Access Control
  ☐ A02 Cryptographic Failures
  ☐ A03 Injection (SQL, XSS, Command)
  ☐ A04 Insecure Design
  ☐ A05 Security Misconfiguration
  ☐ A06 Vulnerable Components
  ☐ A07 Auth Failures
  ☐ A08 Integrity Failures / CSRF
  ☐ A09 Logging Failures
  ☐ A10 SSRF

  OWASP LLM Top 10:
  ☐ LLM01 Prompt Injection
  ☐ LLM02 Sensitive Data Disclosure
  ☐ LLM03 Supply Chain
  ☐ LLM04 Data Poisoning
  ☐ LLM05 Improper Output Handling
  ☐ LLM06 Excessive Agency
  ☐ LLM07 System Prompt Leakage
  ☐ LLM08 Vector/Embedding Attacks
  ☐ LLM09 Misinformation
  ☐ LLM10 Unbounded Consumption

  Vibe Coding Specific:
  ☐ MCP Config Poisoning
  ☐ Rules File Backdoors
  ☐ Slopsquatting
  ☐ IDE RCE (CurXecute class)
  ☐ Stale Training Data CVEs

SEVERITY COVERAGE (multi-select)
  ☐ Critical
  ☐ High
  ☐ Medium
  ☐ Low / Informational

CERTIFICATION (toggle)
  ☐ Aigent.ly Certified only

COMMUNITY RATING (slider, 1-5)
  [slider: min 1 ——————————•———— max 5]
  Minimum rating: 4.0+

RULE SIZE (radio)
  ○ Any
  ○ Lean        (< 50 lines)
  ○ Standard    (50-150 lines)
  ○ Comprehensive (150+ lines)

RECENCY (radio)
  ○ Any time
  ○ Last 30 days
  ○ Last 90 days
  ○ Last year

[Clear all filters]
```

All filter state is synced to URL params via `nuqs`. URLs are shareable and bookmarkable.

### Rule Card Component (RuleCard.tsx)

```
┌─────────────────────────────────────────────────────┐
│ [Stack logo]  Rule Name                    [★ 4.8]  │
│ Aigent.ly Certified ✓      [Cursor] [Next.js]       │
│                                                     │
│ Short description of what this rule enforces, which │
│ patterns it guards against, and its key behaviours. │
│                                                     │
│ Protects against:                                   │
│ [OWASP A03] [OWASP A05] [LLM01] [Slopsquatting]    │
│                                                     │
│ ─────────────────────────────────────────────       │
│ 142 lines · 238 uses this week · Added 2 days ago  │
│                                    [Copy] [View →] │
└─────────────────────────────────────────────────────┘
```

Card details:
- Stack logo (SVG, 28px)
- Rule name (15px, weight 500)
- Star rating (shadcn/ui or custom, show as "4.8 (47 reviews)")
- Aigent.ly Certified badge (brand purple pill) if certified
- IDE compatibility pills (Cursor, Claude Code, etc.)
- 2-3 line description
- "Protects against" vulnerability badges — colour-coded by severity:
  - OWASP badges: orange background
  - LLM badges: purple background
  - CVE/vibe coding badges: red background
- Metadata footer: line count · weekly uses · date added
- [Copy] button — copies the raw rule content to clipboard, shows "Copied! ✓"
- [View →] link to detail page

### Sort Options
```
Sort by: [Most relevant ▾]
Options: Most relevant | Highest rated | Most used | Newest | Trending
```

---

## PAGE 3: RULE DETAIL (/rules/[slug])

### Header
```
← Back to directory

[Stack logo] Rule Name                    ★★★★★ 4.8 (47 reviews)
             Aigent.ly Certified ✓

Short description
Tags: [Next.js] [Cursor] [Claude Code] [Security] [OWASP A03] [OWASP A05]
```

### Two-Column Body

**Left column (main content, ~65% width):**

1. **Rule content** — syntax-highlighted code block (Shiki, github-light theme)
   - Line numbers on
   - One-click copy button (top-right of block)
   - Export dropdown: "Export for Cursor (.mdc)" | "Export for Claude Code (CLAUDE.md)" | "Export for Windsurf (.windsurfrules)" | "Export for Copilot (.github/copilot-instructions.md)" | "Export for Cline (.clinerules)"

2. **What this protects against** — vulnerability cards section
   For each vulnerability this rule addresses, show a mini card:
   ```
   ┌────────────────────────────────────────────────┐
   │ [CRITICAL] OWASP A03 — SQL Injection           │
   │ "AI-generated code rarely parameterizes queries │
   │  unless explicitly instructed. This rule forces │
   │  ORM-only data access patterns."               │
   │                            [Learn more →]      │
   └────────────────────────────────────────────────┘
   ```

3. **How to use** — MDX section explaining:
   - Which file to put this rule in (per IDE)
   - Whether to use `alwaysApply: true` or glob-based trigger
   - Stack-specific caveats
   - Example: before/after code showing the difference with vs without the rule

4. **Community Reviews** (ReviewList.tsx)
   ```
   ──────────────────────────────────────
   Community Reviews (47)
   ──────────────────────────────────────
   [Avatar] @dev_handle  ★★★★★  2 days ago
   "Used this on a FastAPI project for 3 months. Caught 4 SQL injection
    patterns the AI would have shipped. The Pydantic enforcement section
    is particularly well-written."
   [Helpful? ↑ 23]

   [Avatar] @another_user  ★★★★☆  1 week ago
   "Works great with Cursor. Wish it covered rate limiting as well."
   [Helpful? ↑ 11]
   ──────────────────────────────────────
   [Leave a review ▾]   ← expands ReviewForm
   ```

5. **ReviewForm** (collapsible)
   - Rating: 1-5 stars (click to select)
   - Review text (textarea, 50-500 chars)
   - IDE they used it with (select)
   - Stack they tested on (select)
   - Submit button
   - Persisted via **Server Action** to PostgreSQL (`rule_review`); requires **signed-in user**

**Right sidebar (~35% width, sticky):**

```
┌──────────────────────────────────┐
│ QUICK COPY                       │
│ [Copy rule to clipboard ↗]       │
│                                  │
│ EXPORT FOR YOUR IDE              │
│ [Cursor (.mdc)]                  │
│ [Claude Code (CLAUDE.md)]        │
│ [Windsurf (.windsurfrules)]      │
│ [Copilot instructions]           │
│ [Cline (.clinerules)]            │
├──────────────────────────────────┤
│ METADATA                         │
│ Stack          Next.js           │
│ Rule layer     Security          │
│ Line count     142               │
│ Last updated   2 days ago        │
│ Certified      Yes ✓             │
│ Author         @aigently         │
│ Version        v2.1              │
├──────────────────────────────────┤
│ PROTECTION COVERAGE              │
│ OWASP Web  ████████░░  8/10     │
│ OWASP LLM  ████░░░░░░  4/10     │
│ Vibe CVEs  ██████░░░░  6/10     │
├──────────────────────────────────┤
│ COMMUNITY                        │
│ ★★★★★  4.8  (47 reviews)        │
│ 238 devs use this rule           │
│ 89% say it improved their code   │
├──────────────────────────────────┤
│ CONTRIBUTE                       │
│ See an issue or improvement?     │
│ [Open a PR on GitHub ↗]          │
│ [Report an issue ↗]              │
└──────────────────────────────────┘
```

---

## PAGE 4: THREAT INTELLIGENCE (/threats)

This is the most differentiated page on the site. No other developer tool has this.

### Header
```
Threat Intelligence
Last updated: 47 minutes ago

"Your AI coding tool doesn't know about CVEs disclosed after its
training cutoff. We track the vulnerabilities that matter to
vibe coders, in real time."
```

### Threat Filter Bar (horizontal, above grid)
```
[All] [Critical] [High] [Medium] [This week] [This month]
Stack filter: [All stacks ▾]
Source: [All ▾] = OWASP Web | OWASP LLM | MITRE ATLAS | CVE/NVD | Vibe Coding
```

### Three-Panel Layout

**Panel A: Threat Matrix (left, ~40%)**

A visual grid showing severity × category, inspired by MITRE ATT&CK matrix.
Rows = threat categories (Injection, Auth, Supply Chain, Vibe Coding, LLM-specific...)
Columns = stacks (Next.js, FastAPI, Rails, Express, Django...)
Cells = colour-coded by severity: red (critical), orange (high), yellow (medium), green (low/mitigated by rules).

Hovering a cell shows a tooltip: "3 critical vulnerabilities, 2 covered by Aigent.ly rules"
Clicking a cell filters the right panel to matching threats.

```
                Next.js  FastAPI  Rails   Express  Django
Injection        🔴       🟠       🟡      🔴       🟡
Auth Failures    🟠       🟠       🟡      🟠       🟡
Hardcoded Secrets 🔴      🔴       🟠      🔴       🟠
CSRF             🟠       🟡       🟢      🔴       🟢
Supply Chain     🔴       🔴       🔴      🔴       🔴
MCP/IDE CVEs     🔴       🔴       🔴      🔴       🔴
LLM Injection    🟠       🟠       🟠      🟠       🟠

Legend: 🔴 Critical  🟠 High  🟡 Medium  🟢 Mitigated
```

**Panel B: Live Threat Feed (right, ~60%)**

Sorted by recency + severity. Each entry:
```
┌──────────────────────────────────────────────────────────────┐
│ [CRITICAL] CVE-2025-54135 · Cursor IDE · 3 weeks ago        │
│ CurXecute — Remote Code Execution                            │
│ Prompt injection via connected MCP server rewrites global    │
│ Cursor config and executes attacker code on dev machine.     │
│ Zero user interaction required. Affects all stacks.          │
│                                                              │
│ Source: AIM Security · MITRE: AML.T0051 (Prompt Injection)   │
│ Affected IDEs: [Cursor]                                      │
│ Affected stacks: [All stacks]                                │
│                                                              │
│ 🛡️ Protected by 3 Aigent.ly rules  [View rules →]           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ [CRITICAL] Slopsquatting · npm / PyPI · Ongoing             │
│ AI Hallucinated Package Attack                               │
│ AI coding tools suggest ~20% non-existent packages. Attackers│
│ pre-register them on npm/PyPI with malicious code.           │
│                                                              │
│ Source: CSA Research · OWASP: A06 (Vulnerable Components)    │
│ Affected IDEs: [All IDEs]                                    │
│ Affected stacks: [Next.js] [FastAPI] [Node.js] [Django]      │
│                                                              │
│ 🛡️ Protected by 4 Aigent.ly rules  [View rules →]           │
└──────────────────────────────────────────────────────────────┘
```

### Threat Detail Page (/threats/[id])

Full page for a specific vulnerability:
- Severity, category, source framework mapping (OWASP / MITRE ATLAS / CVE ID)
- Full description with technical detail
- Real-world attack scenario ("An attacker sends a crafted message to your Cursor IDE via...")
- Affected stacks and IDEs
- MITRE ATLAS technique reference (e.g. AML.T0051) with link
- OWASP reference with link
- **Aigent.ly rules that protect against this** — card grid of matching rules
- Code example: vulnerable pattern vs protected pattern (side-by-side, syntax highlighted)
- Community discussion thread (simplified comment/reply; **authenticated users**, stored in PostgreSQL when enabled for threats v1.1 — otherwise defer)

---

## PAGE 5: STACK SECURITY OVERVIEW (/stacks/[stack])

When a developer clicks "Next.js" on the homepage, they land here.

### Header
```
[Next.js logo] Next.js Security Guardrails

Security score: B+  ←  coloured badge
"Next.js provides some built-in protections (Server Components reduce
CSRF surface, JSX escapes XSS by default) but lacks built-in CSRF
tokens, rate limiting, and secret management. AI coding tools
regularly introduce all three of these without prompting."

[Browse all Next.js rules →]  [Build my Next.js rule set →]
```

### Risk Breakdown for This Stack
Stack-specific threat cards, ordered by severity:

```
For Next.js, the highest-risk vulnerabilities AI tools introduce:

[CRITICAL] SQL Injection via raw Prisma/Drizzle queries
  AI frequently writes raw SQL strings rather than ORM parameterized calls.
  → 5 rules cover this  [Browse →]

[CRITICAL] Hardcoded API keys and secrets
  AI embeds API keys directly in source when env variable setup is unclear.
  → 3 rules cover this  [Browse →]

[HIGH] Missing CSRF protection on Server Actions
  Next.js does not provide CSRF tokens for Server Actions by default.
  → 2 rules cover this  [Browse →]

[HIGH] dangerouslySetInnerHTML without sanitization
  AI reaches for this for any HTML rendering need without DOMPurify.
  → 4 rules cover this  [Browse →]

[HIGH] Missing security headers (CSP, HSTS, X-Frame-Options)
  AI never sets security headers unless explicitly prompted.
  → 3 rules cover this  [Browse →]
```

### Protection Coverage Visual
Circular progress or segmented bar showing:
```
OWASP Web Top 10 coverage for Next.js:  █████████░  9/10 covered by rules
OWASP LLM Top 10 (if using AI features): ██████░░░░  6/10 covered by rules
Vibe Coding CVEs:                        ███████░░░  7 of 9 covered by rules
```

### Featured Rules for This Stack
3-column grid of top-rated rules for Next.js, with "See all 24 Next.js rules →" link.

### What Your Framework Handles vs. What It Doesn't

A table showing developer expectations:

```
BUILT INTO NEXT.JS (AI follows these automatically)
✓ JSX auto-escaping (prevents basic XSS)
✓ Server Components reduce CSRF surface (GET requests can't mutate state)
✓ next/image protects against image-based attacks
✓ Production mode strips error stack traces

YOU MUST CONFIGURE — AND PROMPT YOUR AI TO CONFIGURE:
✗ CSRF tokens for Server Actions and API Routes
✗ Content Security Policy headers
✗ Rate limiting (use @arcjet/next or similar)
✗ Input validation (use Zod on every Server Action input)
✗ Environment variable management (never hardcode)
✗ Authentication (use next-auth, clerk, or equivalent)
✗ SQL parameterization (use ORM exclusively, no raw queries)
```

---

## PAGE 6: RULE COMPOSER (/composer)

The most interactive page. Three-step wizard using shadcn/ui Tabs or Steps.

### Step 1: Choose Your Stack
Grid of stack cards (same as homepage selector, but larger).
Multi-select supported ("I'm building a Next.js frontend + FastAPI backend").

### Step 2: Choose Your IDE
5 large toggle cards showing IDE logo + name:
- Cursor (file: `.cursor/rules/[name].mdc`)
- Claude Code (file: `CLAUDE.md`)
- Windsurf (file: `.windsurfrules`)
- GitHub Copilot (file: `.github/copilot-instructions.md`)
- Cline (file: `.clinerules`)

Each card shows the output file format it will generate.

### Step 3: Choose Your Layers
Three-layer toggle (all on by default):

```
LAYER 1: Security Guardrails            [ON ✓]
  Protects against OWASP Top 10, LLM Top 10,
  and vibe coding CVEs

LAYER 2: Code Quality & Architecture   [ON ✓]
  Enforces conventions, patterns, and
  consistency in generated code

LAYER 3: Testing & Documentation       [OFF □]
  Requires test coverage and documentation
  for generated functions
```

Optional: Threat-first selection. A toggle:
```
[○ Start from layers]   [● Start from threats I want to protect against]
```
If "Start from threats" is chosen, show the vulnerability checklist from the filter sidebar.
Rule Composer automatically selects layers and rules that cover the chosen threats.

### Step 4: Your Composed Rule Set

Shows assembled rule set with:

Left panel (preview):
- Full composed rule text in syntax-highlighted code block (Shiki)
- Rules are assembled in correct order: security first, then quality, then testing
- Conflicts are automatically resolved (e.g. if two rules contradict, show a warning)

Right panel (summary):
```
YOUR RULE SET SUMMARY
━━━━━━━━━━━━━━━━━━━━━
Stack:    Next.js + FastAPI
IDE:      Cursor
Layers:   Security + Code Quality

COVERAGE
OWASP Web Top 10:    9/10  ████████░░
OWASP LLM Top 10:   5/10  █████░░░░░
Vibe Coding CVEs:   7/9   ████████░░

PROTECTS AGAINST
[OWASP A01] [OWASP A03] [OWASP A05]
[OWASP A07] [OWASP A08] [LLM01]
[LLM06] [Slopsquatting] [MCPoison]

LINE COUNT: 187 lines
RULES COMBINED: 6 rule files merged

EXPORT
[Copy to clipboard]
[Download as .mdc file]
[Download as CLAUDE.md]
[Download as .windsurfrules]
[View on GitHub ↗]
━━━━━━━━━━━━━━━━━━━━━
```

---

## PAGE 7: LEARN (/learn)

### Layout
Full-width, no sidebar.

```
Articles & Guides

[All] [Security] [Vibe Coding] [OWASP] [MITRE] [IDE Setup] [Tutorials]
```

### Article Card
```
┌────────────────────────────────────────────────────────┐
│ [SECURITY] · 8 min read · 3 days ago                  │
│ Why 45% of vibe-coded apps fail their first pen test  │
│                                                        │
│ The data is in. AI coding tools are shipping vulner-   │
│ abilities faster than security teams can patch them.   │
│ Here's what the CVE data actually shows.              │
│                                                        │
│ Tags: [Vibe Coding] [OWASP] [CVE]                     │
└────────────────────────────────────────────────────────┘
```

### Article Detail (/learn/[slug])
- MDX rendered with custom components
- Table of contents sidebar (sticky, desktop only, using shadcn/ui ScrollArea)
- Code blocks: Shiki syntax highlighting + copy button
- At bottom: "Rules that relate to this article" — linked rule cards
- Community: "Was this helpful?" thumbs up/down (**signed-in users**; `article_feedback` in PostgreSQL)
- Related articles grid

---

## AUTHENTICATION & ACCOUNTS

- **Library:** [Auth.js](https://authjs.dev/) (formerly NextAuth.js) v5 with the **App Router** route handlers (`app/api/auth/[...nextauth]/route.ts` or equivalent Auth.js wiring).
- **Session strategy:** **Database sessions** stored in PostgreSQL (Auth.js adapter tables + session/token rows). Use **HttpOnly, Secure, SameSite** session cookies — never store long-lived auth tokens in `localStorage`.
- **Sign-in methods (v1):**
  - **GitHub OAuth** (primary — matches developer audience and open-source workflow).
  - **Google OAuth** (optional second provider).
  - **Email magic link** (optional; if enabled, use rate-limited sends and short-lived tokens).
- **User profile:** `displayName`, `avatarUrl` (from OAuth), `githubLogin` / `email` (as provided by provider). No password storage for OAuth-only flows.
- **Authorization:**
  - **Any authenticated user** may submit a **rule review** and mark reviews as helpful (subject to rate limits and abuse controls).
  - **Rule and article content** remains curated via **GitHub PR**; only **reviews**, **usage aggregates**, and **article feedback** are user-generated in the database.
  - **Admin / moderator** roles (optional v1.1): flag or hide reviews; not required for first ship.
- **Security requirements:** CSRF protection on Server Actions (framework defaults), Zod validation on all auth-adjacent inputs, rate limiting on sign-in and review endpoints (`@upstash/ratelimit` or Hostinger-compatible middleware).

---

## DATABASE — POSTGRESQL

**Principles**

- **Content authority:** Rule and learn **bodies** remain **MDX in Git** (`/content/**`). PostgreSQL holds **metadata sync** (optional), **taxonomy**, **user-generated** data, and **aggregates** — not a CMS replacement.
- **Threat seed data:** OWASP / MITRE / vibe JSON files in `/content/threats/` are the authoring format; **load or sync** into the `threat` table for querying, dashboards, and foreign keys from rules (ETL on deploy or CI).

### Schema migrations (Node) — **drizzle-kit** (recommended)

Use **Drizzle ORM** for the application layer and **drizzle-kit** as the **only** migration engine so schema, types, and SQL history stay in one toolchain.

**Workflow (extends cleanly over time)**

1. Edit **`lib/db/schema.ts`** (add tables, columns, enums, indexes).
2. Run **`drizzle-kit generate`** → emits timestamped SQL migration files + `meta/` journal under a committed folder (e.g. `drizzle/`).
3. Review the generated SQL in PRs (same discipline as hand-written SQL).
4. Apply with **`drizzle-kit migrate`** in CI and on Hostinger deploy **before** or **with** the app release; keep `DATABASE_URL` consistent across environments.

**Why drizzle-kit for this project**

- **Same model as the app** — no second source of truth (vs maintaining parallel Prisma + Drizzle).
- **Versioned, ordered migrations** — linear journal supports additive changes, renames via explicit steps, and reproducible prod applies.
- **Portable SQL** — works on Hostinger/VPS/Docker; no vendor-specific runtime.
- **Team scale** — diffs are readable SQL; rollbacks are explicit new migrations (standard practice).

**Alternatives (use only if you abandon Drizzle)**

| Tool | When it fits |
|------|----------------|
| **Prisma Migrate** | If the ORM is switched to Prisma end-to-end. |
| **node-pg-migrate** / **dbmate** | SQL-first, minimal magic; you hand-write every migration (good for DBAs, more manual typing). |
| **Flyway / Liquibase** | JVM-heavy org standards; odd fit for a Node-first Next repo. |

**Bootstrap note:** Initial **`db/schema/001_aigently_core.sql`** (if present) can be folded into the first **`drizzle-kit generate`** snapshot so everything lives under the Drizzle migration journal afterward; avoid running two parallel migration systems long-term.

**Core tables (relational model)**

| Table | Purpose |
|-------|---------|
| `stack` | Normalized stack dimension (slug, name, logo path, sort order). |
| `ide` | Normalized IDE dimension. |
| `threat` | Unified threat catalog (`public_id` PK: `A01`, `LLM01`, `AML.*`, `cve-*`, etc.); `family` enum; `details` **jsonb** for variable fields (CVE id, references, affected tools, …). |
| `rule` | One row per guardrail rule: `slug` (unique), frontmatter fields, optional `body_mdx` / `content_path`, `search_vector` (tsvector for full-text search). |
| `rule_stack`, `rule_ide`, `rule_layer_map`, `rule_severity_tag`, `rule_threat_map` | Many-to-many links from `rule` to dimensions and `threat`. |
| `article` | Learn articles: `slug`, title, excerpt, tags, optional `body_mdx` / `content_path`. |
| `article_rule_map` | Links articles to related rules. |
| `rule_review` | User reviews: `rule_id`, `rating` (1–5), text, IDE/stack tested, `user_id` (FK to auth user), timestamps. |
| `rule_review_helpful` | One row per user per review (`review_id`, `user_id`) to prevent duplicate helpful votes. |
| `article_feedback` | Per-user helpful vote on an article (`article_id`, `user_id`, `helpful`). |
| `rule_usage_daily` | **Privacy-preserving aggregate** copy counts per rule per day (no per-click PII). |
| `content_revision` | Optional: Git SHA provenance when syncing MDX metadata into `rule` / `article`. |

**Auth.js / adapter tables:** Add standard Auth.js schema (e.g. `user`, `account`, `session`, `verificationToken`) — use the official Drizzle adapter definitions; keep adapter tables in the same database.

**Canonical schema:** **`lib/db/schema.ts`** is the source of truth for the relational model; **drizzle-kit** generates the migration SQL. Optional **`db/schema/001_aigently_core.sql`** is a human-readable bootstrap snapshot only — fold it into the first Drizzle migration and then rely on the migration journal. **Apply order:** Auth.js adapter tables first (via Drizzle or Auth.js CLI), then app tables; enforce **FKs** from `rule_review.user_id`, `rule_review_helpful.user_id`, and `article_feedback.user_id` to `users(id)` in the same migration system.

---

## DATA MODELS

### Rule Entry (MDX frontmatter)
```yaml
---
id: "nextjs-security-guardrails-v2"
slug: "nextjs-security-guardrails-v2"
name: "Next.js Security Guardrails v2"
description: "Comprehensive security ruleset for Next.js App Router covering SQL injection, XSS, CSRF, secret management, and auth patterns."
version: "2.1.0"
dateAdded: "2026-04-20"
lastUpdated: "2026-05-01"
author: "aigently-team"
certified: true

stacks: ["nextjs", "react"]
ides: ["cursor", "claude-code", "windsurf", "copilot", "cline"]
ruleLayer: ["security", "architecture"]

# Vulnerability coverage — reference IDs
protectsAgainst:
  owaspWeb: ["A01", "A03", "A05", "A07", "A08"]
  owaspLlm: ["LLM01", "LLM05", "LLM06"]
  mitreAtlas: ["AML.T0051", "AML.T0047"]
  vibeCoding: ["slopsquatting", "hardcoded-secrets", "mcp-poisoning"]

severity: ["critical", "high", "medium"]
lineCount: 142
complexity: "comprehensive"
---

[Rule content in MDX body — the actual prompt rule text]
```

### Threat Entry (JSON — /content/threats/vibe-coding-cves.json)
```json
{
  "id": "cve-2025-54135",
  "displayName": "CurXecute — Cursor IDE RCE",
  "cveId": "CVE-2025-54135",
  "severity": "critical",
  "category": "ide-rce",
  "source": "AIM Security",
  "disclosedDate": "2025-09-15",
  "description": "Remote code execution via prompt injection through connected MCP server. Attacker rewrites global Cursor configuration and executes code on developer machine with no user interaction.",
  "attackScenario": "Attacker sends crafted message via Slack MCP integration → Cursor receives → silently rewrites ~/.cursor/settings.json → executes attacker payload before next prompt",
  "affectedIdes": ["cursor"],
  "affectedStacks": ["all"],
  "mitreAtlas": ["AML.T0051"],
  "owaspRef": ["LLM01"],
  "protectedByRules": ["mcp-security-guardrails", "cursor-safety-rules"],
  "patchedIn": "Cursor 0.43.6",
  "references": [
    "https://bleepingcomputer.com/...",
    "https://aim-security.com/..."
  ]
}
```

### Community Rating (API / persistence shape)

Client components load reviews via **Server Components or React Query**; mutations use **Server Actions**. Shapes align with PostgreSQL tables `rule_review`, `rule_review_helpful`.

```typescript
/** Mirrors `rule_review` + joined user display fields */
interface RuleReviewDTO {
  id: string;              // uuid
  ruleSlug: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  rating: number;          // 1-5
  reviewText: string;
  ideUsed: string;
  stackTested: string;
  helpfulCount: number;
  createdAt: string;       // ISO date
}

interface RuleReviewListResult {
  reviews: RuleReviewDTO[];
  aggregate: { average: number; count: number };
  viewerHasHelpfulVoteByReviewId: Record<string, boolean>;
}
```

---

## CROSS-IDE EXPORT ENGINE (/lib/export.ts)

One canonical rule entry exports to any IDE format. This is a major differentiator.

```typescript
type IdeTarget = 'cursor' | 'claude-code' | 'windsurf' | 'copilot' | 'cline' | 'aider';

interface ExportConfig {
  ide: IdeTarget;
  outputFilename: string;
  outputDirectory: string;
  formatWrapper: (content: string, metadata: RuleMetadata) => string;
}

const IDE_CONFIGS: Record<IdeTarget, ExportConfig> = {
  cursor: {
    outputFilename: 'security-guardrails.mdc',
    outputDirectory: '.cursor/rules/',
    formatWrapper: (content, meta) => `---
description: ${meta.description}
globs: ${meta.globs ?? '**/*'}
alwaysApply: ${meta.alwaysApply ?? false}
---

${content}`
  },
  'claude-code': {
    outputFilename: 'CLAUDE.md',
    outputDirectory: './',
    formatWrapper: (content, meta) => `# ${meta.name}

${content}`
  },
  windsurf: {
    outputFilename: '.windsurfrules',
    outputDirectory: './',
    formatWrapper: (content) => content
  },
  copilot: {
    outputFilename: 'copilot-instructions.md',
    outputDirectory: '.github/',
    formatWrapper: (content) => content
  },
  cline: {
    outputFilename: '.clinerules',
    outputDirectory: './',
    formatWrapper: (content) => content
  },
  aider: {
    outputFilename: 'CONVENTIONS.md',
    outputDirectory: './',
    formatWrapper: (content) => content
  }
};

export function exportRule(ruleContent: string, metadata: RuleMetadata, target: IdeTarget): string {
  const config = IDE_CONFIGS[target];
  return config.formatWrapper(ruleContent, metadata);
}
```

---

## COMMUNITY CONTRIBUTION FLOW

The site is open source. Community contributions flow through GitHub.

### Submission Process (documented in CONTRIBUTING.md)
1. Fork the repo
2. Copy `/content/rules/_template.mdx` to `/content/rules/[your-slug].mdx`
3. Fill in frontmatter (schema validates via Zod in CI)
4. Write rule content in MDX body
5. Add entries to `/content/threats/` if introducing new vulnerability mapping
6. Submit PR — Aigent.ly team reviews within 5 business days
7. If accepted, marked "Community" (not "Certified" unless Aigent.ly reviews deeply)

### On-Site UI for Community
Every rule detail page has:
- "🛠 Suggest an edit" → opens GitHub PR template
- "🐛 Report an issue" → opens GitHub issue template
- "💬 Leave a review" → in-page review form (**requires sign-in**); persisted in PostgreSQL
- "👍 Was this helpful?" on each review (**requires sign-in**; one vote per user per review)

### Usage Tracking (privacy-first)
When a user clicks "Copy" on a rule, record an **aggregate increment** for that rule’s **daily bucket** in PostgreSQL (`rule_usage_daily`). Optionally require sign-in for anti-abuse; if anonymous, use strict rate limits by IP + fingerprint **without** storing raw PII in clear text.
Display as "238 uses this week" on the card and detail page (sum of daily buckets). **No third-party ad trackers.**

---

## SECURITY CONTENT — SEED DATA SPECIFICATION

### Top 10 Stacks to Launch With

For each stack, produce:
- 1 comprehensive security guardrail rule (150+ lines)
- 1 code quality rule (80-120 lines)
- 1 architecture rule (60-100 lines)
- Mapped vulnerability coverage for that stack

**Stack 1: Next.js (App Router)**
Security rules must enforce:
- Zod validation on every Server Action input (prevents injection)
- ORM-only data access, no raw SQL ever
- Never use `dangerouslySetInnerHTML` without DOMPurify
- CSRF token header on all mutating API routes
- Security headers in `next.config.js` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Environment variables via `process.env`, never hardcoded
- `server-only` import on any file with secrets or business logic
- Rate limiting on auth endpoints (recommend @arcjet/next or upstash ratelimit)
- HttpOnly, Secure, SameSite cookies for session management
- Never `console.log` sensitive data in production
- Pin all dependency versions, no unpinned `^` or `~` in security-critical deps
- Validate and sanitize all redirects (prevent open redirect)
- Verify all packages exist before importing (add comment to check npm)

**Stack 2: Python / FastAPI**
Security rules must enforce:
- Pydantic models for ALL request body validation, no raw dict access
- SQLAlchemy ORM only, no raw `text()` queries without parameterization
- `python-jose` or `python-multipart` configured for JWT with appropriate expiry
- CORS: never `allow_origins=["*"]` in production
- Secrets via `pydantic-settings` / `.env`, never hardcoded
- Rate limiting middleware (slowapi)
- Never `eval()` or `exec()` on any user input
- Dependencies pinned in requirements.txt with hashes
- `httpx` with timeout on all external requests
- Proper exception handling — never expose stack traces in API responses

**Stack 3: Node.js / Express**
Security rules must enforce:
- `helmet()` middleware on every app (sets all security headers)
- `express-rate-limit` on all routes, stricter on auth
- `express-validator` or Zod for all input validation
- Parameterized queries via pg, mysql2, or an ORM — no string concatenation
- `csurf` or origin header validation for CSRF
- `cors` configured with explicit allowlist, never wildcard
- No `eval()`, `Function()`, or `vm.runInThisContext()` on user data
- `dotenv` or environment config, never hardcoded credentials
- `hpp` middleware to prevent HTTP parameter pollution
- JWT secret minimum 256 bits, stored in env

**Stack 4: Django / Python**
Security rules must enforce:
- `SECRET_KEY` from environment, minimum 50 chars
- `DEBUG = False` in production — enforce this with a check
- `ALLOWED_HOSTS` explicitly set, never `['*']`
- Django ORM only — no raw SQL with user input
- CSRF middleware enabled globally (it is by default; enforce it stays on)
- `SECURE_SSL_REDIRECT = True` in production
- `SECURE_HSTS_SECONDS = 31536000` in production
- `SESSION_COOKIE_SECURE = True` and `SESSION_COOKIE_HTTPONLY = True`
- `SECURE_CONTENT_TYPE_NOSNIFF = True`
- Permissions classes on every DRF ViewSet
- Rate limiting via `django-ratelimit` on auth views

**Stack 5: Ruby on Rails**
Security rules must enforce:
- `protect_from_forgery with: :exception` enabled globally (it is by default; enforce it stays)
- Strong parameters with explicit permit lists — never `params.permit!`
- ActiveRecord scopes for multi-tenant data isolation (prevent IDOR)
- `Rack::Attack` for rate limiting
- `Rails.application.credentials` for secrets, never hardcoded
- Content Security Policy configured in `config/initializers/content_security_policy.rb`
- `force_ssl` enabled in production
- Brakeman in CI pipeline (add to Gemfile and CI config)
- IDOR: always scope queries through current_user, never find by bare ID
- Avoid `html_safe`, `raw`, `sanitize` unless explicitly needed

**Stack 6: Go / Gin**
Security rules must enforce:
- Parameterized queries via `database/sql` with `?` placeholders, never `fmt.Sprintf` for SQL
- Input validation via `go-playground/validator`
- CORS via `github.com/gin-contrib/cors` with explicit allowlist
- Rate limiting via `ulule/limiter` or `didip/tollbooth`
- JWT via `golang-jwt/jwt` with proper expiry and signing key from env
- Never log sensitive fields (passwords, tokens, PII)
- HTTP timeouts on all outbound requests (`http.Client{Timeout: ...}`)
- Secrets from environment, never in source
- Security headers middleware (HSTS, X-Frame-Options, etc.)
- Error responses never expose internal implementation details

**Stack 7: React SPA (Vite/CRA without Next.js)**
Security rules must enforce:
- Never store auth tokens in localStorage — use httpOnly cookies via backend
- All API calls via a centralized client that attaches auth headers
- Input sanitization with DOMPurify before any `dangerouslySetInnerHTML`
- Content Security Policy meta tag or server header
- No sensitive logic or secrets in client-side code (it's all public)
- `npm audit` in CI, fail on high/critical
- Subresource Integrity (SRI) on any CDN script tags
- Dependency pinning in package-lock.json, no `^` on security-critical packages
- React Router: validate redirects, never allow arbitrary URL redirects
- Environment variables: only `VITE_PUBLIC_*` prefixed vars are safe for client

**Stack 8: Laravel / PHP**
Security rules must enforce:
- Eloquent ORM only, no raw `DB::statement()` with user input
- CSRF middleware on all stateful routes (enabled by default; enforce it stays)
- Input validation via `Illuminate\Http\Request::validate()` on every controller method
- `bcrypt()` for password hashing, never `md5()` or `sha1()`
- Secrets in `.env` via `config()` helper, never hardcoded
- `config('app.debug')` set to `false` in production
- Rate limiting via `ThrottleRequests` middleware on auth routes
- File upload validation: MIME type, extension, size — never trust user input
- `$request->user()` for auth checks, never raw session variables
- Avoid `eval()`, `system()`, `exec()` with any user-controlled data

**Stack 9: iOS / Swift**
Security rules must enforce:
- Keychain for all credential and token storage, never UserDefaults
- Certificate pinning for all production API calls
- No sensitive data in app logs (os.log) — strip before release
- TLS 1.2+ enforced via App Transport Security
- Biometric authentication via LocalAuthentication framework before sensitive actions
- No hardcoded API keys in source — use xcconfig or server-side proxy
- Input sanitization before any web view content
- WKWebView with `javaScriptEnabled: false` unless explicitly needed
- Encrypted Core Data store via `NSPersistentStoreDescription` with encryption
- No sensitive data in NSUserActivity or Handoff (iCloud sync)

**Stack 10: Android / Kotlin**
Security rules must enforce:
- Android Keystore for all key material and credentials
- Network Security Config XML to enforce certificate pinning
- Never log sensitive data — strip all sensitive fields before `Log.*()` calls
- `FLAG_SECURE` on any screen displaying sensitive information
- ProGuard/R8 enabled in release builds (prevents reverse engineering)
- No hardcoded API keys — use BuildConfig from CI secrets
- Encrypted SharedPreferences via `EncryptedSharedPreferences`
- Content providers with `exported="false"` unless explicitly needed
- `WebView.setJavaScriptEnabled(false)` unless explicitly required
- Validate all deep link parameters before use

---

## THREAT DATA — SEED WITH THIS TAXONOMY

### Layer 1: OWASP Web Top 10 (2021, still current)
```json
[
  {"id": "A01", "name": "Broken Access Control", "severity": "critical",
   "aiAmplification": "AI has no knowledge of your authorization model. Never adds permission checks."},
  {"id": "A02", "name": "Cryptographic Failures", "severity": "high",
   "aiAmplification": "AI uses MD5, SHA1, and weak key sizes from old training data."},
  {"id": "A03", "name": "Injection", "severity": "critical",
   "aiAmplification": "72%+ of LLM-generated Java code is vulnerable to SQL injection."},
  {"id": "A04", "name": "Insecure Design", "severity": "high",
   "aiAmplification": "AI generates code for stated requirements only; ignores unstated security requirements."},
  {"id": "A05", "name": "Security Misconfiguration", "severity": "high",
   "aiAmplification": "AI sets DEBUG=True, CORS=*, and leaves default credentials in place."},
  {"id": "A06", "name": "Vulnerable and Outdated Components", "severity": "high",
   "aiAmplification": "AI training cutoff means suggested package versions may have known CVEs."},
  {"id": "A07", "name": "Identification and Authentication Failures", "severity": "high",
   "aiAmplification": "AI stores tokens in localStorage, uses weak JWT secrets, skips token expiry."},
  {"id": "A08", "name": "Software and Data Integrity Failures / CSRF", "severity": "high",
   "aiAmplification": "AI skips CSRF tokens on Server Actions and custom API routes."},
  {"id": "A09", "name": "Security Logging and Monitoring Failures", "severity": "medium",
   "aiAmplification": "AI logs everything including passwords and API keys in development mode."},
  {"id": "A10", "name": "Server-Side Request Forgery (SSRF)", "severity": "high",
   "aiAmplification": "AI builds URL-fetching features without validating the target URL."}
]
```

### Layer 2: OWASP LLM Top 10 (2025)
```json
[
  {"id": "LLM01", "name": "Prompt Injection", "severity": "critical"},
  {"id": "LLM02", "name": "Sensitive Information Disclosure", "severity": "high"},
  {"id": "LLM03", "name": "Supply Chain Vulnerabilities", "severity": "high"},
  {"id": "LLM04", "name": "Data and Model Poisoning", "severity": "high"},
  {"id": "LLM05", "name": "Improper Output Handling", "severity": "high"},
  {"id": "LLM06", "name": "Excessive Agency", "severity": "critical"},
  {"id": "LLM07", "name": "System Prompt Leakage", "severity": "medium"},
  {"id": "LLM08", "name": "Vector and Embedding Weaknesses", "severity": "high"},
  {"id": "LLM09", "name": "Misinformation", "severity": "medium"},
  {"id": "LLM10", "name": "Unbounded Consumption", "severity": "medium"}
]
```

### Layer 3: Vibe Coding / AI Dev Tool CVEs
```json
[
  {
    "id": "cve-2025-54135",
    "name": "CurXecute — Cursor IDE RCE",
    "severity": "critical",
    "affectedTool": "Cursor",
    "mitigation": "Update Cursor to 0.43.6+. Use MCP server allowlist. Rules that restrict auto-start MCP."
  },
  {
    "id": "cve-2025-54136",
    "name": "MCPoison — MCP Config Poisoning",
    "severity": "critical",
    "affectedTool": "Cursor, any MCP-enabled IDE",
    "mitigation": "Audit MCP configs in shared repos. Never auto-accept MCP configurations from untrusted sources."
  },
  {
    "id": "rules-file-backdoor",
    "name": "Rules File Unicode Backdoor",
    "severity": "critical",
    "affectedTool": "All IDEs accepting rule files",
    "mitigation": "Scan rule files for hidden Unicode (BiDi, zero-width joiners) before use. GitHub now warns on these."
  },
  {
    "id": "slopsquatting",
    "name": "Slopsquatting — Hallucinated Package Attack",
    "severity": "high",
    "affectedTool": "All AI coding tools",
    "mitigation": "Verify every AI-suggested package exists on npm/PyPI before installing. Use rules that prompt verification."
  },
  {
    "id": "stale-cve-suggestions",
    "name": "Training Cutoff CVE Blindness",
    "severity": "high",
    "affectedTool": "All AI coding tools",
    "mitigation": "Rules that enforce latest major versions, `npm audit`, and dependency pinning."
  },
  {
    "id": "cve-2025-32711",
    "name": "EchoLeak — Microsoft Copilot Zero-Click Exfiltration",
    "severity": "critical",
    "affectedTool": "GitHub Copilot",
    "mitigation": "Update Copilot. Rules that prevent prompt reflection patterns in AI-built features."
  }
]
```

---

## UI / UX REQUIREMENTS

### Navigation (persistent)
```
[Aigent.ly logo]   Rules   Threats   Stacks   Composer   Learn   |   Work with us   [GitHub ↗]
```

On scroll: `backdrop-blur-sm` + white/95 background (Tailwind class, no custom CSS).
Mobile: hamburger → shadcn/ui Sheet slide-in from right.
Keyboard shortcut: `Cmd+K` opens global search (shadcn/ui Command palette).

### Light / Dark Mode
- System preference via `next-themes`
- Toggle in nav (Sun/Moon icon, Lucide React)
- All colours must work in both modes using Tailwind's `dark:` prefix

### Responsive Breakpoints (Tailwind defaults, use as-is)
- Mobile: < 640px — single column, filter in bottom drawer (shadcn/ui Drawer)
- Tablet: 640-1024px — two columns where applicable
- Desktop: > 1024px — full three-column layouts

### Accessibility
- All interactive elements: keyboard navigable
- ARIA labels on icon-only buttons
- Focus rings visible (Tailwind `ring-*` classes)
- Color is never the only indicator of severity — always pair with text label
- Skip-to-main-content link at top of page

### Performance
- Lighthouse score ≥ 95 on all pages
- All rule listing pages: `generateStaticParams` for full SSG
- Images: `next/image` with explicit `width` and `height`
- Fonts: `next/font` — no FOUT
- Filter operations: ≤ 50ms response (all client-side, no API call)
- Core Web Vitals: CLS = 0, LCP < 1.5s, INP < 100ms

---

## OPEN SOURCE SETUP

### GitHub Repository Structure
```
aigently/                     # monorepo
├── apps/
│   └── web/                  # Next.js app (this prompt)
├── packages/
│   └── rule-schema/          # Shared Zod schemas for rule validation
├── db/
│   └── schema/
│       └── 001_aigently_core.sql  # Optional bootstrap; Drizzle journal under drizzle/ is canonical after first generate
├── drizzle/                       # Generated migrations (committed)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE                   # MIT
└── README.md
```

### README.md must include
- What is Aigent.ly (1 paragraph)
- Why it exists (the vibe coding security problem, with stats)
- Quick start (clone, install, run)
- How to contribute a rule (link to CONTRIBUTING.md)
- How the threat data is sourced and updated
- Aigent.ly certification criteria
- License

### CI/CD (GitHub Actions)
```yaml
# .github/workflows/validate-rules.yml
# On every PR that touches /content/rules/**:
# 1. Validate MDX frontmatter against Zod schema
# 2. Check for hidden Unicode characters in rule content (security)
# 3. Verify all protectsAgainst IDs exist in the threat database
# 4. Run Lighthouse CI
# 5. Comment on PR with rule preview
```

---

## LAUNCH CONTENT — MINIMUM VIABLE SEED

Ship with at minimum:

| Category | Count |
|---|---|
| Stacks covered | 10 (all listed above) |
| Security guardrail rules | 10 (one per stack, comprehensive) |
| Code quality rules | 10 (one per stack) |
| Architecture rules | 5 (major stacks) |
| Threat entries (OWASP Web) | 10 |
| Threat entries (OWASP LLM) | 10 |
| Threat entries (Vibe CVEs) | 6 |
| Learn articles | 4 |
| Stacks pages | 10 |

### 4 Required Launch Articles

1. **"Why 45% of vibe-coded apps fail their first pen test"**
   Data-driven. Covers the research, real CVE examples, why AI context blindness is the root cause.

2. **"The OWASP LLM Top 10 explained for developers, not security teams"**
   Practical. What each of the 10 means, with code examples of vulnerable vs. protected patterns.

3. **"Your .cursorrules file could be a backdoor"**
   The hidden Unicode attack vector. How to detect it. What rules protect against it.

4. **"How to make Claude Code, Cursor, and Copilot write secure Next.js by default"**
   Tutorial. Step-by-step guide for setting up security guardrail rules in each major IDE.

---

## V1 SCOPE — INCLUDED VS DEFERRED

### Included in v1

- **User authentication** — GitHub OAuth (primary), database sessions; see **AUTHENTICATION & ACCOUNTS**.
- **PostgreSQL + Drizzle** — reviews, helpful votes, article feedback, daily copy aggregates, optional threat/rule metadata sync; see **DATABASE — POSTGRESQL**.
- **Next.js Server Actions** — mutations for community features (Zod-validated inputs).

### Deferred (not v1)

- Real-time CVE API integration (static JSON under `/content/threats/`, manually updated; optional ETL into `threat` table).
- On-site **rule** submission form (contributions via **GitHub PR** only).
- Payments or subscriptions.
- Full **CMS** for rules/articles (MDX in Git remains authoritative for long-form content).
- Public ad-tech / third-party marketing pixels.
- Email newsletter integration.
- Password-only local credentials (v1 is OAuth-first; magic link optional if added later).

**Infrastructure:** V1 targets **Hostinger** (Node + PostgreSQL). Rule and article **bodies** stay in Git; the database backs **users, UGC, and aggregates** as specified above.

---

## DONE — START BUILDING

Begin with:
1. `npx create-next-app@latest aigently --typescript --tailwind --app`
2. Provision **PostgreSQL** (Hostinger or local Docker); set `DATABASE_URL`
3. Add **Drizzle** + **drizzle-kit**; define `lib/db/schema.ts`; `drizzle-kit generate` then `drizzle-kit migrate` (optional: import bootstrap from `db/schema/001_aigently_core.sql` once, then use only Drizzle migrations)
4. Configure **Auth.js** with GitHub OAuth and database adapter; add session tables
5. Install all shadcn/ui components listed above
6. Set up `next-themes` for dark mode
7. Create the content directory structure with seed data
8. Build the Navbar and Footer components (show sign-in / account when authenticated)
9. Build the Homepage
10. Build the Rules directory with filters
11. Build a single Rule detail page (reviews + helpful votes wired to Server Actions + DB)
12. Build the Composer
13. Build the Threats page

Ship the homepage and rules directory first. The composer and threats pages can be fast-follows.
```