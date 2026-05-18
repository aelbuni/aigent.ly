import type { components } from "@aigently/api-client";
import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import type { RuleDirectoryCard } from "@/lib/rules-directory-showcase";
import {
  buildRulesDirectoryHref,
  setClassification,
  toggleListValue,
  toggleStackInSearch,
  type RulesDirectorySearch,
} from "@/lib/rules-directory-url";

type Stack = components["schemas"]["Stack"];

const PROTECT_OPTS = [
  { id: "a03", label: "A03:2021 Injection" },
  { id: "llm01", label: "LLM01 Prompt injection" },
  { id: "leak", label: "Sensitive data leak" },
] as const;

function RulesFilterNav({
  stacks,
  filter,
  classificationCounts,
}: {
  stacks: Stack[];
  filter: RulesDirectorySearch;
  classificationCounts: { all: number; patterns: number; deps: number };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 font-mono-label text-on-surface-variant">Tech stack</h4>
        <nav className="flex flex-col gap-2">
          <Link
            href={buildRulesDirectoryHref(filter, { stacks: [] })}
            className={`flex items-center gap-2 rounded px-2 py-1.5 font-body-sm ${
              filter.stacks.length === 0 ? "bg-surface-container font-medium text-on-surface" : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${filter.stacks.length === 0 ? "border-primary bg-primary/10" : "border-outline"}`}
            >
              {filter.stacks.length === 0 ? <span className="h-2 w-2 rounded-sm bg-primary" /> : null}
            </span>
            All stacks
          </Link>
          {stacks.length === 0 ? (
            <p className="font-body-sm text-on-surface-variant">Run API + seed to filter by stack.</p>
          ) : (
            stacks.map((s) => {
              const active = filter.stacks.includes(s.slug);
              return (
                <Link
                  key={s.slug}
                  href={toggleStackInSearch(filter, s.slug)}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 font-body-sm ${
                    active ? "bg-surface-container font-medium text-on-surface" : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? "border-primary bg-primary/10" : "border-outline"}`}
                  >
                    {active ? <span className="h-2 w-2 rounded-sm bg-primary" /> : null}
                  </span>
                  {s.name}
                </Link>
              );
            })
          )}
        </nav>
      </div>
      <div>
        <h4 className="mb-3 font-mono-label text-on-surface-variant">Rule classification</h4>
        <nav className="flex flex-col gap-2">
          <Link
            href={setClassification(filter, "all")}
            className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 font-body-sm ${
              filter.classification === "all"
                ? "bg-surface-container font-medium text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <span className="flex items-center gap-2">
              <MaterialSymbol name="grid_view" className="!text-base text-on-surface-variant" />
              All rules
            </span>
            <span className="rounded bg-surface-container px-2 py-0.5 font-mono-label text-[10px] text-on-surface-variant">
              {classificationCounts.all}
            </span>
          </Link>
          <Link
            href={setClassification(filter, "patterns")}
            className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 font-body-sm ${
              filter.classification === "patterns"
                ? "bg-surface-container font-medium text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <span className="flex items-center gap-2">
              <MaterialSymbol name="verified_user" className="!text-base text-primary" />
              Pattern rules
            </span>
            <span className="rounded bg-surface-container px-2 py-0.5 font-mono-label text-[10px] text-on-surface-variant">
              {classificationCounts.patterns}
            </span>
          </Link>
          <Link
            href={setClassification(filter, "deps")}
            className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 font-body-sm ${
              filter.classification === "deps"
                ? "bg-surface-container font-medium text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <span className="flex items-center gap-2">
              <MaterialSymbol name="warning" className="!text-base text-tertiary-container" />
              Deps rules
            </span>
            <span className="rounded bg-surface-container px-2 py-0.5 font-mono-label text-[10px] text-on-surface-variant">
              {classificationCounts.deps}
            </span>
          </Link>
        </nav>
      </div>
      <div>
        <h4 className="mb-3 font-mono-label text-on-surface-variant">Protects against</h4>
        <nav className="flex flex-col gap-2">
          {PROTECT_OPTS.map((p) => {
            const active = filter.protect.includes(p.id);
            return (
              <Link
                key={p.id}
                href={toggleListValue(filter, "protect", p.id)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 font-body-sm ${
                  active ? "bg-surface-container font-medium text-on-surface" : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? "border-primary bg-primary/10" : "border-outline"}`}
                >
                  {active ? <span className="h-2 w-2 rounded-sm bg-primary" /> : null}
                </span>
                {p.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function StarRow({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5 text-tertiary-container" aria-label={`${n} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <MaterialSymbol
          key={i}
          name="star"
          fill={i < n}
          className={`!text-lg ${i < n ? "text-tertiary-container" : "text-outline opacity-35"}`}
        />
      ))}
    </div>
  );
}

export function RulesDirectoryView({
  stacks,
  cards,
  allCardsCount,
  classificationCounts,
  filter,
  showcaseMode,
  catalogTotal,
  clearHref,
}: {
  stacks: Stack[];
  cards: RuleDirectoryCard[];
  allCardsCount: number;
  classificationCounts: { all: number; patterns: number; deps: number };
  filter: RulesDirectorySearch;
  showcaseMode: boolean;
  catalogTotal: number;
  clearHref: string;
}) {
  const hasActiveFilters =
    filter.stacks.length > 0 ||
    filter.types.length > 0 ||
    filter.classification !== "all" ||
    filter.protect.length > 0 ||
    filter.q.length > 0;

  const chipItems: { label: string; href: string }[] = [];
  for (const slug of filter.stacks) {
    const name = stacks.find((s) => s.slug === slug)?.name ?? slug;
    chipItems.push({
      label: name,
      href: toggleStackInSearch(filter, slug),
    });
  }
  for (const t of filter.types) {
    chipItems.push({ label: t, href: toggleListValue(filter, "types", t) });
  }
  if (filter.classification !== "all") {
    chipItems.push({
      label: filter.classification === "patterns" ? "Pattern rules" : "Deps rules",
      href: setClassification(filter, "all"),
    });
  }
  for (const p of filter.protect) {
    const label = PROTECT_OPTS.find((x) => x.id === p)?.label ?? p;
    chipItems.push({ label, href: toggleListValue(filter, "protect", p) });
  }
  if (filter.q) {
    chipItems.push({
      label: `“${filter.q}”`,
      href: buildRulesDirectoryHref(filter, { q: "" }),
    });
  }

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)]">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" aria-hidden />

      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[260px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-outline-variant bg-surface-container-low py-4 lg:flex">
        <div className="px-6 py-4">
          <p className="font-mono-label text-on-surface-variant">Filters</p>
        </div>
        <div className="px-6">
          <RulesFilterNav stacks={stacks} filter={filter} classificationCounts={classificationCounts} />
        </div>
      </aside>

      <div className="relative flex-1 px-gutter py-8">
        <details className="group mb-8 rounded-xl border border-outline-variant bg-surface-container-low lg:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 font-mono-label text-on-surface [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Filters
              <MaterialSymbol name="expand_more" className="!text-xl text-on-surface-variant transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-outline-variant px-4 pb-4 pt-2">
            <RulesFilterNav stacks={stacks} filter={filter} classificationCounts={classificationCounts} />
          </div>
        </details>
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-mono-label text-2xl font-bold tracking-widest text-on-surface md:text-3xl">
              Rules directory
            </h1>
            <p className="mt-2 font-mono-data text-primary">
              {catalogTotal} curated guardrails available
            </p>
            <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">
              Showing {cards.length} of {allCardsCount} loaded for your filters.
              {showcaseMode ? " Connect the API and seed the database to browse live rule pages." : null}
            </p>
          </div>
          <form action="/rules" method="get" className="flex w-full max-w-md items-center gap-2 lg:w-auto">
            {filter.stacks.length > 0 ? <input type="hidden" name="stacks" value={filter.stacks.join(",")} /> : null}
            {filter.types.length > 0 ? <input type="hidden" name="types" value={filter.types.join(",")} /> : null}
            {filter.classification !== "all" ? <input type="hidden" name="class" value={filter.classification} /> : null}
            {filter.protect.length > 0 ? <input type="hidden" name="protect" value={filter.protect.join(",")} /> : null}
            <div className="relative flex-1">
              <MaterialSymbol
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 !text-xl -translate-y-1/2 text-on-surface-variant"
              />
              <input
                key={`${filter.stacks.join(",")}|${filter.types.join(",")}|${filter.protect.join(",")}|${filter.q}`}
                name="q"
                defaultValue={filter.q}
                placeholder="Search rules…"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2.5 pl-11 pr-3 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              Search
            </button>
          </form>
        </header>

        <div className="mb-8 flex gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MaterialSymbol name="lightbulb" className="!text-xl" />
          </div>
          <div>
            <h3 className="font-mono-label text-on-surface">Rules type guidance</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">Pattern rules</span> are always safe: they guide code
              structure (ALWAYS/NEVER) without changing dependencies. <span className="font-semibold text-on-surface">Deps rules</span>{" "}
              only WARN/CONFIRM and should never auto-edit dependency files.
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link
              href="/rules/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-mono-label text-on-primary"
            >
              <MaterialSymbol name="add" className="!text-lg" />
              New custom rule
            </Link>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            {chipItems.map((c) => (
              <Link
                key={`${c.label}-${c.href}`}
                href={c.href}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-fixed-dim/20 px-3 py-1 font-mono-data text-sm text-primary"
              >
                {c.label}
                <MaterialSymbol name="close" className="!text-base" />
              </Link>
            ))}
            <Link href={clearHref} className="font-mono-label text-on-surface-variant hover:text-primary">
              Clear all
            </Link>
          </div>
        ) : null}

        {cards.length === 0 ? (
          <p className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-sm text-on-surface-variant">
            No rules match these filters.{" "}
            <Link href={clearHref} className="text-primary hover:underline">
              Clear filters
            </Link>
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((r) => (
              <article
                key={r.id}
                className="flex flex-col border border-outline-variant bg-surface-container-lowest p-5 transition-shadow hover:border-primary/40 hover:shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-outline-variant bg-surface-container-low">
                    <MaterialSymbol name="gavel" className="text-primary" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StarRow n={r.stars} />
                    {r.certified ? (
                      <span className="flex items-center gap-1 rounded bg-primary-fixed px-2 py-0.5 font-mono-label text-on-primary-fixed">
                        <MaterialSymbol name="verified" className="!text-sm" />
                        Certified
                      </span>
                    ) : null}
                  </div>
                </div>
                <h2 className="text-lg font-semibold leading-snug text-on-surface">{r.name}</h2>
                <p className="mt-2 line-clamp-3 text-body-sm text-on-surface-variant">{r.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.tags.map((tag) => (
                    <span key={tag} className="rounded border border-outline-variant bg-surface-container px-2 py-0.5 font-mono-label text-on-surface-variant">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-outline-variant pt-4">
                  <div className="flex gap-6 font-mono-data text-on-surface-variant">
                    {r.lineCount != null ? (
                      <div>
                        <div className="font-mono-label text-[10px] text-on-surface-variant">Lines</div>
                        <div className="text-on-surface">{r.lineCount}</div>
                      </div>
                    ) : null}
                    <div>
                      <div className="font-mono-label text-[10px] text-on-surface-variant">Uses</div>
                      <div className="text-on-surface">{r.usesLabel}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="rounded p-2 text-on-surface-variant hover:bg-surface-container" aria-label="Copy slug">
                      <MaterialSymbol name="content_copy" className="!text-xl" />
                    </button>
                    {r.hasDetailPage ? (
                      <Link
                        href={`/rules/${encodeURIComponent(r.slug)}`}
                        className="rounded-lg bg-primary px-4 py-2 font-mono-label text-on-primary"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="rounded-lg border border-outline-variant px-4 py-2 font-mono-label text-on-surface-variant">
                        Preview
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
            <Link
              href="/rules/new"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <MaterialSymbol name="add_circle" className="!text-3xl" />
              <span className="font-mono-label text-on-surface">New custom rule</span>
              <span className="text-body-sm">Define project constraints</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
