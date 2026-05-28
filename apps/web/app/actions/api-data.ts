"use server";

import type { components } from "@aigently/api-client";

import {
  listIdesFromDb,
  listLayersWithStatsFromDb,
  listPolicyTemplatesFromDb,
  listRulesPreviewForStackFromDb,
  listStacksFromDb,
} from "@/lib/catalog-from-db";
import { getServerApiClient, tryInternal } from "@/lib/server-api";

type Stack = components["schemas"]["Stack"];
type Ide = components["schemas"]["Ide"];
type Rule = components["schemas"]["Rule"];
type PolicyTemplate = components["schemas"]["PolicyTemplate"];
type LayerForStack = { id: string; slug: string; name: string; description: string; concernStatement: string; iconName: string | null; colorToken: string | null; isSystem: boolean; isActive: boolean; sortOrder: number; ruleCount: number };

export async function listStacksAction(): Promise<Stack[]> {
  const client = await getServerApiClient();
  let items: Stack[] = [];
  if (client) {
    const res = await tryInternal(() => client.GET("/v1/stacks"), null);
    items = res?.data?.items ?? [];
  }
  if (items.length === 0) {
    try {
      items = await listStacksFromDb();
    } catch {
      items = [];
    }
  }
  return items;
}

export async function listIdesAction(): Promise<Ide[]> {
  const client = await getServerApiClient();
  let items: Ide[] = [];
  if (client) {
    const res = await tryInternal(() => client.GET("/v1/ides"), null);
    items = res?.data?.items ?? [];
  }
  if (items.length === 0) {
    try {
      items = await listIdesFromDb();
    } catch {
      items = [];
    }
  }
  return items;
}

export async function listPolicyTemplatesForStackAction(stackSlug: string): Promise<PolicyTemplate[]> {
  const client = await getServerApiClient();
  let items: PolicyTemplate[] = [];
  if (client) {
    const res = await tryInternal(
      () =>
        client.GET("/v1/stacks/{stackSlug}/policy-templates", {
          params: { path: { stackSlug } },
        }),
      null
    );
    items = res?.data?.items ?? [];
  }
  if (items.length === 0 && stackSlug) {
    try {
      items = await listPolicyTemplatesFromDb(stackSlug);
    } catch {
      items = [];
    }
  }
  return items;
}

export async function listLayersForStackAction(stackSlug: string): Promise<LayerForStack[]> {
  const client = await getServerApiClient();
  let items: LayerForStack[] = [];
  if (client) {
    const res = await tryInternal(
      () =>
        (client.GET as unknown as (path: string, opts: unknown) => Promise<{ data?: { items?: LayerForStack[] } }>)(
          "/v1/stacks/{stackSlug}/layers",
          { params: { path: { stackSlug } } }
        ),
      null
    );
    items = res?.data?.items ?? [];
  }
  if (items.length === 0 && stackSlug) {
    try {
      const all = await listLayersWithStatsFromDb();
      items = all.map((l) => ({
        id: l.id,
        slug: l.slug,
        name: l.name,
        description: l.description,
        concernStatement: l.concernStatement,
        iconName: l.iconName,
        colorToken: l.colorToken,
        isSystem: l.isSystem,
        isActive: l.isActive,
        sortOrder: l.sortOrder,
        ruleCount: l.ruleCount,
      }));
    } catch {
      items = [];
    }
  }
  return items;
}

export async function listRulesPreviewAction(
  stackSlug: string,
  limit: number
): Promise<Rule[]> {
  const client = await getServerApiClient();
  let items: Rule[] = [];
  if (client) {
    const res = await tryInternal(
      () =>
        client.GET("/v1/rules", {
          params: { query: { stackSlug, limit: Math.min(Math.max(limit, 1), 20) } },
        }),
      null
    );
    items = res?.data?.items ?? [];
  }
  if (items.length === 0 && stackSlug) {
    try {
      items = await listRulesPreviewForStackFromDb(stackSlug, limit);
    } catch {
      items = [];
    }
  }
  return items;
}

export async function postComposerExportAction(body: {
  stackSlug: string;
  ideSlug: string;
  ruleType?: "all" | "patterns" | "deps";
  mode?: "rule" | "skill";
}) {
  try {
    const { buildComposerMarkdownExport, buildSkillMdExport } = await import("@/lib/composer-export");
    const input = { stackSlug: body.stackSlug, ideSlug: body.ideSlug, ruleType: body.ruleType ?? "all" };
    const result =
      body.mode === "skill" && body.ideSlug === "claude-code"
        ? await buildSkillMdExport(input)
        : await buildComposerMarkdownExport(input);
    return { ok: true as const, data: result };
  } catch (err) {
    console.error("[postComposerExportAction]", err);
    return { ok: false as const, error: "Export failed." };
  }
}
