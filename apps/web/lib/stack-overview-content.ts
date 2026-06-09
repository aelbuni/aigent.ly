/**
 * Stack overview UI copy — mirrors Stitch / PRD PAGE 5 structure until API exposes risks & coverage.
 * @see prd.md "Stack Selector" (top 10 stacks) and "PAGE 5: STACK SECURITY OVERVIEW"
 */

import type { components } from "@aigently/api-client";

export type RiskSeverity = "CRITICAL" | "HIGH" | "MEDIUM";

export type RiskRow = {
  title: string;
  severity: RiskSeverity;
  description: string;
  /** Tailwind left border color token */
  borderAccent: "border-l-error" | "border-l-tertiary-container";
  /** Optional direct threat link — links to `/threats?q=...` if set */
  threatHref?: string;
  /** CVE publish date for display — month + year only */
  publishedAt?: Date | null;
};

export type CoverageRow = { label: string; pct: number; barClass: string };

export type FrameworkRow = {
  feature: string;
  status: "BUILT-IN" | "MANUAL CFG" | "NOT SUPPORTED";
  builtIn: boolean;
};

export type StackOverviewContent = {
  scoreLabel: string;
  intro: string;
  criticalCount: number;
  highCount: number;
  risks: RiskRow[];
  coverage: CoverageRow[];
  framework: FrameworkRow[];
};

const DEFAULT: StackOverviewContent = {
  scoreLabel: "B",
  intro:
    "Review linked rules in the directory and use Composer to export guardrails for your IDE. Detailed posture metrics will appear here as the catalog grows.",
  criticalCount: 0,
  highCount: 2,
  risks: [
    {
      title: "Misconfigured environment exposure",
      severity: "HIGH",
      description: "Agent output and shared modules may leak secrets without explicit boundaries.",
      borderAccent: "border-l-tertiary-container",
    },
    {
      title: "Unreviewed agent-generated diffs",
      severity: "HIGH",
      description: "High-velocity changes can skip security review without guardrail prompts.",
      borderAccent: "border-l-tertiary-container",
    },
  ],
  coverage: [
    { label: "Rule coverage", pct: 45, barClass: "bg-primary" },
    { label: "Threat mapping", pct: 30, barClass: "bg-secondary" },
    { label: "Layer depth", pct: 55, barClass: "bg-tertiary-container" },
  ],
  framework: [
    { feature: "Baseline hardening", status: "MANUAL CFG", builtIn: false },
    { feature: "Dependency hygiene", status: "MANUAL CFG", builtIn: false },
    { feature: "Safe defaults", status: "BUILT-IN", builtIn: true },
  ],
};

const NEXTJS: StackOverviewContent = {
  scoreLabel: "B+",
  intro:
    "While Next.js provides robust defaults like automatic XSS protection and built-in CSRF measures for certain hooks, complex Server Action implementations and custom API routes often introduce critical security gaps in production environments.",
  criticalCount: 2,
  highCount: 5,
  risks: [
    {
      title: "SQL Injection in Server Actions",
      severity: "CRITICAL",
      description:
        "Direct string interpolation in `db.execute` calls within Server Actions bypasses ORM sanitization.",
      borderAccent: "border-l-error",
    },
    {
      title: "Hardcoded JWT Secret in `next.config.js`",
      severity: "CRITICAL",
      description: "Sensitive keys detected in configuration files, exposed during build-time environment bundling.",
      borderAccent: "border-l-error",
    },
    {
      title: "No CSRF Protection on API Routes",
      severity: "HIGH",
      description: "Custom `/api` endpoints lacking state-dependent tokens are vulnerable to cross-site request forgery.",
      borderAccent: "border-l-tertiary-container",
    },
    {
      title: "Unauthenticated `getStaticProps` Fetch",
      severity: "HIGH",
      description: "SSG fetches occurring without proper IAM validation from backend microservices.",
      borderAccent: "border-l-tertiary-container",
    },
  ],
  coverage: [
    { label: "Client hydration", pct: 92, barClass: "bg-primary" },
    { label: "Edge middleware", pct: 64, barClass: "bg-secondary" },
    { label: "Server Actions", pct: 28, barClass: "bg-tertiary-container" },
  ],
  framework: [
    { feature: "XSS Prevention", status: "BUILT-IN", builtIn: true },
    { feature: "Route Protection", status: "MANUAL CFG", builtIn: false },
    { feature: "CORS Policy", status: "MANUAL CFG", builtIn: false },
    { feature: "Header Security", status: "BUILT-IN", builtIn: true },
    { feature: "Environment Isolation", status: "BUILT-IN", builtIn: true },
  ],
};

export function getStackOverviewContent(stackSlug: string): StackOverviewContent {
  if (stackSlug === "nextjs") return NEXTJS;
  return DEFAULT;
}

type ApiThreatEntry = components["schemas"]["StackOverviewResponse"]["threatMatrix"][number] & {
  publishedAt?: Date | null;
};
type ApiStackOverview = Omit<components["schemas"]["StackOverviewResponse"], "threatMatrix"> & {
  threatMatrix: ApiThreatEntry[];
};

function mapApiSeverity(s: string): RiskSeverity {
  const u = s.toLowerCase();
  if (u === "critical") return "CRITICAL";
  if (u === "high") return "HIGH";
  return "MEDIUM";
}

/** Prefer DB/API overview rows when present; keep static narrative as fallback. */
export function mergeStackOverviewFromApi(
  stackSlug: string,
  api: ApiStackOverview | null
): StackOverviewContent {
  const base = getStackOverviewContent(stackSlug);
  if (!api) return base;

  const hasDb =
    api.coverageAreas.length > 0 ||
    api.frameworkFeatures.length > 0 ||
    api.threatMatrix.length > 0;

  if (!hasDb) {
    return {
      ...base,
      scoreLabel: api.securityGrade?.trim() || base.scoreLabel,
      intro: api.gradeRationale?.trim() || base.intro,
    };
  }

  const coverage =
    api.coverageAreas.length > 0
      ? api.coverageAreas.map((c, i) => ({
          label: c.areaName,
          pct: Math.min(100, Math.max(0, c.coveragePercent ?? 0)),
          barClass: ["bg-primary", "bg-secondary", "bg-tertiary-container"][i % 3]!,
        }))
      : [];

  const framework: FrameworkRow[] =
    api.frameworkFeatures.length > 0
      ? api.frameworkFeatures.map((f) => {
          const status: FrameworkRow["status"] =
            f.status === "built_in"
              ? "BUILT-IN"
              : f.status === "not_supported"
                ? "NOT SUPPORTED"
                : "MANUAL CFG";
          return {
            feature: f.featureName,
            status,
            builtIn: f.status === "built_in",
          };
        })
      : base.framework;

  const risksFromMatrix: RiskRow[] =
    api.threatMatrix.length > 0
      ? api.threatMatrix.slice(0, 8).map((t) => ({
          title: t.name,
          severity: mapApiSeverity(t.severity),
          description: t.isMitigatedByRules
            ? "Rule coverage exists — verify in Composer export."
            : "No rule coverage yet — consider contributing a rule.",
          borderAccent:
            t.severity === "critical" ? "border-l-error" : "border-l-tertiary-container",
          publishedAt: t.publishedAt ?? null,
        }))
      : base.risks;

  const criticalCount = risksFromMatrix.filter((r) => r.severity === "CRITICAL").length;
  const highCount = risksFromMatrix.filter((r) => r.severity === "HIGH").length;

  return {
    ...base,
    scoreLabel: api.securityGrade?.trim() || base.scoreLabel,
    intro: api.gradeRationale?.trim() || base.intro,
    criticalCount,
    highCount,
    risks: risksFromMatrix,
    coverage,
    framework,
  };
}

export function severityChipClass(sev: RiskSeverity): string {
  if (sev === "CRITICAL") return "bg-error-container text-on-error-container";
  if (sev === "HIGH") return "bg-tertiary text-on-tertiary";
  if (sev === "MEDIUM") return "bg-primary-fixed-dim/30 text-on-surface";
  return "bg-surface-container-highest text-on-surface-variant";
}
