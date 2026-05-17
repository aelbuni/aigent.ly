import type { components } from "@aigently/api-client";

import { RulesDirectoryView } from "@/components/rules/RulesDirectoryView";
import {
  countCertifiedRulesWithThreatMap,
  listRulesDirectoryFromDb,
  listStacksFromDb,
  loadDirectoryFilterMeta,
} from "@/lib/catalog-from-db";
import { filterDirectoryCards } from "@/lib/rules-directory-filters";
import {
  enrichApiRule,
  type Rule,
  type RuleDirectoryCard,
  type RuleLayer,
} from "@/lib/rules-directory-showcase";
import { parseRulesDirectorySearch } from "@/lib/rules-directory-url";
import { getServerApiClient, tryInternal } from "@/lib/server-api";

type Stack = components["schemas"]["Stack"];

function launchStacksOnly(stacks: Stack[]): Stack[] {
  return stacks.filter((s) => s.catalogStatus === "launch");
}

async function fetchMergedRules(
  client: NonNullable<Awaited<ReturnType<typeof getServerApiClient>>>,
  stackSlugs: string[],
  stackRows: Stack[]
): Promise<{ rules: Rule[]; stacksByRuleId: Map<string, string[]> }> {
  const nameForSlug = (slug: string) => stackRows.find((s) => s.slug === slug)?.name ?? slug;
  const stacksByRuleId = new Map<string, string[]>();

  if (stackSlugs.length === 0) {
    const res = await tryInternal(
      () => client.GET("/v1/rules", { params: { query: { limit: 100 } } }),
      null
    );
    const items = res?.data?.items ?? [];
    return { rules: items, stacksByRuleId };
  }

  if (stackSlugs.length === 1) {
    const slug = stackSlugs[0]!;
    const res = await tryInternal(
      () => client.GET("/v1/rules", { params: { query: { limit: 100, stackSlug: slug } } }),
      null
    );
    const items = res?.data?.items ?? [];
    const label = nameForSlug(slug);
    for (const r of items) {
      stacksByRuleId.set(r.id, [label]);
    }
    return { rules: items, stacksByRuleId };
  }

  const byId = new Map<string, Rule>();
  for (const slug of stackSlugs) {
    const res = await tryInternal(
      () => client.GET("/v1/rules", { params: { query: { limit: 100, stackSlug: slug } } }),
      null
    );
    const label = nameForSlug(slug);
    for (const r of res?.data?.items ?? []) {
      byId.set(r.id, r);
      const cur = stacksByRuleId.get(r.id) ?? [];
      if (!cur.includes(label)) cur.push(label);
      stacksByRuleId.set(r.id, cur);
    }
  }
  return { rules: [...byId.values()], stacksByRuleId };
}

export default async function RulesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const filter = parseRulesDirectorySearch(sp);
  const client = await getServerApiClient();

  let stacks: Stack[] = [];
  if (client) {
    const stackRes = await tryInternal(() => client.GET("/v1/stacks"), null);
    stacks = stackRes?.data?.items ?? [];
  }
  if (stacks.length === 0) {
    try {
      stacks = await listStacksFromDb();
    } catch {
      stacks = [];
    }
  }
  const launchStacks = launchStacksOnly(stacks);

  let rawRules: Rule[] = [];
  let stacksByRuleId = new Map<string, string[]>();

  try {
    const fromDb = await listRulesDirectoryFromDb(filter.stacks);
    rawRules = fromDb.rules;
    stacksByRuleId = fromDb.stacksByRuleId;
  } catch {
    rawRules = [];
  }

  if (rawRules.length === 0 && client) {
    const merged = await fetchMergedRules(client, filter.stacks, stacks);
    rawRules = merged.rules;
    stacksByRuleId = merged.stacksByRuleId;
  }

  let layersByRuleId = new Map<string, RuleLayer[]>();
  let threatSignalsByRuleId = new Map<string, string>();
  try {
    const meta = await loadDirectoryFilterMeta(rawRules.map((r) => r.id));
    layersByRuleId = meta.layersByRuleId;
    threatSignalsByRuleId = meta.threatSignalsByRuleId;
  } catch {
    /* filters fall back to text heuristics */
  }

  const cards: RuleDirectoryCard[] = rawRules.map((r) =>
    enrichApiRule(r, stacksByRuleId.get(r.id) ?? [], {
      layers: layersByRuleId.get(r.id),
      threatSignals: threatSignalsByRuleId.get(r.id),
    })
  );
  const unfilteredCount = cards.length;
  const filtered = filterDirectoryCards(cards, {
    q: filter.q,
    types: filter.types,
    protect: filter.protect,
  });

  let catalogTotal = 6;
  try {
    catalogTotal = await countCertifiedRulesWithThreatMap();
  } catch {
    /* keep default */
  }

  return (
    <RulesDirectoryView
      stacks={launchStacks}
      cards={filtered}
      allCardsCount={unfilteredCount}
      filter={filter}
      showcaseMode={unfilteredCount === 0}
      catalogTotal={catalogTotal}
      clearHref="/rules"
    />
  );
}
