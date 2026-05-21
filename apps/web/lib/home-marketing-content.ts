/** Homepage marketing copy — single source for edits (see data-integration plan parallel track). */

export const HERO = {
  badge: "Open source",
  headline: "Your AI coding tool writes fast. It also writes vulnerabilities.",
  subcopy:
    "Aigent.ly ships stack-matched guardrails and a verified CVE-backed threat feed — so your team reacts to what changed this week, not last year’s training data.",
  primaryCta: { label: "Pick your stack", href: "/stacks" as const },
  secondaryCta: { label: "Browse rules", href: "/rules" as const },
} as const;

export const TESTIMONIAL = {
  quote:
    "I didn’t know I was shipping risky Server Action patterns until I applied the Next.js security baseline. Aigent.ly surfaced four concrete fixes in the first session.",
  attribution: "Early access engineer",
} as const;

export const MARQUEE_ITEMS = [
  { tone: "text-error", label: "CRITICAL:", text: "AI-GENERATED CODE NEEDS REVIEW" },
  { tone: "text-primary-fixed-dim", label: "NEW:", text: "CURATED THREAT FEED + STACK MATRIX" },
  { tone: "text-error", label: "ALERT:", text: "PROMPT INJECTION & TOOL ABUSE IN AGENTS" },
  { tone: "text-primary-fixed-dim", label: "DATA:", text: "MANY REPOS SHIP WITHOUT AGENT GUARDRAILS" },
] as const;

export const THREE_USPS = [
  {
    icon: "bolt" as const,
    title: "Live CVE awareness",
    body: "LLM training is frozen in time. Pair rules with the Threats feed so your team reacts to what changed this week — not last year.",
    href: "/threats" as const,
  },
  {
    icon: "export_notes" as const,
    title: "Cross-IDE export",
    body: "One ruleset, formatted for Cursor, Claude Code, Windsurf, Copilot instructions, and more — so security policy travels with the repo (post-MVP composer).",
    href: "/rules" as const,
  },
  {
    icon: "verified" as const,
    title: "Curated directory",
    body: "Rules are written for real stacks and reviewed for clarity. Prefer certified entries when you need audit-friendly defaults.",
    href: "/rules" as const,
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
    title: "The model “looks right.”",
    body: "Ships features quickly with agent assistance. Wants guardrails that catch the subtle foot-guns that static vibes miss.",
  },
  {
    tag: "The senior engineer",
    title: "Standardizing AI-assisted PRs.",
    body: "Onboarding a team onto Cursor or Copilot. Needs one ruleset baseline so AI-generated diffs meet the same bar as hand-written code.",
  },
  {
    tag: "The technical PM",
    title: "Audit season after AI acceleration.",
    body: "Product shipped fast with agent help. Now facing pen test or SOC 2. Needs to map exposure and close gaps with evidence, not vibes.",
  },
] as const;

export const JTBD_STEPS = [
  {
    title: "Pick your stack",
    body: "Start from stacks we ship today — Next.js, Express, FastAPI, NestJS, Nuxt, and React SPA — each backed by verified CVE rows.",
    href: "/stacks" as const,
  },
  {
    title: "Pick your IDE / agent",
    body: "Rules in the directory are mapped for Cursor, Claude Code, Windsurf, Copilot, and Cline (export UX post-MVP).",
    href: "/rules" as const,
  },
  {
    title: "Install the guardrails",
    body: "Copy the certified rule body into your agent’s config path for your stack — keep it in version control like any policy doc.",
    href: "/rules" as const,
  },
  {
    title: "Visit Threats weekly",
    body: "Scan what changed for your ecosystem and refresh rules when high-signal issues land.",
    href: "/threats" as const,
  },
] as const;

export const STAT_TILES = [
  {
    value: "—",
    label: "Verified threats (launch stacks)",
    footnote: "Replaced at runtime from the catalog database after seed.",
  },
  {
    value: "11",
    label: "Stacks in catalog",
    footnote: "Next.js, Express, FastAPI, NestJS, Nuxt, React SPA, Django, Rails, Go, iOS, Android.",
  },
  {
    value: "12",
    label: "Certified rules",
    footnote: "Each rule maps to real CVE rows via rule_threat_map.",
  },
  {
    value: "$0",
    label: "Apache-2.0 licensed",
    footnote: "See the LICENSE file in this repository.",
  },
] as const;
