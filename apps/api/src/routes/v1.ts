import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import yaml from "js-yaml";

import { sendProblem } from "../lib/problem.js";
import { buildComposerMarkdownExport, buildSkillMdExport } from "../services/composerExport.js";
import { getIdeBySlug, listIdes } from "../repos/idesRepo.js";
import {
  getRuleBySlug,
  getValidLayerSlugs,
  listRulesPaginated,
} from "../repos/rulesRepo.js";
import {
  associateThreatToLayer,
  getLayerBySlug,
  listActiveLayers,
  listLayersForStack,
  listLayersWithStats,
  listThreatsForLayer,
  removeThreatFromLayer,
} from "../repos/layersRepo.js";
import { listPolicyTemplatesForStack } from "../repos/policyTemplatesRepo.js";
import { getStackBySlug, listStacks } from "../repos/stacksRepo.js";
import { getStackOverview } from "../repos/stackOverviewRepo.js";
import { listSyncLogs } from "../repos/syncLogsRepo.js";
import { listThreats } from "../repos/threatsRepo.js";
import { runSummarizer, runSummarizerForLayer, streamSummarizer, detectProvider } from "../services/summarizer/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadOpenApiDocument() {
  const specPath = join(__dirname, "../../../../specs/openapi.yaml");
  const raw = readFileSync(specPath, "utf8");
  const root = yaml.load(raw) as Record<string, unknown>;
  const { paths: _p, ...rest } = root;
  return rest;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function executeBulkGuardrailGeneration(
  mode: "empty" | "stale" | "all"
): Promise<{ generated: number; skipped: number; errors: string[] }> {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("../lib/db.js");
  const { stack, rule, ruleStack, summarizedGuardrail } = await import("@aigently/db/schema");

  // Collect all stacks that have rules
  const stackRows = await db
    .selectDistinct({ stackSlug: stack.slug, stackId: stack.id })
    .from(rule)
    .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
    .innerJoin(stack, eq(stack.id, ruleStack.stackId));

  const CONTENT_TYPES: Array<"patterns" | "deps"> = ["patterns", "deps"];
  const now = new Date();
  let generated = 0;
  const errors: string[] = [];

  for (const { stackSlug, stackId } of stackRows) {
    for (const contentType of CONTENT_TYPES) {
      const layerSlug = contentType === "deps" ? "dependency_supply" : "auth_session";
      const shouldGenerate = await (async () => {
        if (mode === "all") return true;
        const [existing] = await db
          .select({ id: summarizedGuardrail.id, expiresAt: summarizedGuardrail.expiresAt })
          .from(summarizedGuardrail)
          .where(and(eq(summarizedGuardrail.stackId, stackId), eq(summarizedGuardrail.contentType, contentType)))
          .limit(1);
        if (mode === "empty") return !existing;
        return !existing || (existing.expiresAt !== null && existing.expiresAt < now);
      })();

      if (!shouldGenerate) continue;

      try {
        await runSummarizerForLayer(stackSlug, layerSlug, contentType);
        generated++;
      } catch (e) {
        errors.push(`${stackSlug}/${contentType}: ${e instanceof Error ? e.message : String(e)}`);
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const totalPossible = stackRows.length * CONTENT_TYPES.length;
  return { generated, skipped: totalPossible - generated - errors.length, errors };
}

export async function registerV1Routes(app: FastifyInstance) {
  const openapiDocument = loadOpenApiDocument();

  await app.register(swagger, {
    openapi: openapiDocument as Record<string, unknown>,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  app.get(
    "/v1/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            required: ["status"],
            properties: { status: { type: "string", enum: ["ok"] } },
          },
        },
      },
    },
    async () => ({ status: "ok" as const })
  );

  app.get(
    "/v1/ides",
    {
      schema: {
        tags: ["Ides"],
        summary: "List IDEs",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "slug", "name", "sortOrder"],
                  properties: {
                    id: { type: "integer" },
                    slug: { type: "string" },
                    name: { type: "string" },
                    sortOrder: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => ({ items: await listIdes() })
  );

  app.get(
    "/v1/stacks",
    {
      schema: {
        tags: ["Stacks"],
        summary: "List stacks",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "slug", "name", "sortOrder", "catalogStatus"],
                    properties: {
                      id: { type: "integer" },
                      slug: { type: "string" },
                      name: { type: "string" },
                      logoPath: { type: "string", nullable: true },
                      sortOrder: { type: "integer" },
                      catalogStatus: { type: "string", enum: ["launch", "coming_soon"] },
                    },
                  },
                },
            },
          },
        },
      },
    },
    async () => {
      const stacks = await listStacks();
      return { items: stacks };
    }
  );

  app.get<{ Params: { stackSlug: string } }>(
    "/v1/stacks/:stackSlug",
    {
      schema: {
        tags: ["Stacks"],
        summary: "Stack detail",
        params: {
          type: "object",
          required: ["stackSlug"],
          properties: { stackSlug: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            required: ["id", "slug", "name", "sortOrder", "ruleCount", "catalogStatus"],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              name: { type: "string" },
              logoPath: { type: "string", nullable: true },
              sortOrder: { type: "integer" },
              ruleCount: { type: "integer" },
              catalogStatus: { type: "string", enum: ["launch", "coming_soon"] },
            },
          },
          404: {
            type: "object",
            required: ["type", "title", "status"],
            properties: {
              type: { type: "string" },
              title: { type: "string" },
              status: { type: "integer" },
              detail: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const row = await getStackBySlug(req.params.stackSlug);
      if (!row) {
        return sendProblem(
          reply,
          404,
          "not-found",
          "Stack not found",
          `No stack with slug ${req.params.stackSlug}`
        );
      }
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        logoPath: row.logoPath,
        sortOrder: row.sortOrder,
        catalogStatus: row.catalogStatus,
        ruleCount: row.ruleCount,
      };
    }
  );

  app.get<{ Params: { stackSlug: string } }>(
    "/v1/stacks/:stackSlug/overview",
    {
      schema: {
        tags: ["Stacks"],
        summary: "Stack overview (grades, coverage, framework, threats)",
        params: {
          type: "object",
          required: ["stackSlug"],
          properties: { stackSlug: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const row = await getStackOverview(req.params.stackSlug);
      if (!row) {
        return sendProblem(
          reply,
          404,
          "not-found",
          "Stack not found",
          `No stack with slug ${req.params.stackSlug}`
        );
      }
      const s = row.stack;
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        logoPath: s.logoPath,
        sortOrder: s.sortOrder,
        ruleCount: s.ruleCount,
        securityGrade: s.securityGrade ?? null,
        gradeRationale: s.gradeRationale ?? null,
        ecosystem: s.ecosystem ?? null,
        nvdKeywords: s.nvdKeywords ?? [],
        osvEcosystem: s.osvEcosystem ?? null,
        coverageAreas: row.coverageAreas,
        frameworkFeatures: row.frameworkFeatures,
        threatMatrix: row.threatMatrix,
      };
    }
  );

  app.get<{ Params: { stackSlug: string } }>(
    "/v1/stacks/:stackSlug/policy-templates",
    {
      schema: {
        tags: ["Composer"],
        summary: "Policy templates for stack",
        params: {
          type: "object",
          required: ["stackSlug"],
          properties: { stackSlug: { type: "string" } },
        },
      },
    },
    async (req) => ({
      items: await listPolicyTemplatesForStack(req.params.stackSlug),
    })
  );

  app.get<{ Querystring: { limit?: number } }>(
    "/v1/sync/logs",
    {
      schema: {
        tags: ["Sync"],
        summary: "Recent sync runs",
        querystring: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
        },
      },
    },
    async (req) => ({
      items: await listSyncLogs(req.query.limit),
    })
  );

  app.get(
    "/v1/threats",
    {
      schema: {
        tags: ["Threats"],
        summary: "List threats",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["publicId", "family", "name"],
                  properties: {
                    publicId: { type: "string" },
                    family: { type: "string" },
                    name: { type: "string" },
                    severity: { type: "string", nullable: true },
                    description: { type: "string", nullable: true },
                    cveId: { type: "string", nullable: true },
                    externalId: { type: "string", nullable: true },
                    source: { type: "string", nullable: true },
                    sourceUrl: { type: "string", nullable: true },
                    isActivelyExploited: { type: "boolean" },
                    owaspRefs: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const threats = await listThreats();
      return {
        items: threats.map((t) => ({
          ...t,
          severity: t.severity ?? null,
          description: t.description ?? null,
          cveId: t.cveId ?? null,
          externalId: t.externalId ?? null,
          source: t.source ?? null,
          sourceUrl: t.sourceUrl ?? null,
          isActivelyExploited: t.isActivelyExploited,
          owaspRefs: t.owaspRefs ?? [],
        })),
      };
    }
  );

  app.get<{ Querystring: { cursor?: string; limit?: number; stackSlug?: string } }>(
    "/v1/rules",
    {
      schema: {
        tags: ["Rules"],
        summary: "List rules (cursor pagination)",
        querystring: {
          type: "object",
          properties: {
            cursor: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            stackSlug: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "id",
                    "slug",
                    "name",
                    "description",
                    "version",
                    "certified",
                    "weeklyUses",
                  ],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    slug: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    version: { type: "string" },
                    certified: { type: "boolean" },
                    lineCount: { type: "integer", nullable: true },
                    weeklyUses: { type: "integer" },
                  },
                },
              },
              nextCursor: { type: "string", nullable: true },
            },
          },
          400: {
            type: "object",
            required: ["type", "title", "status"],
            properties: {
              type: { type: "string" },
              title: { type: "string" },
              status: { type: "integer" },
              detail: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const cursor = req.query.cursor;
      if (cursor && !UUID_RE.test(cursor)) {
        return sendProblem(
          reply,
          400,
          "invalid-cursor",
          "Invalid cursor",
          "cursor must be a UUID from a previous page"
        );
      }
      const stackSlug = req.query.stackSlug?.trim();
      if (stackSlug) {
        const stackRow = await getStackBySlug(stackSlug);
        if (!stackRow) {
          return sendProblem(
            reply,
            400,
            "invalid-stack",
            "Unknown stack",
            `No stack with slug ${stackSlug}`
          );
        }
      }
      const { items, nextCursor } = await listRulesPaginated(
        cursor,
        req.query.limit,
        stackSlug || undefined
      );
      return {
        items: items.map((r) => ({
          ...r,
          id: r.id,
          lineCount: r.lineCount ?? null,
          weeklyUses: r.weeklyUses ?? 0,
        })),
        nextCursor,
      };
    }
  );

  app.get<{ Params: { ruleSlug: string } }>(
    "/v1/rules/:ruleSlug",
    {
      schema: {
        tags: ["Rules"],
        summary: "Rule by slug",
        params: {
          type: "object",
          required: ["ruleSlug"],
          properties: { ruleSlug: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            required: [
              "id",
              "slug",
              "name",
              "description",
              "version",
              "certified",
              "weeklyUses",
              "layers",
              "linkedThreats",
            ],
            properties: {
              id: { type: "string", format: "uuid" },
              slug: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              version: { type: "string" },
              certified: { type: "boolean" },
              lineCount: { type: "integer", nullable: true },
              weeklyUses: { type: "integer" },
              bodyMdx: { type: "string", nullable: true },
              layers: {
                type: "array",
                items: { type: "string" },
              },
              linkedThreats: {
                type: "array",
                items: {
                  type: "object",
                  required: ["publicId", "name"],
                  properties: {
                    publicId: { type: "string" },
                    cveId: { type: "string", nullable: true },
                    name: { type: "string" },
                    sourceUrl: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          404: {
            type: "object",
            required: ["type", "title", "status"],
            properties: {
              type: { type: "string" },
              title: { type: "string" },
              status: { type: "integer" },
              detail: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const row = await getRuleBySlug(req.params.ruleSlug);
      if (!row) {
        return sendProblem(
          reply,
          404,
          "not-found",
          "Rule not found",
          `No rule with slug ${req.params.ruleSlug}`
        );
      }
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        version: row.version,
        certified: row.certified,
        lineCount: row.lineCount ?? null,
        weeklyUses: row.weeklyUses ?? 0,
        bodyMdx: row.bodyMdx,
        layers: row.layers?.map((l: any) => (typeof l === "string" ? l : l.slug)) ?? [],
        linkedThreats: row.linkedThreats,
      };
    }
  );

  app.post<{
    Body: { stackSlug: string; ideSlug: string; layers?: string[]; mode?: string };
  }>(
    "/v1/composer/export",
    {
      schema: {
        tags: ["Composer"],
        summary: "Export merged rules markdown",
        body: {
          type: "object",
          required: ["stackSlug", "ideSlug"],
          properties: {
            stackSlug: { type: "string" },
            ideSlug: { type: "string" },
            layers: {
              type: "array",
              items: { type: "string" },
            },
            mode: { type: "string", enum: ["rule", "skill"] },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["format", "content", "filename"],
            properties: {
              format: { type: "string", enum: ["markdown"] },
              content: { type: "string" },
              filename: { type: "string" },
              layers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    layerSlug: { type: "string" },
                    layerName: { type: "string" },
                    threatCount: { type: "integer" },
                    threats: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          cveId: { type: "string", nullable: true },
                          severity: { type: "string", nullable: true },
                          name: { type: "string" },
                          sourceUrl: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            required: ["type", "title", "status"],
            properties: {
              type: { type: "string" },
              title: { type: "string" },
              status: { type: "integer" },
              detail: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { stackSlug, ideSlug } = req.body;
      if (!stackSlug?.trim() || !ideSlug?.trim()) {
        return sendProblem(reply, 400, "invalid-body", "Invalid body", "stackSlug and ideSlug are required");
      }
      const stackRow = await getStackBySlug(stackSlug.trim());
      if (!stackRow) {
        return sendProblem(reply, 400, "invalid-stack", "Unknown stack", `No stack with slug ${stackSlug}`);
      }
      const ideRow = await getIdeBySlug(ideSlug.trim());
      if (!ideRow) {
        return sendProblem(reply, 400, "invalid-ide", "Unknown IDE", `No IDE with slug ${ideSlug}`);
      }
      const ruleTypeRaw = req.body.layers?.[0];
      const ruleType: "all" | "patterns" | "deps" =
        ruleTypeRaw === "patterns" || ruleTypeRaw === "deps" ? ruleTypeRaw : "all";
      const mode = req.body.mode ?? "rule";
      if (mode === "skill" && ideSlug.trim() === "claude-code") {
        return buildSkillMdExport({
          stackSlug: stackSlug.trim(),
          ideSlug: ideSlug.trim(),
          ruleType,
          stackName: stackRow.name,
        });
      }
      return buildComposerMarkdownExport({
        stackSlug: stackSlug.trim(),
        ideSlug: ideSlug.trim(),
        ruleType,
      });
    }
  );

  // ─── Layer endpoints ────────────────────────────────────────────────────────

  const LAYER_SCHEMA = {
    type: "object",
    required: ["id", "slug", "name", "description", "concernStatement", "isSystem", "isActive", "sortOrder"],
    properties: {
      id: { type: "string", format: "uuid" },
      // publicId was dropped in schema v2 — slug is the only external layer identifier
      slug: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      concernStatement: { type: "string" },
      iconName: { type: "string", nullable: true },
      colorToken: { type: "string", nullable: true },
      isSystem: { type: "boolean" },
      isActive: { type: "boolean" },
      sortOrder: { type: "integer" },
    },
  } as const;

  app.get(
    "/v1/layers",
    {
      schema: {
        tags: ["Layers"],
        summary: "List active layers with stats",
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  ...LAYER_SCHEMA,
                  properties: {
                    ...LAYER_SCHEMA.properties,
                    ruleCount: { type: "integer" },
                    threatCount: { type: "integer" },
                    stackCount: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => ({ items: await listLayersWithStats() })
  );

  app.get<{ Params: { slug: string } }>(
    "/v1/layers/:slug",
    {
      schema: {
        tags: ["Layers"],
        summary: "Layer detail",
        params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
        response: {
          200: LAYER_SCHEMA,
          404: { type: "object", required: ["type", "title", "status"], properties: { type: { type: "string" }, title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const row = await getLayerBySlug(req.params.slug);
      if (!row) return sendProblem(reply, 404, "not-found", "Layer not found", `No layer with slug ${req.params.slug}`);
      return row;
    }
  );

  app.get<{ Params: { slug: string } }>(
    "/v1/layers/:slug/threats",
    {
      schema: {
        tags: ["Layers"],
        summary: "Threats associated with a layer",
        params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["threatId", "name"],
                  properties: {
                    threatId: { type: "string" },
                    name: { type: "string" },
                    severity: { type: "string", nullable: true },
                    cveId: { type: "string", nullable: true },
                    relevance: { type: "string", nullable: true },
                    rationale: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req) => ({ items: await listThreatsForLayer(req.params.slug) })
  );

  app.post<{ Params: { slug: string }; Body: { threatId: string; relevance?: string; rationale?: string } }>(
    "/v1/layers/:slug/threats",
    {
      schema: {
        tags: ["Layers"],
        summary: "Associate a threat to a layer",
        params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
        body: {
          type: "object",
          required: ["threatId"],
          properties: {
            threatId: { type: "string" },
            relevance: { type: "string", enum: ["primary", "secondary"] },
            rationale: { type: "string" },
          },
        },
        response: {
          204: { type: "null" },
          401: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
          404: { type: "object", required: ["type", "title", "status"], properties: { type: { type: "string" }, title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const adminToken = process.env.ADMIN_API_TOKEN;
      if (!adminToken || req.headers.authorization !== `Bearer ${adminToken}`) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const layerRow = await getLayerBySlug(req.params.slug);
      if (!layerRow) return sendProblem(reply, 404, "not-found", "Layer not found", `No layer with slug ${req.params.slug}`);
      const relevance = (req.body.relevance === "secondary" ? "secondary" : "primary") as "primary" | "secondary";
      await associateThreatToLayer(req.params.slug, req.body.threatId, relevance, req.body.rationale);
      reply.code(204);
    }
  );

  app.delete<{ Params: { slug: string; threatId: string } }>(
    "/v1/layers/:slug/threats/:threatId",
    {
      schema: {
        tags: ["Layers"],
        summary: "Remove threat association from layer",
        params: { type: "object", required: ["slug", "threatId"], properties: { slug: { type: "string" }, threatId: { type: "string" } } },
        response: {
          204: { type: "null" },
          401: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const adminToken = process.env.ADMIN_API_TOKEN;
      if (!adminToken || req.headers.authorization !== `Bearer ${adminToken}`) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      await removeThreatFromLayer(req.params.slug, req.params.threatId);
      reply.code(204);
    }
  );

  app.get<{ Params: { stackSlug: string } }>(
    "/v1/stacks/:stackSlug/layers",
    {
      schema: {
        tags: ["Layers"],
        summary: "Active layers for a stack with rule counts",
        params: { type: "object", required: ["stackSlug"], properties: { stackSlug: { type: "string" } } },
        response: {
          200: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  ...LAYER_SCHEMA,
                  properties: {
                    ...LAYER_SCHEMA.properties,
                    ruleCount: { type: "integer" },
                  },
                },
              },
            },
          },
          404: { type: "object", required: ["type", "title", "status"], properties: { type: { type: "string" }, title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const stackRow = await getStackBySlug(req.params.stackSlug);
      if (!stackRow) return sendProblem(reply, 404, "not-found", "Stack not found", `No stack with slug ${req.params.stackSlug}`);
      return { items: await listLayersForStack(req.params.stackSlug) };
    }
  );

  // ─── Summarizer endpoints ───────────────────────────────────────────────────

  app.post<{
    Body: {
      stackSlug: string;
      layerSlugs: string[];
      ruleIds?: string[];
      ruleType?: string;
      targetIDE?: string;
      maxTokens?: number;
    };
  }>(
    "/v1/summarize",
    {
      schema: {
        tags: ["Summarizer"],
        summary: "Generate or retrieve per-layer guardrail summaries",
        body: {
          type: "object",
          required: ["stackSlug", "layerSlugs"],
          properties: {
            stackSlug: { type: "string" },
            layerSlugs: { type: "array", items: { type: "string" }, minItems: 1 },
            ruleIds: { type: "array", items: { type: "string" } },
            ruleType: { type: "string", enum: ["pattern", "deps", "config", "runtime", "all"] },
            targetIDE: { type: "string" },
            maxTokens: { type: "integer" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              stackSlug: { type: "string" },
              generatedAt: { type: "string" },
              layers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    layerSlug: { type: "string" },
                    layerName: { type: "string" },
                    summarizedContent: { type: "string" },
                    ruleCount: { type: "integer" },
                    conflictCount: { type: "integer" },
                    generatedAt: { type: "string" },
                    cacheKey: { type: "string" },
                    cacheHit: { type: "boolean" },
                  },
                },
              },
            },
          },
          400: { type: "object", required: ["type", "title", "status"], properties: { type: { type: "string" }, title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } } },
          401: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
          503: { type: "object", required: ["type", "title", "status"], properties: { type: { type: "string" }, title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } } },
          404: { type: "object", required: ["type", "title", "status"], properties: { type: { type: "string" }, title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const adminToken = process.env.ADMIN_API_TOKEN;
      if (!adminToken || req.headers.authorization !== `Bearer ${adminToken}`) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      if (!req.body.stackSlug?.trim()) {
        return sendProblem(reply, 400, "missing-field", "Missing stackSlug", "stackSlug is required");
      }
      if (!Array.isArray(req.body.layerSlugs) || req.body.layerSlugs.length === 0) {
        return sendProblem(reply, 400, "missing-field", "Missing layerSlugs", "layerSlugs must be a non-empty array");
      }
      try {
        const result = await runSummarizer({
          stackSlug: req.body.stackSlug,
          layerSlugs: req.body.layerSlugs,
          ruleIds: req.body.ruleIds,
          ruleType: req.body.ruleType as "pattern" | "deps" | "config" | "runtime" | "all" | undefined,
          maxTokens: req.body.maxTokens,
        });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        if (msg === "summarizer_disabled")
          return sendProblem(reply, 503, "summarizer-disabled", "Summarizer disabled", "Set FEATURE_SUMMARIZER=true to enable");
        if (msg === "no_rules_found")
          return sendProblem(reply, 404, "no-rules", "No rules found", "No published rules found for the requested stack/layers combination");
        throw err;
      }
    }
  );

  app.post<{
    Body: { stackSlug: string; layerSlugs: string[]; ruleType?: string; maxTokens?: number };
  }>(
    "/v1/summarize/stream",
    {
      schema: {
        tags: ["Summarizer"],
        summary: "Stream per-layer guardrail summaries (chunked text/plain with layer markers)",
        body: {
          type: "object",
          required: ["stackSlug", "layerSlugs"],
          properties: {
            stackSlug: { type: "string" },
            layerSlugs: { type: "array", items: { type: "string" }, minItems: 1 },
            ruleType: { type: "string" },
            maxTokens: { type: "integer" },
          },
        },
      },
    },
    async (req, reply) => {
      reply.header("Content-Type", "text/plain; charset=utf-8");
      reply.header("Transfer-Encoding", "chunked");
      reply.header("X-Content-Type-Options", "nosniff");

      try {
        const gen = streamSummarizer({
          stackSlug: req.body.stackSlug,
          layerSlugs: req.body.layerSlugs,
          ruleType: req.body.ruleType as "pattern" | "deps" | "config" | "runtime" | "all" | undefined,
          maxTokens: req.body.maxTokens,
        });
        for await (const chunk of gen) {
          reply.raw.write(chunk);
        }
        reply.raw.end();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        reply.raw.write(msg === "summarizer_disabled" ? "[summarizer disabled]" : "[error]");
        reply.raw.end();
      }
    }
  );

  // ─── Guardrail generation endpoints ─────────────────────────────────────────

  app.post<{ Body: { stackSlug: string; layerSlug: string } }>(
    "/v1/guardrails/generate",
    {
      schema: {
        tags: ["Guardrails"],
        summary: "Generate or refresh a guardrail for a single (stack, layer) pair",
        body: {
          type: "object",
          required: ["stackSlug", "layerSlug"],
          properties: {
            stackSlug: { type: "string" },
            layerSlug: { type: "string" },
          },
        },
        response: {
          401: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const adminToken = process.env.ADMIN_API_TOKEN;
      if (!adminToken || req.headers.authorization !== `Bearer ${adminToken}`) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const result = await runSummarizerForLayer(req.body.stackSlug, req.body.layerSlug);
      return result;
    }
  );

  app.post<{ Body: { mode: "empty" | "stale" | "all" } }>(
    "/v1/guardrails/generate-bulk",
    {
      schema: {
        tags: ["Guardrails"],
        summary: "Bulk-generate guardrails for empty, stale, or all (stack, layer) pairs",
        body: {
          type: "object",
          required: ["mode"],
          properties: {
            mode: { type: "string", enum: ["empty", "stale", "all"] },
          },
        },
        response: {
          401: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const adminToken = process.env.ADMIN_API_TOKEN;
      if (!adminToken || req.headers.authorization !== `Bearer ${adminToken}`) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      return executeBulkGuardrailGeneration(req.body.mode);
    }
  );

  // ─── LLM config endpoint ─────────────────────────────────────────────────────

  app.get(
    "/v1/llm-config",
    {
      schema: {
        tags: ["System"],
        summary: "Current LLM provider, model, feature flags, and connectivity status",
      },
    },
    async (request, reply) => {
      // Admin-only endpoint — requires Bearer token matching ADMIN_API_TOKEN env var.
      const authHeader = request.headers.authorization;
      const adminToken = process.env.ADMIN_API_TOKEN;
      if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const provider = detectProvider();
      const model =
        process.env.FEATURE_CERTIFIED_SUMMARIES === "true" ? "claude-opus-4-7" : "claude-sonnet-4-6";

      let connectivity: "ok" | "error" = "error";
      let latencyMs: number | null = null;
      let connectivityError: string | null = null;

      try {
        const { createLLMClient } = await import("../services/summarizer/llm-client.js");
        const client = await createLLMClient();
        const start = Date.now();
        // NOTE: Consider caching the connectivity check result for 60s to avoid unnecessary API calls.
        await client.messages.create({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        });
        latencyMs = Date.now() - start;
        connectivity = "ok";
      } catch (e) {
        connectivityError = e instanceof Error ? e.message : String(e);
      }

      return {
        provider,
        model,
        bedrockRegion: process.env.AWS_REGION ?? null,
        ssoSession: provider === "bedrock" && !!process.env.AWS_SESSION_TOKEN,
        featureFlags: {
          summarizer: process.env.FEATURE_SUMMARIZER === "true",
          certifiedSummaries: process.env.FEATURE_CERTIFIED_SUMMARIES === "true",
        },
        connectivity,
        latencyMs,
        connectivityError,
      };
    }
  );
}
