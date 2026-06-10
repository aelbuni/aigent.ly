import { threatReferenceUrl as threatReferenceUrlImpl } from "@/lib/threat-links";
import type { Threat } from "@/lib/threat-types";

export type { Threat };

export type ThreatFeedItem = Threat & {
  cveLabel: string | null;
  /** When set, threat id / CVE label should link out (NVD, GHSA, OSV, CISA, etc.). */
  referenceUrl: string | null;
  tags: string[];
  rulesProtect: number;
  epssScore: number | null;
  epssPercentile: number | null;
};

const FAMILY_LABELS: Record<string, string> = {
  owasp_web:    "OWASP Web",
  owasp_llm:    "OWASP LLM",
  mitre_atlas:  "MITRE ATLAS",
  vibe_coding:  "Vibe Coding",
};

export const LLM_REF_LABELS: Record<string, string> = {
  LLM01: "Prompt Injection",
  LLM02: "Insecure Output",
  LLM03: "Training Data Poisoning",
  LLM04: "Model DoS",
  LLM05: "Supply Chain",
  LLM06: "Sensitive Info Disclosure",
  LLM07: "Insecure Plugin Design",
};

/** @deprecated MVP uses DB-only threats; kept empty for backwards compatibility. */
export function getShowcaseThreats(): ThreatFeedItem[] {
  return [];
}

export function threatReferenceUrl(t: Pick<Threat, "sourceUrl" | "cveId" | "publicId" | "externalId">): string | null {
  return threatReferenceUrlImpl(t);
}

function formatOwaspRef(ref: string): string {
  if (ref.startsWith("LLM")) {
    const label = LLM_REF_LABELS[ref];
    return label ? `${ref} · ${label}` : ref;
  }
  return `OWASP ${ref}`;
}

export function toFeedItem(t: Threat): ThreatFeedItem {
  const cveLabel =
    t.cveId && typeof t.cveId === "string"
      ? t.cveId
      : t.publicId.startsWith("THR-")
        ? null
        : t.publicId;
  const owasp = (t.owaspRefs ?? []).filter(Boolean);
  const familyLabel = FAMILY_LABELS[t.family] ?? t.family.replaceAll("_", " ").toUpperCase();
  const tags =
    owasp.length > 0
      ? [...owasp.map(formatOwaspRef), familyLabel]
      : [familyLabel];
  return {
    ...t,
    cveLabel,
    referenceUrl: threatReferenceUrl(t),
    tags,
    rulesProtect: t.severity === "critical" ? 3 : t.severity === "high" ? 2 : 1,
    epssScore: (t as Threat).epssScore ?? null,
    epssPercentile: (t as Threat).epssPercentile ?? null,
  };
}
