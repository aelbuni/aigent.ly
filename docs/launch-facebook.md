# Facebook Launch Post

Something big is happening in software development — and most people don't see the risk coming.

Over the next 10 years, AI coding tools are going to enable an explosion of new apps, startups, and digital products unlike anything we've seen before. Tools like Cursor, Claude Code, Windsurf, and Lovable are making it possible for anyone with an idea to ship working software in days, not months.

That's genuinely exciting. I'm here for it.

But here's what keeps me up at night: **the AI models writing all that code were trained on yesterday's data.**

They have no idea a critical security vulnerability was published last Tuesday. They don't know which authentication pattern was found bypassable last month. They'll write code that looks perfectly correct — and quietly leave a door open for attackers.

As the number of AI-generated apps grows, so does the attack surface. And most of the people building these apps have never thought about CVEs, OWASP, or security hardening in their lives.

---

## This is why I built Aigent.ly

Aigent.ly is a free, open-source vulnerability prevention layer designed specifically for the vibe coding era.

Every day, our automated pipeline collects active security threats from 5 major public sources — the US government's CISA Known Exploited Vulnerabilities list, NVD, GitHub's advisory database, Google's OSV, and npm Audit. It covers the real-world threats that affect the stacks developers actually use: Next.js, Express, FastAPI, NestJS, Nuxt, and React SPA.

Each threat gets transformed by Claude AI into clear, actionable rules — things like "NEVER trust middleware-only auth checks" or "ALWAYS validate outbound request hostnames against an allowlist." These rules get assembled into a single governing ruleset per stack, updated every 24 hours.

---

## Two ways to use it — pick what fits your workflow

Option 1: Install the MCP server (one line)

Add Aigent.ly to your IDE's MCP config. When you ask Cursor or Claude Code to build a login system, Aigent.ly fires automatically. The AI already knows the current security rules for your stack before it writes a single line. The vulnerability never gets written in the first place.

Works with Cursor, Claude Code, Windsurf, GitHub Copilot, and Cline.

Option 2: Drop a file into your project (no server needed)

Use the Rule Composer to generate your stack's guardrail file in under 60 seconds, then drop it directly into your IDE's native memory:

- Claude Code → `CLAUDE.md` or `SKILL.md` — auto-loaded every session, no setup required
- Cursor → `.cursor/rules/aigently-nextjs-security.mdc` — Cursor picks it up automatically
- Windsurf → `.windsurfrules`
- Copilot → `.github/copilot-instructions.md`

One file. Committed to your repo alongside your code. Every AI assistant on your team picks it up automatically — no server, no ongoing configuration. The security rules travel with the codebase, exactly where they belong.

---

## What's available today — and where this is going

We launched with the stacks that power most of the modern web:
**Next.js · Express · FastAPI · NestJS · Nuxt · React SPA**

Already in the pipeline: **Django · Ruby on Rails · Go · iOS · Android**

And the goal is bigger than that. Every major application stack. Every language. Every ecosystem. When developers build on Laravel, Spring Boot, or Flutter — Aigent.ly should have them covered too. The stack registry is open source and community-driven, so anyone can submit a new one.

Same with data sources. Today we pull from five: NVD, GHSA, CISA KEV, OSV, and npm Audit. Next come RubyGems advisories, the Go vulnerability database, PyPI vulnerability feeds, and Maven. As each source is added, more developers get protected automatically — no action needed on their end, the daily pipeline just gets richer.

This isn't a product that launches and stays static. It's infrastructure that grows with the threat landscape. Every new CVE source, every new stack, every community contribution makes the rules sharper for everyone.

Here's where things stand today:

- **100+ active CVEs** tracked across 6 launch stacks, updated every 24 hours
- **5 threat intelligence sources**, expanding to cover every major ecosystem
- **6 stacks fully guardrailed** — 10+ on the near-term roadmap
- MCP server for live IDE injection (Cursor, Claude Code, Windsurf, Copilot, Cline)
- Rule Composer — generate your guardrail file in 60 seconds
- Fully open source (Apache 2.0) — no API key, no account, no cost, ever

---

The tools that help us build fast need to also keep us safe. As the number of AI-generated apps grows exponentially, the number of AI-generated vulnerabilities will too — unless we give developers the context layer that prevents them.

Aigent.ly is that layer.

If you build with AI coding tools, try it today.
If you know someone who does, share this with them.
If you want to contribute — the repo is open and we'd love the help.

🔗 Try the Rule Composer in 60 seconds: **aigent.ly/composer**
⭐ Explore the open-source catalog: **github.com/aelbuni/aigently-catalog**

Drop a comment — what's the security concern you think about most when shipping AI-generated code?

Tags: #VibeCoding #AICode #Cybersecurity #OpenSource #AppSec #SoftwareDevelopment #ContextEngineering #ClaudeCode #Cursor
