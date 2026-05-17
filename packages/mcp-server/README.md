# @aigently/mcp-server

Security guardrail injection for AI coding assistants — powered by real CVE data updated daily.

Install this MCP server in Cursor, Windsurf, or Claude Code and your AI will automatically receive the right security rules and live CVE context whenever you write security-sensitive code.

---

## Quick Start

No installation required. Run directly with `npx`:

```json
{
  "mcpServers": {
    "aigently": {
      "command": "npx",
      "args": ["-y", "@aigently/mcp-server"]
    }
  }
}
```

**Cursor** — add to `~/.cursor/mcp.json`

**Claude Code** — add to `~/.claude/mcp_settings.json`

**Windsurf** — add to `~/.codeium/windsurf/mcp_config.json`

---

## How It Works

When you ask your AI to implement a feature, the `get_security_context` tool is automatically called with your intent. It:

1. Detects your tech stack from your description and file path
2. Returns the matching security rule with ALWAYS/NEVER guardrail patterns
3. Surfaces the top CVE threats relevant to what you're building, ranked by exploitability and severity

**Example:**

> "I'm adding JWT auth to my Next.js API route"

The server detects `nextjs` + coding intent, returns the `nextjs-security-patterns-v1` rule and the top actively-exploited auth-related CVEs — injected directly into the AI's context before it writes a single line of code.

---

## Available Tools

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `get_security_context` | **Primary tool.** Auto-detects stack and injects the right rules + top threats | `intent` (required), `file_path`, `stacks` |
| `list_stacks` | All supported stacks with security grade and catalog status | — |
| `get_rule` | Full rule content (bodyMdx + AI-synthesized CVE summary) | `slug` |
| `search_threats` | Search/filter the CVE catalog | `query`, `severity`, `owasp_ref`, `stack_slug`, `limit` |
| `get_threat` | Full threat detail including AI-generated guardrail patterns | `id` (CVE ID or publicId) |

---

## Supported Stacks

| Slug | Name | Ecosystem |
|------|------|-----------|
| `nextjs` | Next.js | npm |
| `express` | Express | npm |
| `fastapi` | FastAPI | PyPI |
| `nestjs` | NestJS | npm |
| `nuxt` | Nuxt | npm |
| `react-spa` | React SPA | npm |

More stacks added regularly. Check `list_stacks` for the current catalog.

---

## Data Sources

All threat data is sourced from public databases — no proprietary feeds, no login required:

- **NVD** (NIST National Vulnerability Database) — CVSS scores, CWE classifications
- **OSV.dev** (Google Open Source Vulnerabilities) — ecosystem-aware advisories
- **GitHub Advisory Database** — npm, PyPI, Go, and more
- **CISA KEV** (Known Exploited Vulnerabilities catalog) — actively exploited flag

Security rules are synthesized by Claude using the ingested CVE data, then reviewed and versioned.

---

## Data Versioning

The underlying catalog (`packages/catalog-data/`) is a set of versioned JSON files committed to the [Aigently GitHub repo](https://github.com/aelbuni/aigently-v1) after every daily pipeline run. Each file includes a `generatedAt` timestamp.

Use the `get_manifest` tool to see the current catalog version and counts.

npm package versions follow the catalog: patch bumps on data-only updates, minor bumps when new stacks or tools are added.

---

## License

MIT
