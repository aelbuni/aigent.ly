# Aigent.ly — Launch Press Release & Marketing Assets

---

## Press Release

**FOR IMMEDIATE RELEASE**

---

### Aigent.ly Launches the First Open-Source Catalog of AI Coding Guardrails, Letting Developer IDEs Enforce Security Rules in Real Time

*Community-powered directory delivers CVE-backed guardrails directly into Cursor, Claude Code, Windsurf, and GitHub Copilot — stopping insecure code before it is written.*

**[City, Date]** — Aigent.ly today announced the public launch of its open-source AI coding guardrail catalog — a first-of-its-kind, continuously updated directory of security rules purpose-built for AI-assisted development environments.

As AI coding assistants generate more of the world's production code, security review is shifting left — from pull request to keypress. Aigent.ly closes the gap by curating CVE-backed threats, clustering them into actionable rules, and delivering them as guardrails directly into the IDE context of tools like Cursor, Claude Code, Windsurf, and GitHub Copilot.

"Developers are shipping AI-generated code faster than ever, but the models themselves have no memory of this week's CVEs," said [Founder Name], Founder of Aigent.ly. "Aigent.ly gives the IDE a live security conscience — not a linter that runs after the fact, but rules that fire the moment a model tries to generate something dangerous."

**How it works:**

Aigent.ly's six-phase data pipeline runs daily at 06:00 UTC, pulling vulnerability intelligence from NVD, GitHub Advisory Database (GHSA), CISA Known Exploited Vulnerabilities, and OSV. Each threat is amplified by Claude AI into ALWAYS/NEVER behavioral patterns, clustered into themed security rules, and summarized into per-stack guardrails scored for quality and consistency.

The resulting catalog — covering Next.js, Express, FastAPI, NestJS, Nuxt, and React SPA — is committed daily to a public GitHub repository and consumed by an MCP (Model Context Protocol) server that any IDE integration can query in real time.

**Key capabilities at launch:**

- **Live threat intelligence** — catalog refreshes daily from four authoritative CVE sources
- **Stack-specific guardrails** — security rules scoped to your exact technology (e.g., Next.js middleware auth bypass patterns vs. FastAPI injection patterns)
- **MCP server integration** — one-line setup for Cursor, Claude Code, Windsurf, and any MCP-compatible tool
- **Open data** — full catalog published as JSON snapshots under an open license
- **Security layers** — rules organized across 15 protection domains including Authentication & Session, Input Validation, Authorization & Access Control, Secrets & Credentials, and Dependency & Supply Chain

**Open Source:**

The CVE catalog, data pipeline, and guardrail snapshots are available at [github.com/aelbuni/aigently-catalog](https://github.com/aelbuni/aigently-catalog). Developers and security teams are invited to contribute stack coverage, flag rule quality issues, and propose new guardrail patterns.

**Availability:**

Aigent.ly is available today at [aigent.ly](https://aigent.ly). The MCP server can be connected in under two minutes. The open-source catalog is live on GitHub.

---

**About Aigent.ly**

Aigent.ly is a community-powered directory of AI coding guardrails. Its mission is to make security the default for AI-generated code by delivering live, CVE-backed rules directly into developer IDEs. The platform is built on an open data model — the full threat catalog and guardrail snapshots are published daily as open-source JSON.

**Contact:**
[Name] | [email] | [aigent.ly](https://aigent.ly)

---

---

## LinkedIn Post

---

**We just shipped something I've been building for a long time.**

AI coding assistants are writing more and more of the code that runs in production.

The problem? They don't know about this week's CVEs. They don't know your stack's specific auth vulnerabilities. They have no memory of the critical middleware bypass that was patched last Tuesday.

So I built **Aigent.ly** — the first open-source catalog of AI coding guardrails.

Here's the idea:

→ We pull CVEs daily from NVD, GHSA, CISA KEV, and OSV
→ Claude AI amplifies each threat into ALWAYS/NEVER behavioral rules
→ Rules are clustered per stack (Next.js, FastAPI, NestJS, Express, Nuxt, React SPA)
→ A live MCP server delivers those rules into your IDE in real time

The result: Cursor, Claude Code, and Windsurf now have a live security conscience — rules that fire at the moment the model tries to generate something dangerous, not after the PR is open.

**It's open source. The full catalog ships as JSON every day.**

Two-minute setup. No vendor lock-in. Community contributions welcome.

→ [aigent.ly](https://aigent.ly)
→ github.com/aelbuni/aigently-catalog

If you use AI coding tools and care about shipping secure code — I'd love your feedback.

#OpenSource #SecurityEngineering #AICode #DevSecOps #ClaudeCode #Cursor #MCP #AppSec #CVE

---

---

## Twitter / X Thread

---

**Tweet 1 (hook):**
AI coding assistants don't know about this week's CVEs.

They generate vulnerable auth code, then confidently tell you it's fine.

We built something to fix that. 🧵

---

**Tweet 2 (problem):**
Every day, devs ship AI-generated code with:
- Middleware-only auth checks (bypassable)
- JWT with no algorithm pinning
- Host header used in redirects (SSRF)
- Sessions never re-verified on sensitive ops

Not because they're careless. Because the model doesn't have live threat data.

---

**Tweet 3 (solution):**
Aigent.ly pulls CVEs daily from NVD, GHSA, CISA KEV + OSV

Claude amplifies each threat → ALWAYS/NEVER behavioral patterns

Those patterns → stack-specific guardrails (Next.js, FastAPI, NestJS, Express…)

Guardrails → MCP server → your IDE, in real time.

---

**Tweet 4 (proof):**
Example: CVE-2025-29927 (Critical — Next.js middleware auth bypass)

Without guardrails:
> Cursor generates middleware-only auth. Passes review. Ships to prod.

With Aigent.ly:
> "NEVER implement authorization only in middleware. ALWAYS enforce access control in the route handler."

---

**Tweet 5 (open source):**
The full catalog is open source.

Every CVE, every guardrail, every rule — committed to GitHub daily as JSON snapshots.

→ github.com/aelbuni/aigently-catalog

Two-minute MCP setup. Works with Cursor, Claude Code, Windsurf, Copilot.

---

**Tweet 6 (CTA):**
Live today → aigent.ly

Try it, break it, contribute a stack.

We're just getting started. 🔐

---

---

## Video Prompt Ideas

*For short-form social video (60–90 sec Reels / TikTok / YouTube Shorts)*

---

### Video 1 — "The CVE Your AI Doesn't Know About"

**Concept:** Split-screen screencast. Left: developer asks Cursor to "build a Next.js auth middleware." Right: Aigent.ly MCP returning the rule for CVE-2025-29927 in real time.

**Prompt for video AI / editor brief:**
> Open on a terminal. Developer types: "add auth middleware to protect all /dashboard routes." The AI generates clean-looking middleware code. Cut to: red banner — "CVE-2025-29927 · Critical · Authorization Bypass in Next.js Middleware." Text overlays: "Your IDE just generated bypassable auth." Then: Aigent.ly MCP fires. The rule appears inline. The model rewrites the code with a route-handler enforcement layer added. End card: aigent.ly — security rules that fire before the code ships.

**Mood:** urgent → resolved. Dark IDE background. Red → green color transition.

---

### Video 2 — "How 6 Phases Keep Your Stack Secure"

**Concept:** Animated pipeline diagram. Each phase animates in sequence with a brief narration overlay.

**Prompt for video AI / editor brief:**
> Start with a dark background and the text "Every day at 6am UTC…". Animate six steps appearing one by one as glowing nodes in a horizontal pipeline: (1) Fetch CVEs · NVD / GHSA / CISA KEV / OSV, (2) Claude AI amplifies each threat, (3) Rules clustered by attack vector, (4) Per-stack guardrails generated + scored, (5) JSON snapshots exported, (6) Committed to GitHub. Each node pulses as it activates. Final frame: "The catalog is open source. aigent.ly." Minimal motion-graphic style, monospace font, cyber-dark theme.

**Mood:** technical, trust-building, systematic. Dark blue / teal palette.

---

### Video 3 — "What an AI Guardrail Actually Looks Like"

**Concept:** Zoom into a single guardrail card from the Aigent.ly UI. Annotate each field with floating labels.

**Prompt for video AI / editor brief:**
> Screen recording of aigent.ly/stacks/nextjs. Slowly zoom into a guardrail card for "Authentication & Session." Floating annotations appear labeling: "CVE source," "ALWAYS/NEVER pattern," "Quality score," "Severity." Cut to: the same rule appearing in Claude Code's context window as the developer asks it to write a login handler. The model's response includes the WHEN/THEN/ELSE contract verbatim. End card: "Security rules. In your IDE. Today." aigent.ly.

**Mood:** product demo, clean, educational. Light/dark split.

---

---

## Image Prompt Ideas

*For GitHub repository README hero, social OG cards, and Twitter media*

---

### Image 1 — Repository Hero (README)

**Prompt:**
> Dark-background developer poster. Center: large monospace text "Aigent.ly" with a faint security shield icon behind it. Below: subtitle "AI Coding Guardrails — Live CVE-backed rules for Cursor, Claude Code, Windsurf." Bottom row: six stack logos (Next.js, FastAPI, NestJS, Express, Nuxt, React) arranged as glowing pill badges. Background texture: faint hex grid or circuit-trace pattern in deep navy. Accent color: electric blue (#3C50E0). Corner badge: "Open Source." Style: modern DevTool README hero, similar to Vercel or Supabase GitHub banners.

---

### Image 2 — "How It Works" Diagram Card

**Prompt:**
> Clean dark infographic card, 1200×630px. Title: "How Aigent.ly Works." Six icons in a left-to-right flow with connecting arrows: [Globe icon] Fetch CVEs → [Brain icon] AI Amplification → [Layers icon] Rule Clustering → [Shield icon] Guardrail Generation → [File icon] JSON Export → [IDE icon] Your IDE. Each step has a one-line label. Color: dark navy background, electric blue arrows, white text, green checkmarks on the last node. Bottom: "aigent.ly — open source."

---

### Image 3 — CVE Alert Social Card

**Prompt:**
> Dark red and dark background. Bold headline: "CVE-2025-29927 · Critical." Subtitle: "Authorization Bypass in Next.js Middleware." Below: two code blocks side-by-side labeled "Without Aigent.ly" (middleware-only auth, highlighted in red) and "With Aigent.ly" (route-handler enforcement added, highlighted in green). Bottom: Aigent.ly logo + "aigent.ly — security rules in your IDE." Style: security advisory card, similar to GitHub Security Advisory banners. Monospace font.

---

### Image 4 — Open Source Contributor Card

**Prompt:**
> Bright, welcoming open-source community card. Light background. Title: "Contribute to Aigent.ly." Three columns: (1) "Add a Stack" with a stack logo placeholder, (2) "Flag a Rule" with a flag icon, (3) "Star the Repo" with a GitHub star icon. Tagline: "Help make AI-generated code safer for everyone." Bottom: GitHub URL + aigent.ly logo. Style: clean, minimal, welcoming — similar to a GitHub contribution graph card.

---

### Image 5 — MCP Setup Card (Twitter media)

**Prompt:**
> Dark terminal-style card. Title: "Connect Aigent.ly in 2 minutes." Shows a JSON config snippet styled as a terminal block: `.mcp.json` with the Aigent.ly server entry filled in. Below the code: three IDE logos (Cursor, Claude Code, Windsurf) with green checkmark badges. Tagline: "Live CVE guardrails. In every AI IDE. Free." aigent.ly. Monospace font, neon green terminal accent on the code block.

---
