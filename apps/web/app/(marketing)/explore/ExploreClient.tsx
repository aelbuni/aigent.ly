"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { filterDirectoryCards } from "@/lib/rules-directory-filters";
import type { LayerWithStats } from "@/lib/catalog-from-db";
import type { RuleDirectoryCard } from "@/lib/rules-directory-showcase";

type Stack = { slug: string; name: string; catalogStatus: string };

const RULE_TYPES = [
  { value: "pattern", label: "Patterns" },
  { value: "deps", label: "Dependencies" },
  { value: "config", label: "Config" },
  { value: "runtime", label: "Runtime" },
] as const;

function getLayerSlug(l: unknown): string {
  if (typeof l === "string") return l;
  return (l as { slug: string }).slug ?? "";
}

function getLayerName(l: unknown): string {
  if (typeof l === "string") return l.replaceAll("_", " ");
  return (l as { name: string }).name ?? "";
}

function StrengthBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

type Props = {
  allCards: RuleDirectoryCard[];
  stacks: Stack[];
  layers: LayerWithStats[];
  stats: { totalRules: number; layersCovered: number; stacksCovered: number; avgStrength: number };
};

export function ExploreClient({ allCards, stacks, layers, stats }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeLayer = searchParams.get("layer") ?? "";
  const activeType = searchParams.get("type") ?? "";
  const activeStack = searchParams.get("stack") ?? "";
  const q = searchParams.get("q") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`/explore?${params.toString()}`, { scroll: false }));
  }

  // Map stack slugs (from URL params) to partial name hints for matching against card.stacks display names
  const STACK_SLUG_TO_HINT: Record<string, string> = {
    nextjs: "next",
    express: "express",
    fastapi: "fastapi",
    nestjs: "nestjs",
    nuxt: "nuxt",
    "react-spa": "react",
    django: "django",
    rails: "rails",
    go: "go",
    ios: "ios",
    android: "android",
  };

  const filteredCards = useMemo(() => {
    let cards = allCards;
    if (activeStack) {
      const hint = STACK_SLUG_TO_HINT[activeStack] ?? activeStack;
      cards = cards.filter((c) =>
        c.stacks.some((s) => s.toLowerCase().includes(hint.toLowerCase()))
      );
    }
    return filterDirectoryCards(cards, {
      q,
      types: [],
      classification: activeType === "deps" ? "deps" : activeType === "pattern" ? "patterns" : "all",
      protect: [],
      layers: activeLayer ? [activeLayer] : [],
    });
  }, [allCards, activeLayer, activeType, activeStack, q]);

  return (
    <main className="mx-auto max-w-7xl px-gutter py-10">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Explore Guardrails</h1>
        <p className="mt-2 text-on-surface-variant">
          Filter by layer, type, and stack. All {stats.totalRules} rules, instant response.
        </p>
      </header>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total rules", value: stats.totalRules },
          { label: "Avg strength", value: `${stats.avgStrength}%` },
          { label: "Layers covered", value: stats.layersCovered },
          { label: "Stacks covered", value: stats.stacksCovered },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
          >
            <div className="text-2xl font-bold text-on-surface">{s.value}</div>
            <div className="mt-0.5 text-xs text-on-surface-variant">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-6 space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
        {/* Search */}
        <div className="relative">
          <MaterialSymbol
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 !text-base text-on-surface-variant"
          />
          <input
            type="text"
            placeholder="Search rules, CVEs, stacks…"
            defaultValue={q}
            onChange={(e) => setParam("q", e.target.value)}
            className="w-full rounded-md border border-outline-variant bg-surface-container py-2 pl-9 pr-4 text-sm text-on-surface placeholder-on-surface-variant focus:border-primary focus:outline-none"
          />
        </div>

        {/* Layer pills */}
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-on-surface-variant">Layer:</span>
          <button
            onClick={() => setParam("layer", "")}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              !activeLayer
                ? "bg-primary text-white"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            All
          </button>
          {layers.map((l) => (
            <button
              key={l.slug}
              onClick={() => setParam("layer", activeLayer === l.slug ? "" : l.slug)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                activeLayer === l.slug
                  ? "bg-primary text-white"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              {l.name}
              {l.ruleCount > 0 && (
                <span className="ml-1.5 opacity-70">×{l.ruleCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Type + Stack row */}
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs text-on-surface-variant">Type:</span>
            <button
              onClick={() => setParam("type", "")}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                !activeType
                  ? "bg-primary text-white"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              All
            </button>
            {RULE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setParam("type", activeType === t.value ? "" : t.value)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  activeType === t.value
                    ? "bg-primary text-white"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs text-on-surface-variant">Stack:</span>
            <button
              onClick={() => setParam("stack", "")}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                !activeStack
                  ? "bg-primary text-white"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              All
            </button>
            {stacks.map((s) => (
              <button
                key={s.slug}
                onClick={() => setParam("stack", activeStack === s.slug ? "" : s.slug)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  activeStack === s.slug
                    ? "bg-primary text-white"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-on-surface-variant">
        {filteredCards.length} rule{filteredCards.length !== 1 ? "s" : ""}
        {(activeLayer || activeType || activeStack || q) && (
          <button
            onClick={() => startTransition(() => router.replace("/explore", { scroll: false }))}
            className="ml-3 text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Card grid */}
      {filteredCards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant p-12 text-center text-on-surface-variant">
          No rules match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {filteredCards.map((card) => (
            <div key={card.id}>
              <button
                onClick={() => setExpandedId(expandedId === card.id ? null : card.id)}
                className={`w-full rounded-lg border text-left transition-colors ${
                  expandedId === card.id
                    ? "border-primary bg-surface-container-low"
                    : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low hover:border-outline"
                }`}
              >
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-semibold text-on-surface leading-snug">
                      {card.name}
                    </span>
                    {card.certified && (
                      <MaterialSymbol name="verified" className="!text-sm shrink-0 text-primary" />
                    )}
                  </div>

                  {/* Layer badges */}
                  {card.layers && card.layers.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {card.layers.slice(0, 2).map((l) => (
                        <span
                          key={getLayerSlug(l)}
                          className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono-label text-xs text-primary"
                        >
                          {getLayerName(l)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Strength score */}
                  {(card as { strengthScore?: number }).strengthScore !== undefined && (
                    <div className="mt-2">
                      <StrengthBar score={(card as { strengthScore?: number }).strengthScore ?? 0} />
                      <div className="mt-1 text-right font-mono-data text-xs text-on-surface-variant">
                        {(card as { strengthScore?: number }).strengthScore ?? 0}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {card.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-sm border border-outline-variant px-1.5 py-0.5 font-mono-label text-xs text-on-surface-variant"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>

              {/* Inline expand panel */}
              {expandedId === card.id && (
                <div className="mt-1 rounded-lg border border-primary/30 bg-surface-container-low p-4">
                  <p className="mb-3 text-sm text-on-surface-variant">{card.description}</p>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                    <span>{card.stacks.join(", ")}</span>
                    {card.lineCount && (
                      <>
                        <span className="text-outline-variant">·</span>
                        <span>{card.lineCount} lines</span>
                      </>
                    )}
                    <span className="text-outline-variant">·</span>
                    <span>{card.usesLabel} uses</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/rules/${card.slug}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      View rule →
                    </Link>
                    <button
                      disabled
                      title="Summarizer coming soon"
                      className="rounded-md border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant opacity-50 cursor-not-allowed"
                    >
                      Generate summary
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
