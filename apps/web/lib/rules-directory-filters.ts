import type { RuleDirectoryCard } from "@/lib/rules-directory-showcase";

export type RuleTypeFilter = "security" | "performance" | "type_safety";
export type ProtectFilter = "a03" | "llm01" | "leak";

/** When `rule_layer_map` has no row, approximate security rules without matching the word "security" in every card. */
const SECURITY_TEXT_FALLBACK =
  /secret|sql|csrf|inject|auth|credential|xss|sanit|owasp|leak|boundary|helmet|cve|ghsa|vulnerab|exploit|encrypt|session|token|hardness|guardrail|mitigat|malicious|payload|rbac|ssrf|idor|xsrf|tls|decrypt|ransom|malware|sqli|injection|cross-site/i;

export function parseCommaList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function filterDirectoryCards(
  cards: RuleDirectoryCard[],
  opts: {
    q: string;
    types: string[];
    classification: "all" | "patterns" | "deps";
    protect: string[];
    layers?: string[];
  }
): RuleDirectoryCard[] {
  const q = opts.q.trim().toLowerCase();
  const types = opts.types as RuleTypeFilter[];
  const protect = opts.protect as ProtectFilter[];
  const classification = opts.classification;
  const layerFilter = opts.layers ?? [];

  return cards.filter((card) => {
    const cardLayerSlugs: string[] = (card.layers ?? []).map((l) =>
      typeof l === "string" ? l : (l as { slug: string }).slug
    );
    const threat = (card.threatSignals ?? "").toLowerCase();
    const hay = `${card.name} ${card.description} ${card.slug} ${card.tags.join(" ")} ${card.stacks.join(" ")} ${threat}`.toLowerCase();
    if (q && !hay.includes(q)) return false;

    if (classification !== "all") {
      const isPatterns = /-security-patterns-v\d+$/i.test(card.slug);
      const isDeps = /-security-deps-v\d+$/i.test(card.slug);
      if (classification === "patterns" && !isPatterns) return false;
      if (classification === "deps" && !isDeps) return false;
    }

    if (layerFilter.length > 0) {
      const matches = layerFilter.some((slug) => cardLayerSlugs.includes(slug));
      if (!matches) return false;
    }

    if (types.length > 0) {
      const matchesType = types.some((t) => {
        if (t === "security") {
          if (cardLayerSlugs.some((s) => ["auth_session","authz_access","input_validation","secrets_credentials","security"].includes(s))) return true;
          return SECURITY_TEXT_FALLBACK.test(hay);
        }
        if (t === "performance") {
          return /perf|budget|cache|speed|latency|hydration/i.test(hay);
        }
        if (t === "type_safety") {
          if (cardLayerSlugs.some((s) => ["code_quality"].includes(s))) return true;
          return /typescript|strict|type|pydantic|model|schema|generic|interface|enum|orm/i.test(hay);
        }
        return true;
      });
      if (!matchesType) return false;
    }

    if (protect.length > 0) {
      const matchesProtect = protect.some((p) => {
        if (p === "a03") {
          return /\ba03\b|injection|sqli|sql injection|nosql injection|command injection|ldap injection|sanitiz|parameterized query|escape\s+query/i.test(
            hay
          );
        }
        if (p === "llm01")
          return /\bllm01\b|llm-01|\batlas\b|prompt injection|indirect prompt|jailbreak|llm\s+\d/i.test(hay);
        if (p === "leak") {
          return /\ba02\b|\ba07\b|sensitive data|information disclosure|credential stuffing|hardcoded credential|api key leak|token leak|password leak|\bleak\b|exfiltrat|pii\b|\.env\b|dotenv|process\.env/i.test(
            hay
          );
        }
        return true;
      });
      if (!matchesProtect) return false;
    }

    return true;
  });
}
