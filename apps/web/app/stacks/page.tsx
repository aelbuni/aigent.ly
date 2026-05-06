import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { listStacksFromDb } from "@/lib/catalog-from-db";
import { getServerApiClient, tryInternal } from "@/lib/server-api";

import type { components } from "@aigently/api-client";

type Stack = components["schemas"]["Stack"];

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
      <div className="pointer-events-none fixed inset-0 dot-grid opacity-30" />
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
            <h2 className="mb-4 font-mono-label text-primary">Launch stacks</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {launch.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/stacks/${encodeURIComponent(s.slug)}`}
                    className="flex h-full flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-6 transition-all hover:border-primary hover:bg-surface-container-low"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low">
                        <MaterialSymbol name="layers" className="!text-2xl text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-on-surface">{s.name}</h3>
                        <p className="mt-1 font-mono-data text-on-surface-variant">{s.slug}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-outline-variant pt-4 font-mono-label text-primary">
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
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {comingSoon.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/stacks/${encodeURIComponent(s.slug)}`}
                      className="flex h-full flex-col justify-between rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 p-6 transition-all hover:border-primary/50"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low">
                          <MaterialSymbol name="hourglass_empty" className="!text-2xl text-on-surface-variant" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-on-surface">{s.name}</h3>
                          <p className="mt-1 font-mono-data text-on-surface-variant">{s.slug}</p>
                          <p className="mt-2 text-body-sm text-on-surface-variant">
                            Accepting CVE contributions —{" "}
                            <Link href="/contributing" className="text-primary underline-offset-2 hover:underline">
                              Contributing guide
                            </Link>
                            .
                          </p>
                        </div>
                      </div>
                      <div className="mt-6 border-t border-outline-variant pt-4 font-mono-label text-on-surface-variant">
                        Coming soon
                      </div>
                    </Link>
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
