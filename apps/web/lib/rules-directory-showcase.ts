import type { components } from "@aigently/api-client";

export type Rule = components["schemas"]["Rule"];
export type RuleLayer = components["schemas"]["RuleLayer"];

/** Rich card row for directory grid (Stitch reference). */
export type RuleDirectoryCard = Rule & {
  stacks: string[];
  tags: string[];
  usesLabel: string;
  stars: number;
  /** When false, "View" links to `/rules` — slug has no API detail yet. */
  hasDetailPage: boolean;
  /** From `rule_layer_map` when loaded from DB; drives Rule type filter. */
  layers?: RuleLayer[];
  /** Threat names + OWASP refs joined from `rule_threat_map`; improves Protects-against filters. */
  threatSignals?: string;
};

/** Marketing headline when the live catalog is still small (PRD / Stitch). */
export const DIRECTORY_CATALOG_HEADLINE_TOTAL = 186;

export const SHOWCASE_RULE_CARDS: RuleDirectoryCard[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "strict-server-actions",
    name: "Strict Server Actions Sanitization",
    description:
      "Enforce parameterized queries and validated inputs for every Server Action touching persistence layers.",
    version: "1.2.0",
    certified: true,
    lineCount: 42,
    weeklyUses: 1200,
    stacks: ["Next.js"],
    tags: ["A03:2021", "CSRF", "SQLI"],
    usesLabel: "1.2k",
    stars: 5,
    hasDetailPage: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    slug: "pydantic-strict-mode",
    name: "Pydantic Model Strict Mode",
    description: "Reject unknown fields and coerce unsafe payloads before they reach service layers.",
    version: "1.0.4",
    certified: true,
    lineCount: 36,
    weeklyUses: 890,
    stacks: ["Python / FastAPI"],
    tags: ["Validation", "A03:2021"],
    usesLabel: "890",
    stars: 5,
    hasDetailPage: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    slug: "orm-safe-filtering",
    name: "ORM Safe Filtering Guard",
    description: "Block dynamic column names and unsafe order clauses in ORM query builders.",
    version: "0.9.1",
    certified: true,
    lineCount: 54,
    weeklyUses: 2400,
    stacks: ["Django", "Ruby on Rails"],
    tags: ["A03:2021", "Injection"],
    usesLabel: "2.4k",
    stars: 4,
    hasDetailPage: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    slug: "memory-safe-slices",
    name: "Memory-Safe Slice Handling",
    description: "Guard against out-of-range slicing and unchecked buffer patterns in hot paths.",
    version: "1.1.0",
    certified: false,
    lineCount: 31,
    weeklyUses: 412,
    stacks: ["Go / Gin"],
    tags: ["Memory", "A08:2021"],
    usesLabel: "412",
    stars: 4,
    hasDetailPage: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    slug: "mass-assignment-rails",
    name: "Mass Assignment Protection",
    description: "Strong parameters and explicit permit lists for every mutating controller action.",
    version: "2.0.0",
    certified: true,
    lineCount: 48,
    weeklyUses: 3100,
    stacks: ["Ruby on Rails"],
    tags: ["A01:2021", "Auth"],
    usesLabel: "3.1k",
    stars: 5,
    hasDetailPage: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    slug: "helmet-config-optimizer",
    name: "Helmet.js Config Optimizer",
    description: "Baseline secure headers for Express services with CSP and HSTS tuned for SSR.",
    version: "1.4.2",
    certified: true,
    lineCount: 67,
    weeklyUses: 1000,
    stacks: ["Node.js / Express"],
    tags: ["Headers", "A05:2021"],
    usesLabel: "1.0k",
    stars: 4,
    hasDetailPage: false,
  },
];

function hashSlice(id: string): number {
  const hex = id.replace(/-/g, "").slice(0, 8);
  return parseInt(hex || "0", 16) || 0;
}

function formatUsesLabel(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function enrichApiRule(
  rule: Rule,
  stackLabels: string[],
  meta?: { layers?: RuleLayer[]; threatSignals?: string; strengthScore?: number }
): RuleDirectoryCard {
  const h = hashSlice(rule.id);
  const score = meta?.strengthScore ?? 0;
  // Derive 1–5 stars from 0–100 strengthScore; fall back to hash-based 3–5 if score is 0
  const stars = score > 0
    ? (score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1)
    : 3 + (h % 3);
  const usesK = 0.4 + (h % 50) / 10;
  const usesLabel =
    rule.weeklyUses > 0 ? formatUsesLabel(rule.weeklyUses) : usesK >= 1 ? `${usesK.toFixed(1)}k` : `${200 + (h % 800)}`;
  const hay = `${rule.name} ${rule.description} ${rule.slug}`.toLowerCase();
  const tags: string[] = [];
  if (/-security-patterns-v\d+$/i.test(rule.slug)) tags.push("Patterns");
  if (/-security-deps-v\d+$/i.test(rule.slug)) tags.push("Deps");
  if (/sql|inject|execute|query|orm/i.test(hay)) tags.push("A03:2021");
  if (/csrf|token|cookie/i.test(hay)) tags.push("CSRF");
  if (/env|secret|credential|leak/i.test(hay)) tags.push("Sensitive data");
  if (/server|rsc|ssr|next/i.test(hay)) tags.push("Next.js");
  if (tags.length === 0) tags.push("Guardrail");
  const stacks =
    stackLabels.length > 0 ? stackLabels : inferStacksFromHaystack(hay);
  return {
    ...rule,
    stacks,
    tags: tags.slice(0, 4),
    usesLabel,
    stars,
    hasDetailPage: true,
    layers: meta?.layers,
    threatSignals: meta?.threatSignals,
  };
}

export function computeStrengthScore(rule: {
  certified: boolean;
  bodyMdx?: string | null;
  lineCount?: number | null;
}): number {
  const doNot = /DO NOT|NEVER|AVOID/i.test(rule.bodyMdx ?? "") ? 10 : 0;
  const cert = rule.certified ? 20 : 0;
  const lineScore = Math.min(Math.floor((rule.lineCount ?? 0) / 5), 20);
  return Math.min(doNot + cert + lineScore + 10, 100);
}

function inferStacksFromHaystack(hay: string): string[] {
  if (/pydantic|fastapi|python/i.test(hay)) return ["Python / FastAPI"];
  if (/rails|ruby/i.test(hay)) return ["Ruby on Rails"];
  if (/express|node|helmet/i.test(hay)) return ["Node.js / Express"];
  if (/next|ssr|rsc|server action/i.test(hay)) return ["Next.js"];
  if (/go|gin|slice/i.test(hay)) return ["Go / Gin"];
  return ["Multi-stack"];
}
