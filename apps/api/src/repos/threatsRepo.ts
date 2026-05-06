import { asc } from "drizzle-orm";

import { threat } from "@aigently/db/schema";

import { loadCatalogSnapshot, type CatalogThreatJson } from "../lib/catalogSnapshot.js";
import { db } from "../lib/db.js";

export type ThreatListRow = {
  publicId: string;
  family: string;
  name: string;
  severity: string | null;
  description: string | null;
  cveId: string | null;
  externalId: string | null;
  source: string | null;
  sourceUrl: string | null;
  isActivelyExploited: boolean;
  owaspRefs: string[];
};

function mapCatalogThreat(t: CatalogThreatJson): ThreatListRow {
  return {
    publicId: t.publicId,
    family: t.family,
    name: t.name,
    severity: t.severity ?? null,
    description: t.description ?? null,
    cveId: t.cveId ?? null,
    externalId: t.externalId ?? t.publicId,
    source: t.source ?? null,
    sourceUrl: t.sourceUrl ?? null,
    isActivelyExploited: Boolean(t.isActivelyExploited),
    owaspRefs: Array.isArray(t.owaspRefs) ? t.owaspRefs : [],
  };
}

export async function listThreats(): Promise<ThreatListRow[]> {
  const dbRows = await db
    .select({
      publicId: threat.publicId,
      family: threat.family,
      name: threat.name,
      severity: threat.severity,
      description: threat.description,
      cveId: threat.cveId,
      externalId: threat.externalId,
      source: threat.source,
      sourceUrl: threat.sourceUrl,
      isActivelyExploited: threat.isActivelyExploited,
      owaspRefs: threat.owaspRefs,
    })
    .from(threat)
    .orderBy(asc(threat.family), asc(threat.publicId));

  const byPublic = new Map<string, ThreatListRow>();
  for (const r of dbRows) {
    byPublic.set(r.publicId, {
      publicId: r.publicId,
      family: r.family,
      name: r.name,
      severity: r.severity ?? null,
      description: r.description ?? null,
      cveId: r.cveId ?? null,
      externalId: r.externalId ?? r.publicId,
      source: r.source ?? null,
      sourceUrl: r.sourceUrl ?? null,
      isActivelyExploited: r.isActivelyExploited,
      owaspRefs: r.owaspRefs ?? [],
    });
  }

  const snap = loadCatalogSnapshot();
  if (snap) {
    for (const t of snap.threats) {
      if (!byPublic.has(t.publicId)) byPublic.set(t.publicId, mapCatalogThreat(t));
    }
  }

  return [...byPublic.values()].sort((a, b) => {
    const fam = a.family.localeCompare(b.family);
    if (fam !== 0) return fam;
    return a.publicId.localeCompare(b.publicId);
  });
}
