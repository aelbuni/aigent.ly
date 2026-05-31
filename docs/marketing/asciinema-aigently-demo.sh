#!/usr/bin/env bash
# Aigent.ly MCP — Asciinema marketing demo (85–95s)
# Scenario: before/after — three 2026 CVEs a vibe coder's AI would never know
# Project:  launchkit — hypothetical Next.js 15 SaaS starter
#
# Record:
#   export COLUMNS=110 LINES=34
#   asciinema rec \
#     -t "Aigent.ly MCP — What your AI was about to miss" \
#     --window-size 110x34 --idle-time-limit 2 \
#     -c "bash docs/marketing/asciinema-aigently-demo.sh" \
#     docs/marketing/aigently-mcp-demo.cast
#
# Dry-run (no recording):
#   DEMO_FAST=1 bash docs/marketing/asciinema-aigently-demo.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MCP="node $REPO_ROOT/packages/mcp-server/scripts/demo-cli.mjs"

if [[ ! -f "$REPO_ROOT/packages/mcp-server/dist/tools.js" ]]; then
  (cd "$REPO_ROOT" && npm run build -w @aigently/mcp-server >/dev/null 2>&1)
fi

# ── Colors ────────────────────────────────────────────────────────────────────
DEV='\033[1;36m'      # cyan    — developer
CLAUDE='\033[1;35m'   # purple  — Claude Code agent
TOOL='\033[1;33m'     # amber   — MCP tool call
CRIT='\033[1;31m'     # red     — critical severity
HIGH='\033[38;5;208m' # orange  — high severity
OK='\033[1;32m'       # green   — after / resolved
DIM='\033[2m'         # dim     — metadata
BOLD='\033[1m'        # bold
NC='\033[0m'

pause() {
  if [[ "${DEMO_FAST:-}" == "1" ]]; then sleep 0.05; else sleep "${1:-1.5}"; fi
}

dev()    { echo -e "${DEV}▶ dev${NC}    $*"; pause 1.8; }
claude() { echo -e "${CLAUDE}▶ claude${NC} $*"; pause 1.4; }
tool()   { echo -e "${TOOL}  [mcp]${NC}   $*"; pause 0.6; }
dim()    { echo -e "${DIM}           $*${NC}"; pause 0.5; }

typewriter() {
  local line="$1" delay="${2:-0.022}"
  printf "           "
  while IFS= read -rn1 char; do
    printf '%s' "$char"
    if [[ "${DEMO_FAST:-}" != "1" ]]; then sleep "$delay"; fi
  done <<< "$line"
  printf '\n'
  pause 0.3
}

# ── ACT 1 — Naive plan: what Claude proposes without threat context (0:00–0:18)
clear 2>/dev/null || true
echo ""
dim "launchkit  ·  Next.js 15 SaaS  ·  Claude Code + Aigently MCP"
echo ""
pause 1.5

dev "Protect /admin with middleware. Add a server action that proxies user data to our analytics API."
echo ""

claude "Here's the plan:"
echo ""
echo "           launchkit — /admin protection + analytics proxy"
echo ""
echo "           middleware.ts        → match /admin/**; redirect if no session"
echo "           app/(admin)/page.tsx → admin dashboard, session-gated"
echo "           actions/analytics.ts → axios.post(ANALYTICS_URL, req.body)"
echo ""
pause 1.2

dev "Before we write it — pull the threat context."
echo ""
pause 0.5

# ── ACT 2 — Aigently MCP: live CVE feed (0:18–0:42) ──────────────────────────
tool "aigently.get_security_context"
dim "  intent : \"admin panel middleware protection, server action proxying user data\""
dim "  stacks : [\"nextjs\"]"
echo ""

CTX=$($MCP get_security_context '{
  "intent": "admin panel middleware protection server action proxying user data to external API",
  "stacks": ["nextjs"]
}' 2>/dev/null) || CTX=""

if [[ -n "$CTX" ]]; then
  echo "$CTX" | jq -r '"  → \(.rules | length) rule loaded  ·  \(.top_threats | length) CVEs surfaced  ·  519 threats in catalog  ·  updated 2026-05-28"' 2>/dev/null \
    || dim "  → 1 rule loaded  ·  5 CVEs surfaced  ·  519 threats in catalog  ·  updated 2026-05-28"
else
  dim "  → 1 rule loaded  ·  5 CVEs surfaced  ·  519 threats in catalog  ·  updated 2026-05-28"
fi
echo ""
pause 0.6

# ── ACT 3 — Three 2026 CVEs, all unknown to any LLM (0:42–1:05) ──────────────

# CVE-2026-45109 — segment-prefetch middleware bypass, Turbopack, May 2026
tool "aigently.get_threat  { id: \"CVE-2026-45109\" }"
T1=$($MCP get_threat '{"id":"CVE-2026-45109"}' 2>/dev/null) || T1=""
if [[ -n "$T1" ]]; then
  echo "$T1" | jq -r '"  \(.severity | ascii_upcase)    \(.cveId)    \(.name)"' 2>/dev/null \
    | while IFS= read -r line; do echo -e "${HIGH}${line}${NC}"; done
else
  echo -e "${HIGH}  HIGH    CVE-2026-45109    Next.js Middleware bypass via segment-prefetch (Turbopack) — Incomplete Fix${NC}"
fi
dim "  published : 2026-05-11  ·  patched : next >=15.5.18 / >=16.2.6"
dim "  fix for CVE-2026-44575 did not apply to Turbopack builds"
dim "  pattern  : NEVER rely on middleware as the sole /admin boundary"
echo ""
pause 0.8

# CVE-2026-44573 — i18n data route bypass
tool "aigently.get_threat  { id: \"CVE-2026-44573\" }"
T2=$($MCP get_threat '{"id":"CVE-2026-44573"}' 2>/dev/null) || T2=""
if [[ -n "$T2" ]]; then
  echo "$T2" | jq -r '"  \(.severity | ascii_upcase)    \(.cveId)    \(.name)"' 2>/dev/null \
    | while IFS= read -r line; do echo -e "${HIGH}${line}${NC}"; done
else
  echo -e "${HIGH}  HIGH    CVE-2026-44573    Next.js Pages Router: i18n /_next/data routes bypass middleware${NC}"
fi
dim "  patched : next >=15.5.16"
dim "  /_next/data/<buildId>/admin/users.json never reaches middleware"
dim "  pattern  : ALWAYS enforce auth in getServerSideProps / layout, not only middleware"
echo ""
pause 0.8

# CVE-2026-42039 — Axios DoS via user-controlled request body
tool "aigently.get_threat  { id: \"CVE-2026-42039\" }"
T3=$($MCP get_threat '{"id":"CVE-2026-42039"}' 2>/dev/null) || T3=""
if [[ -n "$T3" ]]; then
  echo "$T3" | jq -r '"  \(.severity | ascii_upcase)    \(.cveId)    \(.name)"' 2>/dev/null \
    | while IFS= read -r line; do echo -e "${HIGH}${line}${NC}"; done
else
  echo -e "${HIGH}  HIGH    CVE-2026-42039    Axios: unbounded recursion in toFormData — DoS via deeply nested data${NC}"
fi
dim "  axios.post(url, req.body) → attacker sends {a:{a:{a:...}}} 2500 deep → RangeError → crash"
dim "  pattern  : NEVER forward raw req.body into axios without depth-bounding input first"
echo ""
pause 1.2

# ── ACT 4 — BEFORE / AFTER (1:05–1:28) ───────────────────────────────────────
claude "Revising the plan — three gaps in the original:"
echo ""
pause 0.8

echo -e "${BOLD}           BEFORE${NC}  ${DIM}──────────────────────────────────────────────────────────────────${NC}"
echo -e "${HIGH}           middleware.ts          sole /admin boundary    ← CVE-2026-45109  Turbopack bypass${NC}";  pause 0.5
echo -e "${HIGH}           /_next/data/**         unreachable by matcher  ← CVE-2026-44573  i18n data route${NC}";  pause 0.5
echo -e "${HIGH}           axios.post(url,req.body)  no depth guard       ← CVE-2026-42039  DoS crash${NC}";        pause 0.5
echo ""
pause 1

echo -e "${BOLD}           AFTER${NC}   ${DIM}──────────────────────────────────────────────────────────────────${NC}"
typewriter "  middleware.ts              sign-in redirect only  (never sole auth boundary)" 0.018
typewriter "  app/(admin)/layout.tsx     getServerSession() + role === 'admin'  enforced server-side" 0.018
typewriter "  actions/analytics.ts       validate + depth-limit req.body before axios.post()" 0.018
echo ""
pause 0.8

echo -e "${DIM}           NEVER  trust middleware as the only boundary — patch history repeats (45109 ← 44575)${NC}"; pause 0.4
echo -e "${DIM}           NEVER  pass raw req.body into axios on a server action${NC}";                               pause 0.4
echo -e "${OK}           ALWAYS enforce role in layout and re-validate every server action input${NC}"
echo ""
pause 2.5

dim "Context enriched with 2026 threat data by Aigently MCP  ·  519+ threats  · Open Catalog·  updated daily"
echo -e "${DIM}           aigent.ly  ·  npx @aigently/mcp-server  · Apache-2.0${NC}"
echo ""

pause 4
