"use server";

import type { components } from "@aigently/api-client";

import {
  listIdesFromDb,
  listPolicyTemplatesFromDb,
  listRulesPreviewForStackFromDb,
  listStacksFromDb,
} from "@/lib/catalog-from-db";
import { getServerApiClient, tryInternal } from "@/lib/server-api";

type Stack = components["schemas"]["Stack"];
type Ide = components["schemas"]["Ide"];
type Rule = components["schemas"]["Rule"];
type RuleLayer = components["schemas"]["RuleLayer"];
type PolicyTemplate = components["schemas"]["PolicyTemplate"];

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
  layers?: RuleLayer[];
}) {
  const client = await getServerApiClient();
  if (!client) {
    return { ok: false as const, error: "API not configured (INTERNAL_API_URL)." };
  }
  const res = await tryInternal(
    () =>
      client.POST("/v1/composer/export", {
        body: {
          stackSlug: body.stackSlug,
          ideSlug: body.ideSlug,
          layers: body.layers?.length ? body.layers : undefined,
        },
      }),
    null
  );
  if (!res?.data) {
    return { ok: false as const, error: "Export failed or API unreachable." };
  }
  return { ok: true as const, data: res.data };
}
