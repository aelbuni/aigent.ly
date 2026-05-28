# Twitter / X Launch Thread

## Thread

### Tweet 1 — Hook

The next 10 years will produce more software than the previous 50 combined.

All of it written with AI.

None of the AI models know about last week's CVEs.

We built something about this. 🧵

---

### Tweet 2 — The vibe coding wave

Vibe coding is going exponential.

Cursor. Claude Code. Windsurf. Lovable. Bolt.

Millions of apps built by people who've never touched a security audit.

Speed is the whole point. But speed without guardrails doesn't create bugs.

It creates vulnerabilities. At scale.

---

### Tweet 3 — The problem

AI coding models were trained on yesterday's code.

They don't know:
→ The CVE published last Tuesday
→ The Next.js middleware bypass from March
→ Which auth pattern is actively exploited right now

They'll write it confidently. It'll pass review. It'll ship.

---

### Tweet 4 — Context engineering

The real unlock isn't prompting better.

It's context engineering — giving AI the rules, constraints, and threat data it needs BEFORE it writes a line of code.

That's where security lives now. Not in the PR review. In the context window.

---

### Tweet 5 — What we built

Introducing Aigent.ly.

Every day our pipeline pulls from 5 threat sources (NVD, GHSA, CISA KEV, OSV, npm Audit).

Claude AI turns each CVE into ALWAYS/NEVER behavioral rules.

Rules synthesize into one governing file per stack.

That file lives in your IDE. Always current.

---

### Tweet 6 — The MCP layer

We publish everything through an MCP server.

One line in your IDE config. That's it.

Now when you ask Cursor to build a login system, it already knows:

"NEVER trust middleware-only auth — CVE-2025-29927 is actively exploited. ALWAYS enforce at the route handler."

The vulnerability never gets written.

---

### Tweet 7 — No server required

You don't even need the MCP server.

Generate your guardrail file → drop it in:

Claude Code → `CLAUDE.md` or `SKILL.md` (auto-loaded every session)
Cursor → `.cursor/rules/aigently-nextjs-security.mdc`
Windsurf → `.windsurfrules`
Copilot → `.github/copilot-instructions.md`

One file. Committed to your repo. Every AI on the team gets the rules. No setup.

---

### Tweet 8 — This is just the start

Today: Next.js, Express, FastAPI, NestJS, Nuxt, React SPA

Next: Django, Rails, Go, iOS, Android

After that: every major stack. Every language. Every ecosystem.

5 threat sources today. RubyGems, PyPI, Go vulndb, Maven on the way.

The catalog grows with the community. Open source. No ceiling.

---

### Tweet 9 — What ships now

→ 100+ active CVEs across 6 stacks (growing)
→ 5 public threat sources (expanding)
→ MCP server: Cursor, Claude Code, Windsurf, Copilot, Cline
→ Rule Composer: your guardrail file in 60 seconds
→ Drop-in files for `CLAUDE.md`, `.mdc`, `.windsurfrules`
→ 100% open source, Apache 2.0, no API key required

---

### Tweet 9 — CTA

Try it: aigent.ly/composer

Star it: github.com/aelbuni/aigently-catalog

Contribute a stack. Flag a bad rule. Build with us.

Vibe coding is the future. Let's make it a safe one. 🔐

---

## Standalone tweet

Your AI coding tool doesn't know about this week's CVEs.

Aigent.ly does.

Free MCP server. Daily threat updates. One line to set up.
Or just drop a `CLAUDE.md` / `.cursor/rules` file into your repo — no server needed.

→ aigent.ly

Tags: #VibeCoding #AICode #AppSec #OpenSource #MCP #DevSecOps #ContextEngineering
