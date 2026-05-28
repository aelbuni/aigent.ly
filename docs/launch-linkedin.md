# LinkedIn Launch Post

---

**Meet Aigent.ly: the open-source security context layer your AI coding tool has been missing.**

---

Vibe coding is a genuine shift in how software gets built.

The combination of AI coding assistants — Cursor, Claude Code, Windsurf, Lovable — and an expanding generation of builders is compressing what once took teams and quarters into weekends and solo sprints. By most forecasts, the volume of software produced in the next decade will dwarf everything built before it. That's a remarkable thing.

It also introduces a context problem that the industry hasn't fully reckoned with yet.

---

**The gap isn't skill. It's information velocity.**

AI coding models are trained on a snapshot of the world. Security, by its nature, changes daily. New CVEs are published continuously. The CISA Known Exploited Vulnerabilities catalog grows every week. Attack surfaces shift as frameworks evolve.

The model in your IDE doesn't know what changed yesterday — not because it's inadequate, but because the threat landscape moves faster than any training cycle can track.

This is a structural challenge, not a criticism of the tools. And it's exactly the kind of problem that infrastructure, not individual developer vigilance, is the right answer to.

What's particularly interesting is that the security community is beginning to respond in kind. Tools like Mythos and emerging AI-assisted vulnerability research pipelines — including work coming out of Google Project Zero and academic security labs — are demonstrating that AI is genuinely effective at *finding* vulnerabilities at scale. The same intelligence that accelerates development can accelerate discovery of its own blind spots.

The question becomes: how does that signal reach the developer before the code ships?

---

**Context engineering is the answer.**

The best teams building on AI today aren't just prompting better. They're managing context — the structured information that shapes how the model behaves across every generation. Threat rules, security constraints, CVE patterns: these belong in context, not in post-commit review.

That's the problem Aigent.ly is built to solve.

---

**How it works:**

Every day, our pipeline ingests active threats from five public intelligence sources: NVD, GitHub Advisory Database (GHSA), CISA KEV, Google OSV, and npm Audit. Claude AI synthesizes each CVE into precise behavioral rules — concrete ALWAYS/NEVER directives grounded in real attack patterns. Those rules are clustered per stack and assembled into a single governing context file for each technology.

The result: one current, accurate, authoritative security context — updated every 24 hours — ready to be injected into any AI coding tool before it writes a line.

When your IDE sees that file, it knows:

> *"For Next.js: NEVER rely solely on middleware for authorization — CVE-2025-29927 demonstrates this is bypassable at the routing layer. ALWAYS enforce access control at the route handler."*

The context travels with the code. The guardrail fires at generation time, not audit time.

---

**Two paths to integration — neither requires significant setup:**

The MCP server (Model Context Protocol) connects directly to Cursor, Claude Code, Windsurf, Copilot, and Cline via a single config line. Threat context is injected automatically on every generation.

For teams who prefer file-based context — or who use Claude Code's `CLAUDE.md` memory, Cursor's `.cursor/rules`, or Windsurf's `.windsurfrules` — the Rule Composer generates your stack's guardrail file in under 60 seconds. Drop it into your repository. Every AI assistant on the project picks it up. No server, no ongoing configuration. The rules live where they belong: alongside the code.

---

**Where the catalog is going:**

Today we cover the stacks that power most of the modern web:
**Next.js · Express · FastAPI · NestJS · Nuxt · React SPA**

Coming next: **Django · Ruby on Rails · Go · iOS · Android** — and beyond.

Five threat sources today. The Go vulnerability database, RubyGems advisories, PyPI feeds, and Maven are on the roadmap. The catalog is open source and community-driven. Every new source means more signal. Every new stack means more developers covered.

The goal is straightforward: comprehensive threat context for every major application stack, maintained as open infrastructure, free to use and contribute to.

---

**Aigent.ly is open source. Apache 2.0. No API key. No account.**

The catalog data, the pipeline, and the MCP server are all public. The project is designed to grow with the community and with the threat landscape — not as a product that ships and stays static, but as infrastructure that compounds over time.

If you're building with AI coding tools and thinking about how security context fits into that workflow, I'd be glad to hear your perspective.

🔗 Try the Rule Composer: **aigent.ly/composer**
⭐ Explore the catalog: **github.com/aelbuni/aigently-catalog**

---

**A note on contribution:**

Every application built on better security context is one less breach, one less exposed user, one less incident report at 2am.

If you work in security research, application engineering, or AI development — there is meaningful work to do here. Add a stack your ecosystem depends on. Sharpen a CVE pattern that's too generic. Propose a new threat source. Write a rule that reflects what you've seen in the field.

The catalog improves fastest when people who understand the real threat landscape help shape it. If that's you, the repo is open and the contribution guide is straightforward.

The next application that doesn't get compromised might be built by someone who has never thought about security once. That's exactly who this is for — and exactly why it needs the sharpest minds contributing to it.

---

Tags: #ContextEngineering #VibeCoding #AppSec #OpenSource #AICode #MCP #DevSecOps #SecurityEngineering #ClaudeCode #Cursor #SoftwareDevelopment
