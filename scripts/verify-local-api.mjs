#!/usr/bin/env node
/**
 * Confirms local API is reachable and returns stacks + rules (plan: verify-api-env).
 * Reads INTERNAL_API_URL from the environment, or from apps/web/.env / apps/web/.env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

function loadInternalApiUrl() {
  if (process.env.INTERNAL_API_URL?.trim()) {
    return process.env.INTERNAL_API_URL.trim().replace(/\/$/, "");
  }
  for (const rel of ["apps/web/.env.local", "apps/web/.env"]) {
    const p = resolve(root, rel);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*INTERNAL_API_URL\s*=\s*(.+)\s*$/);
      if (m) {
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return v.replace(/\/$/, "");
      }
    }
  }
  return null;
}

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    const code = e?.cause?.code ?? e?.code;
    if (code === "ECONNREFUSED") {
      console.error(
        `Cannot reach ${url} (connection refused).\n` +
          "  Start the API from the repo root: npm run dev:api\n" +
          "  Ensure apps/web/.env has INTERNAL_API_URL=http://127.0.0.1:4000"
      );
      process.exit(1);
    }
    throw e;
  }
}

const base = loadInternalApiUrl();
if (!base) {
  console.error(
    "INTERNAL_API_URL is not set.\n" +
      "  Add it to apps/web/.env (see apps/web/.env.example), e.g.\n" +
      "  INTERNAL_API_URL=http://127.0.0.1:4000\n" +
      "  Then start the API: npm run dev:api"
  );
  process.exit(1);
}

const health = await getJson(`${base}/v1/health`);
if (!health.ok) {
  console.error(`GET ${base}/v1/health failed: HTTP ${health.status}`);
  console.error(health.body);
  process.exit(1);
}

const stacksRes = await getJson(`${base}/v1/stacks`);
if (!stacksRes.ok) {
  console.error(`GET ${base}/v1/stacks failed: HTTP ${stacksRes.status}`);
  process.exit(1);
}
const stackItems = stacksRes.body?.items ?? [];
const rulesRes = await getJson(`${base}/v1/rules?limit=20`);
if (!rulesRes.ok) {
  console.error(`GET ${base}/v1/rules failed: HTTP ${rulesRes.status}`);
  process.exit(1);
}
const ruleItems = rulesRes.body?.items ?? [];

console.log(`API base: ${base}`);
console.log(`Health: ${JSON.stringify(health.body)}`);
console.log(`Stacks: ${stackItems.length} row(s)`);
if (stackItems.length) {
  console.log(`  e.g. ${stackItems.slice(0, 3).map((s) => s.slug).join(", ")}`);
}
console.log(`Rules (first page, limit=20): ${ruleItems.length} row(s)`);
if (ruleItems.length) {
  console.log(`  e.g. ${ruleItems.slice(0, 2).map((r) => r.slug).join(", ")}`);
}

console.log("\nOK — Next.js can use the same INTERNAL_API_URL for server-side fetches.");
