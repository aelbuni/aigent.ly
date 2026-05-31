# Aigent.ly MCP — Terminal demo voiceover & captions

Terminal cast script: [`asciinema-aigently-demo.sh`](asciinema-aigently-demo.sh)

**Target length:** 85–95 seconds
**Scenario:** `launchkit` — Next.js 15 SaaS starter. Developer asks Claude Code to plan `/admin` middleware protection and a server action that proxies user data. Aigently MCP pulls three 2026 CVEs — all published after any LLM's training cutoff — and rewrites the plan before a single file is created.

**Record from repo root:**

```bash
export COLUMNS=110 LINES=34

asciinema rec \
  -t "Aigent.ly MCP — What your AI was about to miss" \
  --window-size 110x34 --idle-time-limit 2 \
  -c "bash docs/marketing/asciinema-aigently-demo.sh" \
  docs/marketing/aigently-mcp-demo.cast
```

Post-production:

```bash
asciinema auth
asciinema upload docs/marketing/aigently-mcp-demo.cast
# Optional GIF (requires agg: brew install agg):
agg docs/marketing/aigently-mcp-demo.cast docs/marketing/aigently-mcp-demo.gif --theme dracula --speed 1.2
```

Local preview / dry-run:

```bash
asciinema play docs/marketing/aigently-mcp-demo.cast
DEMO_FAST=1 bash docs/marketing/asciinema-aigently-demo.sh
```

---

## The three 2026 CVEs in this demo

All three are Next.js-specific, published in 2026, and unknown to any LLM trained before mid-2026.

| CVE | Severity | What it breaks in the naive plan |
| --- | --- | --- |
| CVE-2026-45109 | HIGH | Middleware bypass via segment-prefetch — the patch for CVE-2026-44575 didn't apply to Turbopack builds. Patched `next >=15.5.18`. |
| CVE-2026-44573 | HIGH | Pages Router i18n: `/_next/data/<buildId>/admin/users.json` never reaches middleware matcher. Patched `next >=15.5.16`. |
| CVE-2026-42039 | HIGH | Axios `toFormData` unbounded recursion — `axios.post(url, req.body)` with attacker-controlled nested JSON crashes the Node process. |

The naive plan has all three gaps. The revised plan after Aigently context has none.

---

## Core message

Vibe coders ship fast. Their AI plans from frozen training data. Aigently MCP injects live CVE context before the first file is created — not as a CI scanner that runs after merge.

---

## Voiceover script

### ACT 1 — The naive plan (0:00–0:18)

**On-screen caption:** *Your AI plans from training data. Training data has a cutoff.*

**Voiceover:**
> This developer is asking Claude Code to protect an admin panel and add a server action that forwards user data to an analytics API. Standard task. Claude gives a confident, correct-looking plan. Middleware gates /admin. Session check on the page. Axios proxies the payload.
>
> Everything it knows says this is fine.

---

### ACT 2 — Live 2026 threat context injected (0:18–0:42)

**On-screen caption:** *519 threats · updated daily · three surfaced in 2 seconds*

**Voiceover:**
> Before the first file is written, Aigently MCP pulls the current Next.js threat catalog. Three CVEs surface — all published in 2026. None of them are in any model's training data.
>
> CVE-2026-45109: the fix for the previous middleware bypass didn't apply to Turbopack builds. Patched two weeks ago.
>
> CVE-2026-44573: i18n data routes skip the middleware matcher entirely. `/admin/users.json` is publicly reachable.
>
> CVE-2026-42039: Axios crashes with a stack overflow if an attacker sends a deeply nested object as `req.body`. Your server action forwards it directly.

---

### ACT 3 — Before / after (0:42–1:22)

**On-screen caption:** *Three gaps in. Three gaps out.*

**Voiceover:**
> The plan revises. Middleware becomes a sign-in redirect only — never the sole boundary. Role enforcement moves into the layout server-side, where bypasses can't reach it. The server action validates and depth-limits input before it touches axios.
>
> The original plan would have shipped. The revised plan won't.

**End card:**

- [aigent.ly](https://aigent.ly)
- `npx @aigently/mcp-server`
- $0 · Apache-2.0 · Claude Code · Cursor · Windsurf

---

## Voiceover production guide

### Recommended tool: ElevenLabs

**Voice:** "Adam" or "Callum"
**Model:** `eleven_multilingual_v2` for final cut; `eleven_turbo_v2_5` for iteration
**Stability:** 0.60 · **Similarity boost:** 0.75 · **Style:** 0 · **Speaker boost:** on

**Tone:** Senior engineer presenting at a conference — not a product demo. Direct, no upward inflection. Short declarative sentences. Let pauses do the work.

**Delivery notes:**

- Slow down slightly on each CVE ID — `CVE-2026-45109` — let it read as a real identifier, not filler
- Pause 1s after "Everything it knows says this is fine." — that's the hook
- "Patched two weeks ago." — flat, matter-of-fact delivery. That's the gut-punch.
- Pause 2s before "The original plan would have shipped." — audience needs to sit with the before/after
- "The revised plan won't." — period. Don't add anything after it.

**Script word count:** ~165 words → ~95s at 100 WPM with pauses

### Alternative tools

| Tool | Notes |
| --- | --- |
| **Descript Overdub** | Good if recording your own voice + AI cleanup |
| **Play.ht** | Slightly more expressive range |
| **Murf** | Reliable, less control |
| **Your own voice** | Most authentic — normalize in Descript, remove filler |

---

## Universal scenarios (carousel / thread)

1. **Admin auth:** middleware + server action → CVE-2026-45109 + CVE-2026-44573
2. **Data proxy:** `axios.post(url, req.body)` → CVE-2026-42039 DoS crash
3. **SSRF:** server action fetching user-supplied URL → CVE-2024-34351
4. **JWT:** `jwt.verify()` no algorithm list → CVE-2022-23539
5. **Team rules:** `compose_guardrail` → `.claude/` baseline for every session

---

## Social post copy

**X / short:**

> Claude planned middleware-only /admin auth + `axios.post(url, req.body)`.
> Three 2026 CVEs say both are wrong.
> Aigently MCP surfaced them before a single file was written.
> Free · one config line → aigent.ly

**LinkedIn:**

> Every AI coding assistant has a training cutoff.
>
> CVE-2026-45109 (May 2026): the middleware bypass fix didn't apply to Turbopack. CVE-2026-44573: i18n data routes skip middleware entirely. CVE-2026-42039: forwarding `req.body` through axios crashes your server.
>
> None of these are in any model's training data. Aigently MCP injects them into the planning session — before the first file exists.
>
> Free. Apache-2.0. One config line. → aigent.ly

---

## Platform cuts

| Platform | Timestamp | Hook |
| --- | --- | --- |
| X / LinkedIn clip | 0:18–0:42 | Three 2026 CVEs surface in real time |
| X / LinkedIn clip | 0:42–1:22 | BEFORE / AFTER side by side |
| YouTube Shorts | Full 95s | Complete arc |
| README embed | ACT 2–3 | CVE detail + plan revision |

---

## MCP config

```json
{
  "mcpServers": {
    "aigently": {
      "command": "npx",
      "args": ["-y", "@aigently/mcp-server"],
      "env": { "AIGENTLY_TARGET_IDE": "claude-code" }
    }
  }
}
```

---

## Recording checklist

- [ ] Terminal theme: Dracula or Monokai (set in iTerm2 Profile)
- [ ] Font: JetBrains Mono or Fira Code, 14–15px
- [ ] `brew install asciinema jq`
- [ ] `npm run build -w @aigently/mcp-server`
- [ ] `export COLUMNS=110 LINES=34` before recording
- [ ] Dry-run first: `DEMO_FAST=1 bash docs/marketing/asciinema-aigently-demo.sh`
- [ ] Do **not** run `asciinema theme set` — removed in asciinema 3.x
