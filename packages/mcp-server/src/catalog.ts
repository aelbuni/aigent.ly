import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.resolve(__dirname, "../../catalog-data");

export interface CatalogStack {
  slug: string;
  name: string;
  ecosystem: string | null;
  catalogStatus: string;
  securityGrade: string | null;
  sortOrder: number;
}

export interface AiAmplification {
  patternLines: string[];
  ruleContext: string;
  generatedAt: string;
  model: string;
}

export interface CatalogThreat {
  publicId: string;
  cveId: string | null;
  source: string;
  sourceUrl: string | null;
  family: string;
  name: string;
  description: string | null;
  severity: string | null;
  owaspRefs: string[];
  isActivelyExploited: boolean;
  affectedProducts: unknown;
  aiAmplification: string | null; // JSON string — parse to AiAmplification
  publishedAt: string | null;
  syncedAt: string | null;
  stacks: string[];
}

export interface CatalogRule {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  bodyMdx: string | null;
  summaryMdx: string | null;
  stacks: string[];
  threatIds: string[];
}

export interface Manifest {
  version: string;
  generatedAt: string;
  counts: { threats: number; rules: number; stacks: number };
}

function load<T>(filename: string): T {
  const fullPath = path.join(CATALOG_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

// Lazy singletons — loaded once per process
let _stacks:   CatalogStack[]  | null = null;
let _threats:  CatalogThreat[] | null = null;
let _rules:    CatalogRule[]   | null = null;
let _manifest: Manifest        | null = null;

export function getStacks():   CatalogStack[]  { return (_stacks   ??= load<CatalogStack[]>("stacks.json")); }
export function getThreats():  CatalogThreat[] { return (_threats  ??= load<CatalogThreat[]>("threats.json")); }
export function getRules():    CatalogRule[]   { return (_rules    ??= load<CatalogRule[]>("rules.json")); }
export function getManifest(): Manifest        { return (_manifest ??= load<Manifest>("manifest.json")); }

export function parseAmplification(raw: string | null): AiAmplification | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as AiAmplification; } catch { return null; }
}
