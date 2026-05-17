import {
  getStacks, getThreats, getRules, getManifest,
  parseAmplification,
  type CatalogThreat, type CatalogRule,
} from "./catalog.js";
import { detectContext } from "./detect.js";

// ── Shared helpers ─────────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

function sevScore(s: string | null): number {
  return SEV_ORDER[s ?? "info"] ?? 5;
}

function scoreThreat(t: CatalogThreat, ruleIds: Set<string>, intentLower: string): number {
  let score = 0;
  if (ruleIds.has(t.publicId))    score += 3;
  if (t.isActivelyExploited)      score += 2;
  if (sevScore(t.severity) <= 1)  score += 2; // critical or high
  const owasp = (t.owaspRefs ?? []).join(" ").toLowerCase();
  if (intentLower.includes("auth") && (owasp.includes("a02") || owasp.includes("a07"))) score += 1;
  if (intentLower.includes("inject") && owasp.includes("a03")) score += 1;
  if (intentLower.includes("xss") && owasp.includes("a03"))    score += 1;
  if (intentLower.includes("csrf") && owasp.includes("a01"))   score += 1;
  return score;
}

function formatThreat(t: CatalogThreat) {
  const amp = parseAmplification(t.aiAmplification);
  return {
    publicId:            t.publicId,
    cveId:               t.cveId,
    name:                t.name,
    severity:            t.severity,
    isActivelyExploited: t.isActivelyExploited,
    ruleContext:         amp?.ruleContext ?? null,
    patternLines:        amp?.patternLines ?? [],
  };
}

// ── Tool: get_security_context ─────────────────────────────────────────────────

interface GetSecurityContextInput {
  intent: string;
  file_path?: string;
  stacks?: string[];
}

export function handleGetSecurityContext(input: GetSecurityContextInput) {
  const { intent, file_path, stacks: explicitStacks } = input;
  const { stacks: detectedStacks, ruleType } = detectContext(intent, file_path, explicitStacks);
  const intentLower = intent.toLowerCase();

  const allRules   = getRules();
  const allThreats = getThreats();

  // Find matching rules
  const matchedRules: CatalogRule[] = [];
  for (const r of allRules) {
    const ruleStack = r.stacks.find(s => detectedStacks.includes(s));
    if (!ruleStack) continue;
    const isPatterns = r.slug.endsWith("-security-patterns-v1");
    const isDeps     = r.slug.endsWith("-security-deps-v1");
    if (ruleType === "patterns" && isPatterns) matchedRules.push(r);
    else if (ruleType === "deps" && isDeps)    matchedRules.push(r);
    else if (ruleType === "both")              matchedRules.push(r);
  }

  // Score and rank threats linked to matched rules
  const linkedThreatIds = new Set(matchedRules.flatMap(r => r.threatIds));
  const stackThreats = allThreats.filter(t =>
    t.stacks.some(s => detectedStacks.includes(s))
  );

  const scored = stackThreats
    .map(t => ({ t, score: scoreThreat(t, linkedThreatIds, intentLower) }))
    .sort((a, b) => b.score - a.score || sevScore(a.t.severity) - sevScore(b.t.severity));

  const topThreats = scored.slice(0, 5).map(({ t }) => formatThreat(t));

  const exploitedCount = topThreats.filter(t => t.isActivelyExploited).length;
  const stackLabel = detectedStacks.join(", ") || "unknown stack";
  const injection_hint = detectedStacks.length
    ? `Injecting ${stackLabel} security ${ruleType} rule` +
      (exploitedCount > 0 ? ` (${exploitedCount} actively exploited CVE${exploitedCount > 1 ? "s" : ""})` : "")
    : "No matching stack detected — returning general threat data";

  return {
    detected_stacks: detectedStacks,
    rules: matchedRules.map(r => ({
      slug:       r.slug,
      name:       r.name,
      type:       r.slug.endsWith("-security-patterns-v1") ? "patterns"
                : r.slug.endsWith("-security-deps-v1")     ? "deps"
                : "unknown",
      bodyMdx:    r.bodyMdx,
      summaryMdx: r.summaryMdx,
    })),
    top_threats:     topThreats,
    injection_hint,
  };
}

// ── Tool: list_stacks ──────────────────────────────────────────────────────────

export function handleListStacks() {
  return getStacks().map(s => ({
    slug:          s.slug,
    name:          s.name,
    catalogStatus: s.catalogStatus,
    ecosystem:     s.ecosystem,
    securityGrade: s.securityGrade,
  }));
}

// ── Tool: get_rule ─────────────────────────────────────────────────────────────

interface GetRuleInput { slug: string }

export function handleGetRule(input: GetRuleInput) {
  const r = getRules().find(r => r.slug === input.slug);
  if (!r) return { error: `Rule not found: ${input.slug}` };
  return {
    slug:          r.slug,
    name:          r.name,
    description:   r.description,
    version:       r.version,
    bodyMdx:       r.bodyMdx,
    summaryMdx:    r.summaryMdx,
    stacks:        r.stacks,
    linkedThreats: r.threatIds.length,
  };
}

// ── Tool: search_threats ───────────────────────────────────────────────────────

interface SearchThreatsInput {
  query?:      string;
  severity?:   string;
  owasp_ref?:  string;
  stack_slug?: string;
  limit?:      number;
}

export function handleSearchThreats(input: SearchThreatsInput) {
  const { query, severity, owasp_ref, stack_slug, limit = 20 } = input;
  const q = query?.toLowerCase();

  const results = getThreats().filter(t => {
    if (severity   && t.severity !== severity)                       return false;
    if (owasp_ref  && !t.owaspRefs.some(r => r.toUpperCase().includes(owasp_ref.toUpperCase()))) return false;
    if (stack_slug && !t.stacks.includes(stack_slug))                return false;
    if (q && !t.name.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
    return true;
  });

  return results
    .sort((a, b) => sevScore(a.severity) - sevScore(b.severity))
    .slice(0, limit)
    .map(t => ({
      publicId:            t.publicId,
      cveId:               t.cveId,
      name:                t.name,
      severity:            t.severity,
      isActivelyExploited: t.isActivelyExploited,
      owaspRefs:           t.owaspRefs,
      stacks:              t.stacks,
    }));
}

// ── Tool: get_threat ───────────────────────────────────────────────────────────

interface GetThreatInput { id: string }

export function handleGetThreat(input: GetThreatInput) {
  const { id } = input;
  const t = getThreats().find(t => t.publicId === id || t.cveId === id);
  if (!t) return { error: `Threat not found: ${id}` };

  const amp = parseAmplification(t.aiAmplification);
  return {
    publicId:            t.publicId,
    cveId:               t.cveId,
    source:              t.source,
    sourceUrl:           t.sourceUrl,
    family:              t.family,
    name:                t.name,
    description:         t.description,
    severity:            t.severity,
    owaspRefs:           t.owaspRefs,
    isActivelyExploited: t.isActivelyExploited,
    affectedProducts:    t.affectedProducts,
    stacks:              t.stacks,
    aiAmplification:     amp,
    publishedAt:         t.publishedAt,
  };
}

// ── Tool: get_manifest ─────────────────────────────────────────────────────────

export function handleGetManifest() {
  return getManifest();
}
