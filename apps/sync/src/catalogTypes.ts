/** Static catalog snapshot (v1) — written by `npm run sync:catalog`; read by API / tooling. */

export type CatalogThreatStack = {
  threatPublicId: string;
  stackSlug: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  isMitigatedByRules: boolean;
};

export type CatalogThreat = {
  publicId: string;
  family: "owasp_web" | "owasp_llm" | "mitre_atlas" | "vibe_coding";
  name: string;
  severity: "critical" | "high" | "medium" | "low" | "info" | null;
  description: string | null;
  cveId?: string | null;
  externalId?: string | null;
  source?:
    | "nvd"
    | "osv"
    | "ghsa"
    | "cisa_kev"
    | "aigently"
    | "mitre_atlas"
    | "aigently_internal";
  sourceUrl?: string | null;
  isActivelyExploited?: boolean;
};

export type CatalogSnapshotV1 = {
  version: 1;
  generatedAt: string;
  threats: CatalogThreat[];
  threatStacks: CatalogThreatStack[];
  syncMeta: {
    kev?: { url: string; ingested: number; cap: number };
    osv?: { ecosystem: string; ingested: number; error?: string };
    ghsa?: { ingested: number; error?: string };
    nvd?: { error?: string };
    dbUpsert?: "skipped" | "ok" | "error";
    dbUpsertError?: string;
  };
};
