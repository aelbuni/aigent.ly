import type { Metadata } from "next";

import {
  listRulesDirectoryFromDb,
  listStacksFromDb,
  loadDirectoryFilterMeta,
} from "@/lib/catalog-from-db";
import { enrichApiRule, type RuleDirectoryCard, type RuleLayer } from "@/lib/rules-directory-showcase";
import { ExploreClient } from "./ExploreClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore Guardrails",
  description:
    "Browse and filter AI coding guardrails by rule type and stack. See coverage depth at a glance.",
};

export default async function ExplorePage() {
  const stackRows = await listStacksFromDb().catch(() => []);
  const launchStacks = stackRows.filter((s) => s.catalogStatus === "launch");

  let allCards: RuleDirectoryCard[] = [];
  try {
    const { rules, stacksByRuleId } = await listRulesDirectoryFromDb([]);
    let layersByRuleId = new Map<string, RuleLayer[]>();
    let threatSignalsByRuleId = new Map<string, string>();
    try {
      const meta = await loadDirectoryFilterMeta(rules.map((r) => r.id));
      layersByRuleId = meta.layersByRuleId;
      threatSignalsByRuleId = meta.threatSignalsByRuleId;
    } catch { /* fallback to text heuristics */ }

    allCards = rules.map((r) =>
      enrichApiRule(r, stacksByRuleId.get(r.id) ?? [], {
        layers: layersByRuleId.get(r.id),
        threatSignals: threatSignalsByRuleId.get(r.id),
        strengthScore: (r as { strengthScore?: number }).strengthScore,
      })
    );
  } catch { /* empty catalog */ }

  const stats = {
    totalRules: allCards.length,
    stacksCovered: launchStacks.length,
    avgStrength: allCards.length
      ? Math.round(
          allCards.reduce((sum, c) => sum + ((c as { strengthScore?: number }).strengthScore ?? 0), 0) /
            allCards.length
        )
      : 0,
  };

  return (
    <ExploreClient
      allCards={allCards}
      stacks={launchStacks}
      stats={stats}
    />
  );
}
