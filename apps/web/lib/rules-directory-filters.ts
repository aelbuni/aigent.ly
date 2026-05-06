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
    protect: string[];
  }
): RuleDirectoryCard[] {
  const q = opts.q.trim().toLowerCase();
  const types = opts.types as RuleTypeFilter[];
  const protect = opts.protect as ProtectFilter[];

  return cards.filter((card) => {
    const layers = card.layers ?? [];
    const threat = (card.threatSignals ?? "").toLowerCase();
    const hay = `${card.name} ${card.description} ${card.slug} ${card.tags.join(" ")} ${card.stacks.join(" ")} ${threat}`.toLowerCase();
    if (q && !hay.includes(q)) return false;

    if (types.length > 0) {
      const matchesType = types.some((t) => {
        if (t === "security") {
          if (layers.includes("security")) return true;
          return SECURITY_TEXT_FALLBACK.test(hay);
        }
        if (t === "performance") {
          return /perf|budget|cache|speed|latency|hydration/i.test(hay);
        }
        if (t === "type_safety") {
          if (layers.includes("code_quality")) return true;
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
