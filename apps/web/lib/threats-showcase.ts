import type { components } from "@aigently/api-client";

import { threatReferenceUrl as threatReferenceUrlImpl } from "@/lib/threat-links";

export type Threat = components["schemas"]["Threat"];

export type ThreatFeedItem = Threat & {
  cveLabel: string | null;
  /** When set, threat id / CVE label should link out (NVD, GHSA, OSV, CISA, etc.). */
  referenceUrl: string | null;
  tags: string[];
  rulesProtect: number;
};

/** @deprecated MVP uses DB-only threats; kept empty for backwards compatibility. */
export function getShowcaseThreats(): ThreatFeedItem[] {
  return [];
}

export function threatReferenceUrl(t: Pick<Threat, "sourceUrl" | "cveId" | "publicId" | "externalId">): string | null {
  return threatReferenceUrlImpl(t);
}

export function toFeedItem(t: Threat): ThreatFeedItem {
  const cveLabel =
    t.cveId && typeof t.cveId === "string"
      ? t.cveId
      : t.publicId.startsWith("THR-")
        ? null
        : t.publicId;
  const owasp = (t.owaspRefs ?? []).filter(Boolean);
  const tags =
    owasp.length > 0
      ? [...owasp.map((x) => `OWASP ${x}`), t.family.replaceAll("_", " ").toUpperCase()]
      : [t.family.replaceAll("_", " ").toUpperCase()];
  return {
    ...t,
    cveLabel,
    referenceUrl: threatReferenceUrl(t),
    tags,
    rulesProtect: t.severity === "critical" ? 3 : t.severity === "high" ? 2 : 1,
  };
}
