/** Homepage marketing copy — single source for edits. */

export const HERO = {
  badge: "Free & Open Source",
  headline: "Your AI coding tool writes fast. It also writes vulnerabilities.",
  subcopy:
    "Aigent.ly is a free, open-source MCP server that injects live CVE-backed guardrails into Claude Code, Cline, Cursor, GitHub Copilot, and Windsurf — so your AI enforces this week's security rules, not last year's training data.",
  primaryCta: { label: "Try the Composer", href: "/composer" as const },
  secondaryCta: { label: "Browse the threat feed", href: "/threats" as const },
} as const;

export const TESTIMONIAL = {
  quote:
    "I didn't know I was shipping risky Server Action patterns until I applied the Next.js security baseline. Aigent.ly surfaced four concrete fixes in the first session.",
  attribution: "Early access engineer",
} as const;

export const MARQUEE_ITEMS = [
  { tone: "text-error",             label: "LIVE:",  text: "CVE FEED UPDATED DAILY FROM NVD · GHSA · CISA KEV · OSV · EPSS",  href: "/threats" },
  { tone: "text-error",             label: "ALERT:", text: "PROMPT INJECTION & TOOL ABUSE IN AI AGENTS",                        href: "/threats" },
  { tone: "text-primary-fixed-dim", label: "FREE:",  text: "OPEN-SOURCE MCP SERVER — WORKS IN CURSOR · CLAUDE CODE · WINDSURF", href: "/composer" },
  { tone: "text-primary-fixed-dim", label: "LIVE:",  text: "100+ CVE-LINKED THREATS TRACKED ACROSS 12 STACKS",                 href: "/threats" },
] as const;

export const THREE_USPS = [
  {
    icon: "hub" as const,
    title: "Free MCP server",
    body: "One config line in your IDE. The MCP server auto-detects your stack and injects the right CVE rules into every generation — zero ongoing setup.",
    href: "/composer" as const,
  },
  {
    icon: "bolt" as const,
    title: "Live CVE threat feed",
    body: "LLM training is frozen in time. Aigent.ly pulls daily from NVD, GHSA, CISA KEV, OSV, npm Audit, and EPSS — so your guardrails reflect what's actively exploited right now.",
    href: "/threats" as const,
  },
  {
    icon: "group" as const,
    title: "Community-powered catalog",
    body: "Open-source data, open-source pipeline. Contributors add stacks, sharpen CVE patterns, and propose new guardrail rules — the catalog grows with the community.",
    href: "https://github.com/aelbuni/aigently-catalog" as const,
  },
] as const;

export const USER_STORIES = [
  {
    tag: "The solo founder",
    title: "Building fast, sleeping worried.",
    body: "Shipping a SaaS with an AI IDE. No dedicated security hire. Needs production-grade defaults without becoming a part-time AppSec team.",
  },
  {
    tag: "The junior dev",
    title: "The model looks right.",
    body: "Ships features quickly with agent assistance. Wants guardrails that catch the subtle foot-guns that static vibes miss.",
  },
  {
    tag: "The senior engineer",
    title: "Standardizing AI-assisted PRs.",
    body: "Onboarding a team onto an AI IDE. Needs one ruleset baseline so AI-generated diffs meet the same bar as hand-written code.",
  },
  {
    tag: "The technical PM",
    title: "Audit season after AI acceleration.",
    body: "Product shipped fast with agent help. Now facing pen test or SOC 2. Needs to map exposure and close gaps with evidence, not vibes.",
  },
] as const;

export const JTBD_STEPS = [
  {
    title: "Add the MCP server to your IDE",
    body: "One npx line in your IDE's MCP config. Claude Code, Cline, Cursor, GitHub Copilot, and Windsurf all supported. No API key required.",
    href: "/composer" as const,
  },
  {
    title: "Try the Rule Composer",
    body: "Pick your stack and IDE — the Composer generates a ready-to-paste guardrail file in under a minute. Copy it into your project.",
    href: "/composer" as const,
  },
  {
    title: "Browse the threat feed",
    body: "100+ CVEs tracked across 12 launch stacks, updated daily from NVD, GHSA, CISA KEV, OSV, npm Audit, and EPSS. Each CVE links to its advisory.",
    href: "/threats" as const,
  },
  {
    title: "Contribute a stack",
    body: "Open-source pipeline. Add a stack to the registry, submit CVE pattern improvements, or propose new rules — the catalog is community-driven.",
    href: "https://github.com/aelbuni/aigently-catalog" as const,
  },
] as const;

export const STAT_TILES = [
  {
    value: "—",
    label: "Verified threats tracked",
    footnote: "CVE-linked rows across 12 launch stacks, updated daily.",
  },
  {
    value: "12",
    label: "Launch stacks covered",
    footnote: "Next.js, Express, FastAPI, NestJS, Nuxt, React SPA, Django, Rails, Go, iOS, Android, and AI/LLM Apps.",
  },
  {
    value: "6",
    label: "Threat intelligence sources",
    footnote: "NVD, GHSA, CISA KEV, OSV, npm Audit, and EPSS — all public, no login required.",
  },
  {
    value: "$0",
    label: "Free & Apache-2.0",
    footnote: "MCP server, catalog data, and pipeline are fully open source.",
  },
] as const;

export const MCP_SECTION = {
  badge: "Free MCP Server",
  headline: "Inject live security rules into any AI IDE.",
  subcopy:
    "One config line. No API key. No database. The MCP server reads the open-source catalog — updated daily from six public CVE sources — and delivers the right guardrails automatically as you code.",
  snippet: `{
  "mcpServers": {
    "aigently": {
      "command": "npx",
      "args": ["-y", "@aigently/mcp-server"],
      "env": { "AIGENTLY_TARGET_IDE": "cursor" }
    }
  }
}`,
  ides: ["Claude Code", "Cline", "Cursor", "GitHub Copilot", "Windsurf"],
  cta: { label: "Get your guardrail file", href: "/composer" as const },
  githubHref: "https://github.com/aelbuni/aigently-catalog" as const,
  features: [
    { icon: "speed" as const,   text: "Zero-latency — reads local JSON, no network call at runtime" },
    { icon: "update" as const,  text: "Daily CVE updates committed automatically by the pipeline" },
    { icon: "group" as const,   text: "Community-grown — open stack registry, open rule pipeline" },
    { icon: "lock" as const,    text: "No telemetry, no API key, no account required" },
  ],
} as const;
