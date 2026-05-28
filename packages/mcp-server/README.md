# @aigently/mcp-server (private workspace package)

> This is the **private** workspace package inside aigently-v1. The public, published version lives at:
> **[github.com/aelbuni/aigently-catalog/packages/mcp-server](https://github.com/aelbuni/aigently-catalog/packages/mcp-server)**

---

## What this package does

Injects live CVE-backed security guardrails into AI coding IDEs via the Model Context Protocol (MCP). Works with Cursor, Claude Code, Windsurf, GitHub Copilot, and Cline.

- **Zero configuration** — auto-detects your stack from the file path
- **No API key required** — reads static JSON from the open-source catalog
- **Daily updates** — catalog is refreshed automatically by the Aigent.ly pipeline

---

## Quick install (from the public package)

```json
{
  "mcpServers": {
    "aigently": {
      "command": "npx",
      "args": ["-y", "@aigently/mcp-server"],
      "env": { "AIGENTLY_TARGET_IDE": "cursor" }
    }
  }
}
```

Change `AIGENTLY_TARGET_IDE` to `cursor`, `claude-code`, `windsurf`, `copilot`, or `cline`.

Full install instructions and IDE-specific config: [packages/mcp-server/README.md in the catalog repo](https://github.com/aelbuni/aigently-catalog/packages/mcp-server/README.md)

---

## Available MCP tools

| Tool | What it does |
| --- | --- |
| `detect_project_stack` | Detect stack from project file list — call first when setting up |
| `get_security_context` | Get security rules + CVEs for a coding task (auto-detects stack) |
| `compose_guardrail` | Generate a complete IDE-ready guardrail file for a stack and rule type |
| `list_stacks` | List all supported stacks |
| `list_layers` | List protection layer taxonomy (informational) |
| `search_threats` | Search CVE catalog by keyword, severity, OWASP ref, or stack |
| `get_threat` | Full CVE details + AI-generated guardrail patterns |
| `get_rule` | Full rule body + AI summary |
| `get_manifest` | Catalog version, last updated, counts |

---

## Development (private workspace)

```bash
# Build from monorepo root
npm run build -w @aigently/mcp-server

# Run smoke tests
node packages/mcp-server/scripts/test-tools.mjs
```

Changes to this workspace are kept in sync with the public catalog repo's `packages/mcp-server/` via periodic cherry-picks.
