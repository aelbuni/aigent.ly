import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { components } from "@aigently/api-client";

type Threat = components["schemas"]["Threat"];

type CatalogFile = {
  version?: number;
  threats?: unknown[];
};

/** Static `public/data/catalog.json` — same DTO shape as `GET /v1/threats` items when possible. */
export function loadPublicCatalogThreats(): Threat[] {
  try {
    const path = join(process.cwd(), "public/data/catalog.json");
    if (!existsSync(path)) return [];
    const raw = JSON.parse(readFileSync(path, "utf8")) as CatalogFile;
    if (raw.version !== 1 || !Array.isArray(raw.threats)) return [];
    return raw.threats.filter((t): t is Threat => {
      if (!t || typeof t !== "object") return false;
      const o = t as Record<string, unknown>;
      return typeof o.publicId === "string" && typeof o.family === "string" && typeof o.name === "string";
    });
  } catch {
    return [];
  }
}
