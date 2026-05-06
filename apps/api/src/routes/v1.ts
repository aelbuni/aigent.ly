import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import yaml from "js-yaml";

import { sendProblem } from "../lib/problem.js";
import { buildComposerMarkdownExport } from "../services/composerExport.js";
import { getIdeBySlug, listIdes } from "../repos/idesRepo.js";
import {
  getRuleBySlug,
  isRuleLayer,
  listRulesPaginated,
  type RuleLayerValue,
} from "../repos/rulesRepo.js";
import { listPolicyTemplatesForStack } from "../repos/policyTemplatesRepo.js";
import { getStackBySlug, listStacks } from "../repos/stacksRepo.js";
import { getStackOverview } from "../repos/stackOverviewRepo.js";
import { listSyncLogs } from "../repos/syncLogsRepo.js";
import { listThreats } from "../repos/threatsRepo.js";

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
        layers: row.layers,
        linkedThreats: row.linkedThreats,
      };
    }
  );

  app.post<{
    Body: { stackSlug: string; ideSlug: string; layers?: string[] };
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
      const rawLayers = req.body.layers ?? [];
      const layers = rawLayers.filter((x): x is RuleLayerValue => typeof x === "string" && isRuleLayer(x));
      if (rawLayers.length > 0 && layers.length !== rawLayers.length) {
        return sendProblem(
          reply,
          400,
          "invalid-layers",
          "Invalid layers",
          "Each layer must be one of: security, architecture, code_quality"
        );
      }
      return buildComposerMarkdownExport({
        stackSlug: stackSlug.trim(),
        ideSlug: ideSlug.trim(),
        layers,
      });
    }
  );
}
