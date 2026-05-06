const CVE_ID_RE = /^CVE-\d{4}-.+$/i;
const GHSA_ID_RE = /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/i;

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export type ThreatLinkFields = {
  sourceUrl?: string | null;
  cveId?: string | null;
  publicId?: string | null;
  externalId?: string | null;
};

/**
 * Best-effort external URL: curated `sourceUrl`, else NVD for CVE ids, else GitHub Advisory for GHSA.
 */
export function threatReferenceUrl(t: ThreatLinkFields): string | null {
  const candidates = [t.cveId?.trim(), t.publicId?.trim(), t.externalId?.trim()].filter(Boolean) as string[];
  for (const id of candidates) {
    if (CVE_ID_RE.test(id)) {
      return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id.toUpperCase())}`;
    }
    if (GHSA_ID_RE.test(id)) {
      return `https://github.com/advisories/${encodeURIComponent(id.toUpperCase())}`;
    }
  }

  const src = t.sourceUrl?.trim();
  if (src && isHttpUrl(src)) return src;

  return null;
}
