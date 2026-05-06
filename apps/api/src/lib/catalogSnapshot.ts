import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type CatalogThreatJson = {
  publicId: string;
  family: "owasp_web" | "owasp_llm" | "mitre_atlas" | "vibe_coding";
  name: string;
  severity: "critical" | "high" | "medium" | "low" | "info" | null;
  description: string | null;
  cveId?: string | null;
  externalId?: string | null;
  source?: string;
  sourceUrl?: string | null;
  isActivelyExploited?: boolean;
  owaspRefs?: string[];
};

export type CatalogSnapshotFile = {
  version: 1;
  threats: CatalogThreatJson[];
};

function defaultCatalogPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../../web/public/data/catalog.json");
}

export function loadCatalogSnapshot(): CatalogSnapshotFile | null {
  if (process.env.USE_STATIC_CATALOG === "0") return null;
  const path = process.env.CATALOG_JSON_PATH?.trim() || defaultCatalogPath();
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (
      typeof raw !== "object" ||
      raw === null ||
      (raw as CatalogSnapshotFile).version !== 1 ||
      !Array.isArray((raw as CatalogSnapshotFile).threats)
    ) {
      return null;
    }
    return raw as CatalogSnapshotFile;
  } catch {
    return null;
  }
}
