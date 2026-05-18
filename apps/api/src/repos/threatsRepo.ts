import { asc } from "drizzle-orm";

import { threat } from "@aigently/db/schema";

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

  return dbRows.map((r) => ({
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
  }));
}
