import Link from "next/link";
import { BrainCircuit } from "lucide-react";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { listStacksFromDb } from "@/lib/catalog-from-db";
import { getServerApiClient, tryInternal } from "@/lib/server-api";

import type { components } from "@aigently/api-client";

export const dynamic = "force-dynamic";

type Stack = components["schemas"]["Stack"];

function StackIcon({ slug }: { slug: string }) {
  if (slug === "ai-llm") {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-purple-400/40 bg-purple-500/10">
        <BrainCircuit className="h-6 w-6 text-purple-600 dark:text-purple-400" />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low">
      <MaterialSymbol name="layers" className="!text-2xl text-primary" />
    </div>
  );
}

function FamilyBadge({ slug }: { slug: string }) {
  if (slug === "ai-llm") {
    return (
      <span className="rounded border border-purple-400/40 bg-purple-500/10 px-2 py-0.5 font-mono-label text-[10px] text-purple-700 dark:text-purple-300">
        OWASP LLM
      </span>
    );
  }
  return null;
}

export default async function StacksIndexPage() {
  const client = await getServerApiClient();
  const res = client ? await tryInternal(() => client.GET("/v1/stacks"), null) : null;
  let items: Stack[] = res?.data?.items ?? [];
  if (items.length === 0) {
    try {
      items = await listStacksFromDb();
    } catch {
      items = [];
    }
  }

  const launch = items.filter((s) => s.catalogStatus === "launch");
  const comingSoon = items.filter((s) => s.catalogStatus === "coming_soon");

  return (
    <div className="relative mx-auto max-w-7xl px-gutter py-10">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" aria-hidden />
      <header className="relative mb-10">
        <h1 className="font-mono-label text-3xl font-bold tracking-widest text-on-surface">Stacks</h1>
        <p className="mt-2 max-w-2xl text-body-base text-on-surface-variant">
          Pick a launch stack for verified posture and rules. Other ecosystems unlock when we have enough CVE-linked
          evidence — see contributing.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="relative mt-8 rounded-xl border border-outline-variant bg-surface-container-low p-6 text-sm text-on-surface-variant">
          No stacks in the database. Ensure <code className="font-mono text-on-surface">DATABASE_URL</code> in{" "}
          <code className="font-mono text-on-surface">apps/web/.env</code> points at Postgres, run{" "}
          <code className="font-mono text-on-surface">npm run db:seed</code>, then reload. Optionally start the API and
          set <code className="font-mono text-on-surface">INTERNAL_API_URL</code> for export endpoints — stacks list
          reads from the DB when the API is down.
        </p>
      ) : (
        <div className="relative space-y-12">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-mono-label text-primary">Launch stacks</h2>
              <span className="rounded-full border border-primary/30 bg-primary-fixed-dim/20 px-2.5 py-0.5 font-mono-label text-xs text-primary">
                {launch.length}
              </span>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {launch.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/stacks/${encodeURIComponent(s.slug)}`}
                    className={`flex h-full flex-col justify-between rounded-xl border p-6 transition-all hover:bg-surface-container-low ${
                      s.slug === "ai-llm"
                        ? "border-purple-400/40 bg-purple-500/5 hover:border-purple-400/70"
                        : "border-outline-variant bg-surface-container-lowest hover:border-primary"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <StackIcon slug={s.slug} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-lg font-semibold text-on-surface">{s.name}</h3>
                          <FamilyBadge slug={s.slug} />
                        </div>
                        <p className="mt-1 font-mono-data text-on-surface-variant">{s.slug}</p>
                      </div>
                    </div>
                    <div className={`mt-6 flex items-center justify-between border-t pt-4 font-mono-label ${
                      s.slug === "ai-llm"
                        ? "border-purple-400/30 text-purple-600 dark:text-purple-400"
                        : "border-outline-variant text-primary"
                    }`}>
                      Security posture
                      <MaterialSymbol name="arrow_forward" className="text-outline" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {comingSoon.length > 0 ? (
            <section>
              <h2 className="mb-4 font-mono-label text-on-surface-variant">Coming soon</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {comingSoon.map((s) => (
                  <li key={s.slug}>
                    <div className="relative flex h-full flex-col justify-between rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 p-6 transition-all hover:border-primary/50">
                      <Link
                        href={`/stacks/${encodeURIComponent(s.slug)}`}
                        className="absolute inset-0 z-0 rounded-xl"
                        aria-label={`${s.name} stack (${s.slug})`}
                      />
                      <div className="pointer-events-none relative z-10 flex flex-1 flex-col justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low">
                            <MaterialSymbol name="hourglass_empty" className="!text-2xl text-on-surface-variant" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-on-surface">{s.name}</h3>
                            <p className="mt-1 font-mono-data text-on-surface-variant">{s.slug}</p>
                            <p className="mt-2 text-body-sm text-on-surface-variant">
                              Accepting CVE contributions —{" "}
                              <Link
                                href="/contributing"
                                className="pointer-events-auto relative z-20 text-primary underline-offset-2 hover:underline"
                              >
                                Contributing guide
                              </Link>
                              .
                            </p>
                          </div>
                        </div>
                        <div className="mt-6 border-t border-outline-variant pt-4 font-mono-label text-on-surface-variant">
                          Coming soon
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
