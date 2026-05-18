#!/usr/bin/env node
import { Server }                       from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport }          from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  handleGetSecurityContext,
  handleListStacks,
  handleGetRule,
  handleSearchThreats,
  handleGetThreat,
  handleGetManifest,
} from "./tools.js";
import { resolveLayersFromIntent } from "./intentResolver.js";

const server = new Server(
  { name: "@aigently/mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_security_context",
      description:
        "Smart security guardrail injection. Given a developer's intent (what they are building), " +
        "returns the relevant security rules (bodyMdx) and top CVE threats to inject into the AI context. " +
        "Automatically detects the tech stack from the intent text or file path. " +
        "Use this as the primary tool whenever a developer is writing code that touches security-sensitive areas.",
      inputSchema: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            description: "What the developer is trying to build or implement (free text).",
          },
          file_path: {
            type: "string",
            description: "Current file path — helps detect the tech stack automatically.",
          },
          stacks: {
            type: "array",
            items: { type: "string" },
            description: "Explicit stack slugs (e.g. [\"nextjs\", \"express\"]) if already known.",
          },
        },
        required: ["intent"],
      },
    },
    {
      name: "list_stacks",
      description: "Returns all supported technology stacks with their slug, name, ecosystem, catalog status, and security grade.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_rule",
      description: "Returns the full security rule (body + AI summary) for a given rule slug.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Rule slug, e.g. 'nextjs-security-patterns-v1'" },
        },
        required: ["slug"],
      },
    },
    {
      name: "search_threats",
      description: "Search the CVE/advisory threat catalog with optional filters.",
      inputSchema: {
        type: "object",
        properties: {
          query:      { type: "string",  description: "Free-text search against name and description." },
          severity:   { type: "string",  description: "Filter by severity: critical | high | medium | low | info" },
          owasp_ref:  { type: "string",  description: "Filter by OWASP category, e.g. 'A02' or 'LLM01'" },
          stack_slug: { type: "string",  description: "Filter to threats affecting a specific stack slug." },
          limit:      { type: "number",  description: "Max results to return (default 20)." },
        },
      },
    },
    {
      name: "get_threat",
      description: "Returns full details for a single threat by CVE ID or internal publicId, including AI-generated guardrail patterns.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "CVE ID (e.g. 'CVE-2024-21626') or internal publicId." },
        },
        required: ["id"],
      },
    },
    {
      name: "list_layers",
      description: "Returns the 15 protection layer categories used by Aigent.ly to organize guardrail rules (e.g. Authentication & Session, Input Validation, Secrets, etc.).",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_manifest",
      description: "Returns catalog metadata: version, generation timestamp, and counts of threats, rules, and stacks.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "compose_guardrail",
      description:
        "Compose a merged security guardrail for a stack and a set of protection concerns. " +
        "Use this when you need comprehensive protection rules for a project — it merges all relevant " +
        "rules across the requested layers into one canonical output tailored to the target IDE. " +
        "If layer_slugs is omitted, layers are inferred from the intent string automatically.",
      inputSchema: {
        type: "object",
        properties: {
          stack_slug: {
            type: "string",
            description: "Technology stack slug, e.g. 'nextjs', 'express', 'fastapi'.",
          },
          intent: {
            type: "string",
            description:
              "Natural language description of what you're building or protecting. " +
              "Used to auto-select layers when layer_slugs is omitted. " +
              "Example: 'user auth with JWT and Supabase RLS', 'public API with rate limiting'.",
          },
          layer_slugs: {
            type: "array",
            items: { type: "string" },
            description:
              "Explicit list of protection layer slugs. " +
              "If omitted, layers are inferred from the intent. " +
              "Available slugs: auth_session, authz_access, input_validation, secrets_credentials, " +
              "dependency_supply, data_privacy, api_security, database, infrastructure, " +
              "caching_cdn, frontend_network, observability, resilience, ai_safety, code_quality.",
          },
          target_ide: {
            type: "string",
            description: "IDE format for the output file: cursor | claude-code | windsurf | copilot | cline. Defaults to claude-code.",
          },
          rule_type: {
            type: "string",
            description: "Filter by rule type: all | pattern | deps | config | runtime. Defaults to all.",
          },
        },
        required: ["stack_slug"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  const result = await (async () => {
    switch (name) {
      case "get_security_context": return handleGetSecurityContext(args as unknown as Parameters<typeof handleGetSecurityContext>[0]);
      case "list_stacks":          return handleListStacks();
      case "get_rule":             return handleGetRule(args as unknown as Parameters<typeof handleGetRule>[0]);
      case "search_threats":       return handleSearchThreats(args as unknown as Parameters<typeof handleSearchThreats>[0]);
      case "get_threat":           return handleGetThreat(args as unknown as Parameters<typeof handleGetThreat>[0]);
      case "get_manifest":         return handleGetManifest();
      case "list_layers":          return handleListLayers();
      case "compose_guardrail":    return await handleComposeGuardrail(args as ComposeGuardrailArgs);
      default:                     return { error: `Unknown tool: ${name}` };
    }
  })();

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

const LAYER_TAXONOMY = [
  { slug: "auth_session",       name: "Authentication & Session",        tier: "core",          concern: "preventing authentication bypass, session fixation, and credential exposure" },
  { slug: "authz_access",       name: "Authorization & Access Control",  tier: "core",          concern: "enforcing ownership checks, RLS, and privilege boundaries" },
  { slug: "input_validation",   name: "Input Validation & Sanitization", tier: "core",          concern: "preventing injection attacks, path traversal, and malformed input" },
  { slug: "secrets_credentials",name: "Secrets & Credentials",           tier: "core",          concern: "preventing credential leakage and hardcoded secrets" },
  { slug: "dependency_supply",  name: "Dependency & Supply Chain",       tier: "core",          concern: "package pinning, audit hygiene, and transitive dep safety" },
  { slug: "data_privacy",       name: "Data Privacy & Compliance",       tier: "core",          concern: "PII handling, encryption at rest, and GDPR-pattern compliance" },
  { slug: "api_security",       name: "API Security & Rate Limiting",    tier: "infrastructure", concern: "throttling, CORS, versioning, and endpoint authentication" },
  { slug: "database",           name: "Database Hardening",              tier: "infrastructure", concern: "RLS, connection pooling, backup hygiene, and column encryption" },
  { slug: "infrastructure",     name: "Infrastructure & Deployment",     tier: "infrastructure", concern: "CI/CD secret hygiene, IAM least-privilege, and env isolation" },
  { slug: "caching_cdn",        name: "Caching & CDN",                   tier: "infrastructure", concern: "cache poisoning, stale auth data, and CDN security header bypass" },
  { slug: "frontend_network",   name: "Frontend & Network Security",     tier: "infrastructure", concern: "CSP, HTTPS-only cookies, SRI, and clickjacking defenses" },
  { slug: "observability",      name: "Observability & Incident Response",tier: "operational",  concern: "log hygiene, alerting, audit trails, and error boundary patterns" },
  { slug: "resilience",         name: "Resilience & Recovery",           tier: "operational",   concern: "backup strategy, failover, AZ distribution, and runbook coverage" },
  { slug: "ai_safety",          name: "AI & LLM Safety",                 tier: "operational",   concern: "prompt injection defense, LLM output validation, and context leakage" },
  { slug: "code_quality",       name: "Code Quality & Patterns",         tier: "operational",   concern: "error handling, null safety, and patterns that prevent vulnerability entry" },
];

function handleListLayers() {
  return {
    layers: LAYER_TAXONOMY,
    total: LAYER_TAXONOMY.length,
    tip: "Use layer slugs in compose_guardrail to get merged rules for specific concerns.",
  };
}

type ComposeGuardrailArgs = {
  stack_slug: string;
  intent?: string;
  layer_slugs?: string[];
  target_ide?: string;
  rule_type?: string;
};

async function handleComposeGuardrail(args: ComposeGuardrailArgs) {
  const apiUrl = process.env.AIGENTLY_API_URL ?? "http://127.0.0.1:4000";
  const targetIDE = args.target_ide ?? "claude-code";

  const layerSlugs =
    args.layer_slugs && args.layer_slugs.length > 0
      ? args.layer_slugs
      : resolveLayersFromIntent(args.intent ?? args.stack_slug);

  const layerNames = layerSlugs.map(
    (slug) => LAYER_TAXONOMY.find((l) => l.slug === slug)?.name ?? slug
  );

  try {
    const res = await fetch(`${apiUrl}/v1/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stackSlug: args.stack_slug,
        layerSlugs,
        ruleType: args.rule_type ?? "all",
        targetIDE,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      const detail = err.detail ?? `HTTP ${res.status}`;
      if (res.status === 503) {
        return {
          error: "summarizer_disabled",
          message: "The Aigent.ly summarizer is not enabled on this server.",
          fallback_tip: "Use get_security_context to retrieve individual rules instead.",
        };
      }
      if (res.status === 404) {
        return {
          error: "no_rules_found",
          stack: args.stack_slug,
          layers: layerNames,
          message: `No published rules found for ${args.stack_slug} on layers: ${layerNames.join(", ")}.`,
          fallback_tip: "Try fewer layers or use get_rule for a specific rule slug.",
        };
      }
      return { error: detail };
    }

    const data = await res.json() as {
      summarizedContent: string;
      ruleCount: number;
      layerCount: number;
      conflictCount: number;
      cacheHit: boolean;
    };

    return {
      guardrail: data.summarizedContent,
      meta: {
        stack: args.stack_slug,
        layers_used: layerNames,
        rule_count: data.ruleCount,
        conflict_count: data.conflictCount,
        cache_hit: data.cacheHit,
        target_ide: targetIDE,
      },
      usage_tip: `Save this content as a .${targetIDE === "cursor" ? "mdc" : "md"} file in your project's .cursor/rules/ or CLAUDE.md equivalent.`,
    };
  } catch (err) {
    return {
      error: "connection_failed",
      message: "Could not reach the Aigent.ly API.",
      fallback: {
        stack: args.stack_slug,
        layers_inferred: layerNames,
        tip: "Start the Aigent.ly API server and ensure AIGENTLY_API_URL is set correctly.",
      },
    };
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
