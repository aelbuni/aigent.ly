/**
 * ingest-url-threat.ts
 *
 * Takes a news article URL, uses Claude to extract a structured security threat,
 * upserts the threat into the DB, and creates a news feed article entry.
 *
 * Usage:
 *   URL="https://cybersecuritynews.com/openai-confirms-security-breach/" \
 *     pnpm --filter web ingest:url
 *
 *   # Dry-run (extract only, no DB writes):
 *   URL="https://..." DRY_RUN=true pnpm --filter web ingest:url
 */

import "../lib/load-web-env";

import { eq } from "drizzle-orm";

import { db, pool, article, threat, threatLayer, layer } from "../lib/db";
import { upsertThreat } from "./lib/upsert";
import type { NormalisedThreat } from "./lib/types";
import { createLLMClient, getModelForTask } from "../lib/summarizer/llm-client";

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === "true";
const [client, MODEL] = await Promise.all([
  createLLMClient(),
  getModelForTask("content_ingest"),
]);

// ── OWASP → Layer mapping (mirrors seed-threat-layers.ts) ────────────────────

const OWASP_TO_LAYER: Record<string, { primary: string; secondary?: string[] }> = {
  A01: { primary: "authz_access",         secondary: ["auth_session"] },
  A02: { primary: "data_privacy" },
  A03: { primary: "input_validation",     secondary: ["frontend_network"] },
  A04: { primary: "input_validation" },
  A05: { primary: "secrets_credentials",  secondary: ["infrastructure"] },
  A06: { primary: "dependency_supply" },
  A07: { primary: "auth_session" },
  A08: { primary: "input_validation",     secondary: ["frontend_network"] },
  A09: { primary: "observability" },
  A10: { primary: "api_security",         secondary: ["auth_session"] },
  LLM01: { primary: "ai_safety",          secondary: ["input_validation"] },
  LLM02: { primary: "ai_safety" },
  LLM03: { primary: "ai_safety" },
  LLM04: { primary: "ai_safety" },
  LLM05: { primary: "ai_safety" },
  LLM06: { primary: "ai_safety" },
  LLM07: { primary: "ai_safety" },
  LLM08: { primary: "ai_safety" },
  LLM09: { primary: "ai_safety" },
  LLM10: { primary: "ai_safety" },
};

// ── Stage 1 — Fetch & clean article HTML ─────────────────────────────────────

async function fetchArticleText(url: string): Promise<{
  title: string;
  bodyText: string;
  publishedAt: string | null;
}> {
  console.log(`  Fetching ${url} ...`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Aigently-ThreatBot/1.0 (+https://aigent.ly)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching article`);
  }

  const html = await res.text();

  // Extract title
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
    "Unknown Title";

  // Strip scripts, styles, nav, footer, then all remaining tags
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000); // Cap — enough context for Claude

  // Try to extract publish date from structured data
  const dateMatch =
    html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/i) ??
    html.match(/datePublished[^"]*"([^"]{10})/i) ??
    html.match(/<time[^>]+datetime=["'](\d{4}-\d{2}-\d{2})/i);

  return {
    title: title.trim().replace(/\s*[|\-–]\s*.*$/, ""), // strip site suffix
    bodyText,
    publishedAt: dateMatch?.[1] ?? null,
  };
}

// ── Stage 2 — Claude extraction tool ─────────────────────────────────────────

const EXTRACT_TOOL = {
  name: "extract_threat_from_article",
  description: "Extract a structured security threat and news article entry from a security news article",
  input_schema: {
    type: "object" as const,
    required: ["threat", "article"],
    properties: {
      threat: {
        type: "object",
        required: ["publicId", "name", "description", "severity", "family", "owaspRefs", "patternLines", "ruleContext"],
        properties: {
          publicId: {
            type: "string",
            description: "CVE ID if explicitly stated in article (e.g. CVE-2024-12345), otherwise generate: AIGENTLY-YYYY-<kebab-slug-from-title>",
          },
          cveId: {
            type: ["string", "null"],
            description: "CVE ID if explicitly stated in the article text, else null. NEVER invent a CVE ID.",
          },
          name: {
            type: "string",
            description: "Concise threat name ≤80 chars describing what was compromised or the attack class",
          },
          description: {
            type: "string",
            description: "2-3 sentences: what the vulnerability is, how it's exploited, what the impact is. Technical and factual.",
          },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "info"],
            description: "Based on impact: data breach of millions = critical, code execution = critical, auth bypass = high, info disclosure = high, DoS = medium/high",
          },
          family: {
            type: "string",
            enum: ["owasp_web", "owasp_llm", "mitre_atlas", "vibe_coding"],
            description: "owasp_web for web/infra vulnerabilities, owasp_llm for AI/LLM vulnerabilities",
          },
          owaspRefs: {
            type: "array",
            items: { type: "string" },
            description: "OWASP Top 10 Web (A01-A10) or LLM (LLM01-LLM10) categories. Pick all that apply.",
          },
          affectedProducts: {
            type: "array",
            items: { type: "string" },
            description: "Product or service names mentioned as affected, e.g. ['OpenAI API', 'ChatGPT']",
          },
          patternLines: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 4,
            description: "2-4 ALWAYS/NEVER guardrail statements for developers. Must start with ALWAYS or NEVER. Specific to this vulnerability class, not generic advice.",
          },
          ruleContext: {
            type: "string",
            description: "One sentence ≤120 chars. The real-world risk a developer needs to understand. No markdown, no backticks.",
          },
        },
      },
      article: {
        type: "object",
        required: ["slug", "title", "excerpt", "tags"],
        properties: {
          slug: {
            type: "string",
            description: "URL-safe lowercase slug, 3-6 words, hyphens only. e.g. 'openai-security-breach-2025'",
          },
          title: {
            type: "string",
            description: "Clean news headline for the Aigent.ly news feed, ≤80 chars",
          },
          excerpt: {
            type: "string",
            description: "1-2 sentences ≤200 chars. What happened and why it matters for developers building secure apps.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "2-5 lowercase tags, e.g. ['breach', 'ai', 'openai', 'a07']",
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a security analyst extracting structured threat intelligence from news articles for the Aigent.ly catalog — a directory of AI coding guardrails used by software developers.

THREAT extraction rules:
- Extract only the PRIMARY vulnerability or breach described — not every CVE mentioned
- If a CVE ID appears verbatim in the article, use it as publicId exactly (e.g. CVE-2024-12345)
- If no CVE is stated, generate: AIGENTLY-<YEAR>-<KEBAB-SLUG> using the current year and a slug from the threat name
- Severity: base on described impact (data breach at scale = critical, code execution = critical, auth bypass = high, DoS = medium)
- owaspRefs: use A01-A10 for web/infra, LLM01-LLM10 for AI/LLM threats
- patternLines: ALWAYS/NEVER statements — specific to this vulnerability class, about code structure and safe API usage only. Never mention package names, version numbers, or upgrade instructions.
- ruleContext: exactly one sentence ≤120 chars naming the specific real-world developer risk

ARTICLE rules:
- slug: lowercase, hyphens only, 3-6 words, no year unless disambiguation needed
- excerpt: developer-centric — what does this mean for someone building an app right now?
- tags: lowercase, 2-5 items`;

interface ThreatExtraction {
  threat: {
    publicId: string;
    cveId: string | null;
    name: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    family: "owasp_web" | "owasp_llm" | "mitre_atlas" | "vibe_coding";
    owaspRefs: string[];
    affectedProducts: string[];
    patternLines: string[];
    ruleContext: string;
  };
  article: {
    slug: string;
    title: string;
    excerpt: string;
    tags: string[];
  };
}

async function extractThreatFromArticle(
  url: string,
  articleTitle: string,
  bodyText: string
): Promise<ThreatExtraction> {
  console.log("  Calling Claude for extraction...");

  const userPrompt = [
    `Article URL: ${url}`,
    `Article Title: ${articleTitle}`,
    "",
    "Article Content:",
    bodyText,
    "",
    "Extract the primary security threat and news article entry from this article.",
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_threat_from_article" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return the expected tool call");
  }

  return toolUse.input as ThreatExtraction;
}

// ── Stage 3 — Upsert threat + threat_layer ────────────────────────────────────

async function persistThreat(
  extracted: ThreatExtraction,
  sourceUrl: string,
  publishedAt: string | null
): Promise<void> {
  const { threat: t } = extracted;

  const normalised: NormalisedThreat = {
    publicId: t.publicId,
    externalId: t.cveId ?? t.publicId,
    family: t.family,
    name: t.name.slice(0, 255),
    severity: t.severity,
    description: t.description,
    cveId: t.cveId ?? null,
    source: "aigently_internal",
    sourceUrl,
    publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
    owaspRefs: t.owaspRefs,
    mitreAttackIds: [],
    affectedProducts: t.affectedProducts.map((name) => ({
      name,
      ecosystem: "unknown",
      vulnerableVersionRange: null,
      patchedVersions: null,
    })),
    patchedVersion: null,
    isActivelyExploited: false,
    cisaActionDue: null,
    details: {},
    affectedStackSlugs: [],
  };

  await upsertThreat(normalised);

  // Store AI-generated guardrail content in aiAmplification
  await db
    .update(threat)
    .set({
      aiAmplification: JSON.stringify({
        patternLines: t.patternLines,
        ruleContext: t.ruleContext,
        generatedAt: new Date().toISOString(),
        model: MODEL,
      }),
    })
    .where(eq(threat.publicId, t.publicId));

  // Wire threat → layers via OWASP refs
  const layerRows = await db.select({ id: layer.id, slug: layer.slug }).from(layer);
  const layerBySlug = new Map(layerRows.map((l) => [l.slug, l.id]));

  const layersToLink = new Map<string, "primary" | "secondary">();
  for (const ref of t.owaspRefs) {
    const mapping = OWASP_TO_LAYER[ref];
    if (!mapping) continue;
    if (!layersToLink.has(mapping.primary)) layersToLink.set(mapping.primary, "primary");
    for (const sec of mapping.secondary ?? []) {
      if (!layersToLink.has(sec)) layersToLink.set(sec, "secondary");
    }
  }
  if (layersToLink.size === 0) layersToLink.set("input_validation", "primary");

  for (const [slug, relevance] of layersToLink) {
    const layerId = layerBySlug.get(slug);
    if (!layerId) continue;
    await db
      .insert(threatLayer)
      .values({ threatId: t.publicId, layerId, relevance, rationale: `Ingested from: ${sourceUrl}` })
      .onConflictDoNothing();
  }

  const linkedLayers = [...layersToLink.keys()].join(", ");
  console.log(`  Threat upserted: ${t.publicId} → layers: ${linkedLayers}`);
}

// ── Stage 4 — Upsert article (news feed) ─────────────────────────────────────

async function persistArticle(
  extracted: ThreatExtraction,
  sourceUrl: string,
  publishedAt: string | null
): Promise<void> {
  const { article: a, threat: t } = extracted;

  await db
    .insert(article)
    .values({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      tags: a.tags,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      // bodyMdx holds the source link + description for the news card
      bodyMdx: [
        `> **Source:** [${a.title}](${sourceUrl})`,
        "",
        t.description,
        "",
        "## Guardrail patterns",
        "",
        ...t.patternLines.map((l) => `- ${l}`),
        "",
        `*Threat ID: ${t.publicId}*`,
      ].join("\n"),
      contentPath: null,
    })
    .onConflictDoNothing();

  console.log(`  Article upserted: /news#${a.slug}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.URL?.trim();
  if (!url) {
    console.error("Error: URL environment variable is required.");
    console.error("Usage: URL=https://... pnpm --filter web ingest:url");
    process.exitCode = 1;
    return;
  }

  console.log(`\nAigent.ly URL Threat Ingestion`);
  console.log(`Model: ${MODEL}${DRY_RUN ? " (DRY RUN — no DB writes)" : ""}\n`);

  // Stage 1: fetch
  const { title, bodyText, publishedAt } = await fetchArticleText(url);
  console.log(`  Title: "${title}"`);
  console.log(`  Published: ${publishedAt ?? "(unknown)"}`);
  console.log(`  Content: ${bodyText.length} chars\n`);

  // Stage 2: extract
  const extracted = await extractThreatFromArticle(url, title, bodyText);
  console.log(`\n  Extracted threat:`);
  console.log(`    publicId:    ${extracted.threat.publicId}`);
  console.log(`    name:        ${extracted.threat.name}`);
  console.log(`    severity:    ${extracted.threat.severity}`);
  console.log(`    family:      ${extracted.threat.family}`);
  console.log(`    owaspRefs:   ${extracted.threat.owaspRefs.join(", ") || "(none)"}`);
  console.log(`    ruleContext: ${extracted.threat.ruleContext}`);
  console.log(`\n  Extracted article:`);
  console.log(`    slug:    ${extracted.article.slug}`);
  console.log(`    title:   ${extracted.article.title}`);
  console.log(`    excerpt: ${extracted.article.excerpt}`);
  console.log(`    tags:    ${extracted.article.tags.join(", ")}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Skipping DB writes. Set DRY_RUN=false to persist.");
    return;
  }

  console.log("");

  // Stage 3: persist threat
  await persistThreat(extracted, url, publishedAt);

  // Stage 4: persist article
  await persistArticle(extracted, url, publishedAt);

  console.log(`\nDone. Visit /news and /threats to see the new entries.`);
}

main()
  .catch((err) => {
    console.error("\nFatal:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
