# Guardrails — Golden Blueprint

> Canonical reference for what a guardrail is, how the 4-stage pipeline produces them,
> quality standards, and the scoring systems. Read this before touching any summarizer code.

---

## 1. What is a Guardrail?

A **guardrail** is a synthesized, layer-scoped security rule injected into an AI coding
assistant (Cursor, Claude Code, Windsurf, Cline, Copilot). It merges N community-contributed
rules for a given stack and protection layer into one authoritative document the IDE
injects as system context.

### Three representations

| Form | Where stored | What it is |
| --- | --- | --- |
| **Raw rule** | `rule.bodyMdx` | MDX document authored by contributors |
| **Amplified pattern** | `threat.aiAmplification` (JSON) | ALWAYS/NEVER atoms + ruleContext generated per CVE |
| **Synthesized guardrail** | `summarized_guardrail.content` | Merged output of N rules for one (stack, layer) pair |

### How it reaches the developer

1. IDE calls the MCP `compose_guardrail` tool → `/v1/summarize` API
2. `/v1/summarize` reads `summarized_guardrail` cache → returns plain text
3. IDE injects plain text as system context before code generation

---

## 2. The 4-Stage LLM Pipeline

```
External URL / CVE feed
        │
        ▼
┌───────────────────┐
│ Stage 1: INGEST   │  1 LLM call per URL  (Sonnet 4.6)
│ ingest-url-threat │  → threat + article rows in DB
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Stage 2: AMPLIFY  │  1 LLM call per 5 threats  (Haiku 4.5)
│ amplify-threats   │  → threat.aiAmplification JSON
└────────┬──────────┘
         │  (rules manually curated or seeded)
         ▼
┌───────────────────┐
│ Stage 3: ATOMS    │  No LLM — regex extraction + conflict resolution
│ lib/summarizer/   │  → DirectiveAtom[] per (rule, layer)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Stage 4: SYNTHESIZE│  1 LLM call per stack (all layers batched)  (Sonnet/Opus)
│ summarizer/pipeline│  → summarized_guardrail rows, quality_score stored
└───────────────────┘
```

Each stage is independent and cacheable. Stages 1–2 run via CLI scripts.
Stage 4 runs via the admin dashboard or `/v1/summarize` API.

---

## 3. Task 1 — Content Ingest (`content_ingest`)

**Trigger:** `pnpm --filter web ingest:url URL=https://...`

**Model:** Sonnet 4.6 — article reading comprehension, noisy HTML

**Input:** Article URL → stripped body text (≤8000 chars)

**Output:** Two DB rows — `threat` + `article`

**Tool:** `extract_threat_from_article`

**Output shape:**

```json
{
  "threat": {
    "publicId": "CVE-2024-12345 | AIGENTLY-2026-<slug>",
    "name": "≤80 chars",
    "description": "2-3 sentences: what, how exploited, impact",
    "severity": "critical | high | medium | low | info",
    "family": "owasp_web | owasp_llm | mitre_atlas | vibe_coding",
    "owaspRefs": ["A01", "A03"],
    "patternLines": ["ALWAYS ...", "NEVER ..."],
    "ruleContext": "One sentence ≤120 chars"
  },
  "article": {
    "slug": "kebab-case-3-6-words",
    "title": "≤80 chars",
    "excerpt": "1-2 developer-centric sentences ≤200 chars",
    "tags": ["breach", "ai", "owasp-a07"]
  }
}
```

**Customer value:** Zero-day CVEs appear in the guardrail catalog within minutes of news publication.

**Constraints:**

| Rule | Constraint |
| --- | --- |
| NEVER | Invent a CVE ID — only use verbatim from article or generate `AIGENTLY-YYYY-<slug>` |
| NEVER | Mention package names, version numbers, or "upgrade to X" in patternLines |
| NEVER | Write generic advice; every line must reference the specific attack mechanism |
| ALWAYS | Keep `ruleContext` exactly one sentence, ≤120 chars, no markdown |
| ALWAYS | Make `ruleContext` describe developer risk, not the patch |

---

## 4. Task 2 — Threat Amplification (`threat_amplification`)

**Trigger:** `pnpm --filter web amplify:threats` (processes threats with NULL `aiAmplification`)

**Model:** Haiku 4.5 — high-volume loop, 400 tokens per threat, structured output

**Batch size:** 5 threats per LLM call (`AMPLIFY_CHUNK_SIZE=5` env var)

**Input:** Threat name + description (≤600 chars) + OWASP refs + affected packages (per batch)

**Output:** Stored in `threat.aiAmplification` JSON:

```json
{
  "patternLines": ["ALWAYS ...", "NEVER ..."],
  "ruleContext": "The developer risk sentence",
  "generatedAt": "ISO timestamp",
  "model": "claude-haiku-4-5"
}
```

**Tool:** `write_threat_guardrails_batch`

**Fallback:** If the batch call misses any threat ID, falls back to individual single-threat calls.

**Customer value:** Every CVE in the catalog gets developer-readable guardrail atoms,
enriching rule synthesis with threat-specific ALWAYS/NEVER directives.

**Constraints:**

| Rule | Constraint |
| --- | --- |
| NEVER | Mention package names, version numbers, or "upgrade to X" |
| NEVER | Produce a patternLine that would apply to any stack (too generic) |
| ALWAYS | Each patternLine must reference the specific attack mechanism in the threat description |
| ALWAYS | Use ALWAYS or NEVER (uppercase) to start each patternLine |
| ALWAYS | Keep `ruleContext` ≤120 chars, one sentence, no markdown |
| ALWAYS | Return exactly one result per threat ID (batch mode) |

---

## 5. Task 3 — Rule Summarization (`rule_summarization`)

**Trigger:** `pnpm --filter web summarize:rules`

**Model:** Sonnet 4.6 — CVE clustering, structured output

**Input:** All linked threats for one rule (N threats, sorted by severity, each with
ID/name/OWASP/severity/description capped at 400 chars)

**Output:** `rule.summaryMdx` — structured Markdown with clusters + cross-cutting patterns

**Tool:** `write_rule_summary`

**Output shape (rendered Markdown):**

```markdown
## AI Security Summary

<2-sentence executive preamble>

### <Attack-Vector Theme Title>
**Covers:** CVE-2024-1111 · CVE-2024-2222
**Risk:** <1 sentence, plain English ≤150 chars>

- ALWAYS ...
- NEVER ...

---
**Cross-cutting patterns (all Next.js projects)**

- ALWAYS ...
- NEVER ...
```

**Customer value:** `/rules/[slug]` pages show an AI-synthesized summary of what the rule
protects against, grouped by attack-vector theme — not raw CVE lists.

**Constraints:**

| Rule | Constraint |
| --- | --- |
| NEVER | Mention version numbers or upgrade instructions |
| NEVER | Repeat the same ALWAYS/NEVER line across clusters |
| NEVER | Write riskSummary that describes the patch — describe the real-world risk |
| ALWAYS | Group CVEs by HOW the attacker exploits code, not OWASP label alone |
| ALWAYS | Mark cluster riskSummary with "ACTIVELY EXPLOITED" if any CVE is actively exploited |
| ALWAYS | Every CVE in the input must appear in exactly one cluster |

---

## 6. Task 4 — Guardrail Synthesis (`guardrail_summarization`)

**Trigger:** Admin "Fill empty" / "Regenerate all", or `GET /v1/summarize`

**Model:** Sonnet 4.6 (dev/preview), Opus 4.7 when `FEATURE_CERTIFIED_SUMMARIES=true`

**Sub-task chain (no LLM for pre-processing):**

1. **Atom extraction** — regex `^[-*]\s+(DO NOT|NEVER|AVOID|ALWAYS|ENSURE|REQUIRE|WHEN|IF)\b`
   scans rule bodies; infers severity from keywords; extracts CWE refs
2. **Conflict resolution** — groups atoms by normalised content; highest severity wins
3. **Deduplication** — fingerprint = first 60 chars lowercase, alphanumeric only; first occurrence kept
4. **LLM batch call** — one call per stack, all layers batched in one prompt using
   `produce_stack_guardrails` tool; falls back per-layer if model omits any

**Input:** N directive atoms per layer (from rule bodies), per-layer concern statements

**Output:** One `summarized_guardrail` row per (stack, layer):
- `content` — 300–500 word guardrail text starting with `# aigently:` comment block
- `quality_score` — 0–10, auto-computed on every insert
- `conflictCount` — atoms that had competing variants resolved
- `sourceRuleIds` — traceability back to source rules
- `cacheKey` — SHA-256 of sorted rule body hashes (invalidated when rule content changes)

**Score feedback loop:** When re-generating a guardrail with a low score (< 8/10), the
synthesis prompt includes a `QUALITY FEEDBACK` block naming what to fix. The score is stored
in `quality_score`; admins can override it in the evaluation dashboard.

**Constraints:**

| Rule | Constraint |
| --- | --- |
| NEVER | Mention package names, version numbers, or upgrade instructions |
| NEVER | Write generic advice |
| ALWAYS | Name the specific CWE-NNN or CVE each directive addresses |
| ALWAYS | Open with `# aigently: <stack-slug>-<layer-slug>-guardrails v1.0 [summarized]` |
| ALWAYS | End with a DO NOT section listing the highest-severity patterns |
| ALWAYS | Use imperative voice — instructions TO the AI assistant |

---

## 7. The Golden Guardrail Standard

### Anatomy of a golden guardrail

```markdown
# aigently: nextjs-auth_session-guardrails v1.0 [summarized]   ← required header
# Merged from 4 rules
# Protects: CWE-287, CWE-352, CWE-620

## Authentication & Session Management for Next.js

NEVER rely on the Host header in Server Actions to determine redirect origin —
validate against an explicit allowlist (CWE-601).

ALWAYS clear session cookies with SameSite=Strict and secure flags on logout.
Verify both Set-Cookie header and in-memory session state are wiped (CWE-287).

WHEN using NextAuth, ALWAYS configure CSRF token rotation on every state-changing
operation. Do not share tokens across page navigations (CWE-352).

NEVER store session identifiers in localStorage. Use only secure, httpOnly cookies
to prevent XSS-based session theft (CWE-539).

## DO NOT                                                         ← required footer
- DO NOT use cookie values as CSRF tokens; use cryptographically independent tokens.
- DO NOT skip callback validation in OAuth flows; validate state and nonce parameters.
```

### 8 quality signals

| Signal | DB column | Weight | What it means |
| --- | --- | --- | --- |
| Conflict-free | `conflict_count = 0` | High | Source rules agree; no competing directives |
| Source breadth | `array_length(source_rule_ids, 1)` | High | More rules = more comprehensive coverage |
| Content completeness | `char_length(content)` | Medium | Longer (within reason) = more detail |
| Freshness | `generated_at` | Medium | Reflects the latest rule content |
| Rule certified | `rule.certified` on source rules | High | Editorial review completed |
| CWE coverage | CWEs in content | High | Every atom's vulnerability named specifically |
| No version refs | absence of version numbers | High | Code-pattern focused, not dependency-management |
| DO NOT section present | present in content | Medium | Highlights highest-risk patterns |

### Quality anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| "ALWAYS follow security best practices" | Generic — applies to everything, guides nothing |
| "NEVER use lodash < 4.17.21" | Version reference — violates core constraint |
| "ALWAYS validate user input" | Not specific to the attack vector or CWE |
| Content < 200 chars | Too sparse — atom coverage is incomplete |
| > 3 conflicts | Source rules contradict each other on the same directive |
| No DO NOT section | Missing explicit high-risk pattern list |
| No `# aigently:` header | Cannot be identified or audited by IDEs |

### Quality score formula (0–10)

```typescript
const conflictScore    = Math.max(0, 10 - conflictCount * 1.5);  // 0 conflicts = 10
const breadthScore     = Math.min(10, sourceRuleCount * 2);       // 5+ rules = 10
const completenessScore = Math.min(10, contentLength / 200);       // 2000+ chars = 10
const daysSince        = elapsed / 86_400_000;
const freshnessScore   = Math.max(0, 10 - daysSince * 0.3);       // ~33 days = 0

qualityScore = round((conflictScore + breadthScore + completenessScore + freshnessScore) / 4)
```

---

## 8. The Two Score Systems

Two distinct scores exist in the system. They measure different things and must not be confused.

### `rule.strengthScore` (0–100)

- **What:** Quality of a **source rule document** (MDX)
- **Computed by:** `computeStrengthScore()` in `lib/rules-directory-showcase.ts`
- **Formula:** certified flag (20 pts) + DO NOT/NEVER/AVOID keywords (10 pts) + line count (up to 20 pts) + base (10 pts)
- **When:** Recalculated on every save via admin or seed script — never stored as stale
- **Frontend:** Shown as 1–5 stars on `/rules` cards (`stars = score >= 80 ? 5 : score >= 60 ? 4 : ...`)
- **Not fed to LLM** — code-computed only, fidelity concerns don't apply

### `summarized_guardrail.quality_score` (0–10)

- **What:** Quality of a **synthesized guardrail output** (the LLM's work)
- **Computed by:** `computeQualityScore()` in `lib/admin-queries.ts`
- **Formula:** See formula above (conflict, breadth, completeness, freshness, averaged)
- **When:** Stored on every pipeline insert; recalculated on regeneration
- **Admin override:** `score_override` column allows admin to set a manual score (0–10)
- **Fed to LLM:** When `previousScore < 8`, a `QUALITY FEEDBACK` block is appended to the synthesis prompt
- **Frontend:** Shown as a colored badge in `/admin/guardrails/evaluation`

---

## 9. Atom Extraction

**File:** `apps/web/lib/summarizer/atoms.ts`

**Directive regex:** `^[-*]\s+(DO NOT|NEVER|AVOID|ALWAYS|ENSURE|REQUIRE|WHEN|IF)\b.+`

**What is filtered out:**
- Lines starting with `#` (headings) or `<!--` (HTML comments)
- Lines shorter than 20 characters

**Severity inference keywords:**

| Keyword | Severity |
| --- | --- |
| `critical`, `rce`, `sqli`, `privesc` | critical |
| `inject`, `xss`, `csrf`, `auth`, `session`, `secret`, `pii` | high |
| `medium` | medium |
| `low` | low |
| (default) | medium |

**CWE extraction:** All `CWE-\d+` patterns in the line are collected into `cweRefs[]`.

---

## 10. Conflict Resolution

**File:** `apps/web/lib/summarizer/conflicts.ts`

**Detection:** Atoms are grouped by a normalised key — lowercase, alphanumeric only, first 60 chars.

**Resolution:** Within each group, the atom with the highest severity wins. Others are marked
`conflictResolution: "conflict_resolved"` and excluded from the prompt.

**Storage:** `conflictCount` on `summarized_guardrail` = number of atoms that lost conflicts.
Provenance JSON records which source rules contributed conflicting atoms.

---

## 11. Cache Strategy

**File:** `apps/web/lib/summarizer/cache.ts`

**Cache key format:**

```
summarize:{stackSlug}:{layerSlug}:{ruleType}:{sortedRuleBodyHashes}
```

**Invalidation:** Content-addressed — the key changes only when rule bodies change.
Adding a new rule to a stack invalidates the cache for every (stack, layer) pair it affects.

**`expiresAt`:** Optional hard expiry timestamp. When present and past, the row is treated
as stale by the bulk generator "Refresh stale" mode. When absent, only content changes
invalidate the cache.

---

## 12. Admin Operations Reference

| Action | Location | LLM call? | DB effect |
| --- | --- | --- | --- |
| Fill empty | Admin → Guardrails | Yes (per stack batch) | Inserts `summarized_guardrail` rows for uncovered pairs |
| Refresh stale | Admin → Guardrails | Yes (per stack batch) | Re-inserts expired or missing rows |
| Regenerate all | Admin → Guardrails | Yes (per stack batch) | Deletes + re-inserts all rows |
| Generate (single) | Admin → Guardrails form | Yes (per pair) | Inserts/updates one `summarized_guardrail` row |
| Regenerate (row action) | Admin → Guardrails table | Yes (per pair) | Deletes + re-inserts one row |
| Re-score & Regen | Admin → Evaluation page | Yes (per pair) | Updates `score_override`, deletes + re-inserts one row |
| Score only (PATCH) | `/api/admin/guardrails/:id/score` | No | Updates `score_override` + `score_note` only |
| Export snapshot | Admin → Sync → Export | No | Streams JSON of all threats/rules/guardrails |
| Import snapshot | Admin → Sync → Import | No | Upserts all rows from JSON |
| Amplify threats | CLI `amplify:threats` | Yes (per 5 threats) | Updates `threat.aiAmplification` |
| Ingest URL | CLI `ingest:url URL=...` | Yes (once) | Inserts `threat` + `article` rows |
| Summarize rules | CLI `summarize:rules` | Yes (per rule) | Updates `rule.summaryMdx` |

---

## 13. LLM Config

All model selections are admin-configurable via `/admin/llm` — stored in `llm_task_config`.

**Default task → model mapping:**

| Task | Default model | Reason |
| --- | --- | --- |
| `guardrail_summarization` | Sonnet 4.6 | Quality output, moderate cost; Opus 4.7 via `FEATURE_CERTIFIED_SUMMARIES=true` |
| `threat_amplification` | Haiku 4.5 | High-volume loop, tiny structured output (400 tokens/threat) |
| `rule_summarization` | Sonnet 4.6 | CVE clustering needs solid reasoning |
| `content_ingest` | Sonnet 4.6 | Article comprehension from noisy HTML |

Override any task model without redeploy from the admin LLM Config page.
