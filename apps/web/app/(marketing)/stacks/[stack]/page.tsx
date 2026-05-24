import type { components } from "@aigently/api-client";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import {
  getStackDetailFromDb,
  getStackOverviewFromDb,
  listLayersWithStatsFromDb,
} from "@/lib/catalog-from-db";
import { mergeStackOverviewFromApi, severityChipClass } from "@/lib/stack-overview-content";
import { getServerApiClient, tryInternal } from "@/lib/server-api";

type StackDetail = components["schemas"]["StackDetail"];
type StackOverviewResponse = components["schemas"]["StackOverviewResponse"];

function sidebarLinkClass(active: boolean) {
  const base =
    "flex items-center gap-3 px-3 py-2 font-mono-label text-on-surface-variant transition-all hover:bg-surface-container";
  if (active) {
    return `${base} border-l-2 border-primary bg-primary-fixed-dim/20 text-primary`;
  }
  return base;
}

export default async function StackOverviewPage({
  params,
}: {
  params: Promise<{ stack: string }>;
}) {
  const { stack: stackSlug } = await params;
  const client = await getServerApiClient();
  let detail: StackDetail | null = null;

  if (client) {
    const res = await tryInternal(
      () =>
        client.GET("/v1/stacks/{stackSlug}", {
          params: { path: { stackSlug } },
        }),
      null
    );
    if (res?.data) detail = res.data;
  }

  if (!detail) {
    try {
      detail = await getStackDetailFromDb(stackSlug);
    } catch {
      detail = null;
    }
  }

  if (!detail) {
    notFound();
  }

  // Always use DB for the overview — the API omits publishedAt on threat entries,
  // which we need to show dates on the risk cards.
  let apiOverview: StackOverviewResponse | null = null;
  try {
    apiOverview = await getStackOverviewFromDb(detail.slug);
  } catch {
    apiOverview = null;
  }

  const overview = mergeStackOverviewFromApi(detail.slug, apiOverview);
  const rulesHref = `/rules?stack=${encodeURIComponent(detail.slug)}`;

  let stackLayers: Awaited<ReturnType<typeof listLayersWithStatsFromDb>> = [];
  try {
    const allLayers = await listLayersWithStatsFromDb();
    stackLayers = allLayers.filter((l) => l.ruleCount > 0);
  } catch { /* non-critical */ }
  const criticalPad = String(overview.criticalCount).padStart(2, "0");
  const highPad = String(overview.highCount).padStart(2, "0");

  const comingSoon = detail.catalogStatus === "coming_soon";

  if (comingSoon) {
    return (
      <div className="relative mx-auto max-w-3xl px-gutter py-16">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" aria-hidden />
        <nav className="relative mb-6 font-mono-label text-on-surface-variant">
          <Link href="/stacks" className="text-primary hover:underline">
            Stacks
          </Link>
          <span className="mx-2">/</span>
          <span className="text-on-surface">{detail.name}</span>
        </nav>
        <h1 className="relative text-3xl font-bold text-on-surface">{detail.name}</h1>
        <p className="relative mt-4 text-body-base text-on-surface-variant">
          Coming soon — we are collecting additional verified CVEs with advisory links before publishing posture and
          rules for this stack. Contributions welcome.
        </p>
        <p className="relative mt-6">
          <Link href="/contributing" className="font-mono-label text-primary underline-offset-2 hover:underline">
            Contributing guide (CVE evidence)
          </Link>
        </p>
        <p className="relative mt-8">
          <Link href="/stacks" className="rounded-lg border border-outline px-4 py-2 text-sm hover:bg-surface-container">
            Back to stacks
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[260px] shrink-0 flex-col border-r border-outline-variant bg-surface-container-low py-4 lg:flex">
        <div className="mb-4 px-6 py-4">
          <h2 className="text-base font-black text-on-surface">Aigent.ly</h2>
          <p className="font-mono-label text-on-surface-variant">Security suite</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <Link href="/rules" className={sidebarLinkClass(false)}>
            <MaterialSymbol name="security" className="!text-lg" />
            Rules
          </Link>
          <Link href="/threats" className={sidebarLinkClass(false)}>
            <MaterialSymbol name="warning" className="!text-lg" />
            Threats
          </Link>
          <Link href="/stacks" className={sidebarLinkClass(true)}>
            <MaterialSymbol name="layers" className="!text-lg" />
            Stacks
          </Link>
        </nav>
      </aside>

      <main className="dot-grid flex-1 px-gutter py-6 lg:p-8">
        <nav
          className="mb-6 flex flex-wrap gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-3 lg:hidden"
          aria-label="Security suite"
        >
          <Link href="/rules" className={sidebarLinkClass(false)}>
            <MaterialSymbol name="security" className="!text-lg" />
            Rules
          </Link>
          <Link href="/threats" className={sidebarLinkClass(false)}>
            <MaterialSymbol name="warning" className="!text-lg" />
            Threats
          </Link>
          <Link href="/stacks" className={sidebarLinkClass(true)}>
            <MaterialSymbol name="layers" className="!text-lg" />
            Stacks
          </Link>
        </nav>
        <nav className="mb-4 flex flex-wrap items-center gap-2 font-mono-label text-on-surface-variant">
          <Link href="/stacks" className="hover:text-primary">
            Stacks
          </Link>
          <MaterialSymbol name="chevron_right" className="!text-sm text-outline" />
          <span className="font-bold text-primary">{detail.name}</span>
        </nav>

        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex items-start gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest p-2">
              {detail.slug === "nextjs" ? (
                <Image src="/next.svg" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              ) : detail.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote logos from API
                <img src={detail.logoPath} alt="" className="max-h-10 max-w-10 object-contain" />
              ) : (
                <MaterialSymbol name="layers" className="text-3xl text-primary" />
              )}
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <h1 className="text-h1 font-h1 text-on-surface">{detail.name} security posture</h1>
                <div className="flex items-center gap-2 rounded border border-tertiary bg-tertiary-container px-3 py-1 font-mono-data text-xl text-on-tertiary-container">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-on-tertiary-container" />
                  {overview.scoreLabel}
                </div>
              </div>
              <p className="max-w-2xl text-body-base text-on-surface-variant">{overview.intro}</p>
              {detail.ruleCount != null && detail.ruleCount > 0 ? (
                <p className="mt-2 text-body-sm text-on-surface-variant">
                  {detail.ruleCount} linked {detail.ruleCount === 1 ? "rule" : "rules"} in the directory.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex h-fit flex-wrap gap-3">
            <Link
              href={rulesHref}
              className="rounded-lg border border-outline px-6 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
            >
              Browse rules
            </Link>
            <Link
              href={`/composer?stack=${detail.slug}`}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-on-primary transition-opacity hover:opacity-90"
            >
              Get guardrails →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h3 className="font-mono-label text-on-surface-variant">Top risks for this stack</h3>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1 font-mono-label text-error">
                  <span className="h-1.5 w-1.5 rounded-full bg-error" />
                  {criticalPad} critical
                </span>
                <span className="flex items-center gap-1 font-mono-label text-tertiary-container">
                  <span className="h-1.5 w-1.5 rounded-full bg-tertiary-container" />
                  {highPad} high
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {overview.risks.map((risk) => (
                <Link
                  key={risk.title}
                  href={risk.threatHref ?? `/threats?q=${encodeURIComponent(risk.title)}`}
                  className={`risk-card-hover group flex gap-4 border border-outline-variant border-l-4 bg-surface-container-lowest p-4 transition-all ${risk.borderAccent}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-data text-on-surface">{risk.title}</span>
                      <span className={`shrink-0 rounded px-2 py-0.5 font-mono-label ${severityChipClass(risk.severity)}`}>
                        {risk.severity}
                      </span>
                    </div>
                    {risk.publishedAt && (
                      <p className="mb-1 font-mono-label text-xs text-on-surface-variant/60">
                        {new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(risk.publishedAt))}
                      </p>
                    )}
                    <p className="text-body-sm text-on-surface-variant">{risk.description}</p>
                  </div>
                  <MaterialSymbol name="open_in_new" className="shrink-0 text-outline group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>

          <div className="col-span-12 space-y-8 lg:col-span-5">
            {overview.coverage.length > 0 ? (
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
                <h3 className="mb-6 text-h3 font-h3 text-on-surface">Automated coverage</h3>
                <div className="space-y-6">
                  {overview.coverage.map((row) => (
                    <div key={row.label}>
                      <div className="mb-2 flex justify-between font-mono-label">
                        <span className="text-on-surface">{row.label}</span>
                        <span className="text-on-surface">{row.pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                        <div className={`h-full ${row.barClass}`} style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {overview.framework.length > 0 ? (
              <div className="rounded-xl border border-outline bg-inverse-surface p-6 text-inverse-on-surface">
                <h3 className="mb-6 font-mono-label text-inverse-primary">What the framework handles</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 border-b border-inverse-on-surface/20 pb-2 font-mono-label opacity-60">
                    <span>Feature</span>
                    <span>Status</span>
                  </div>
                  {overview.framework.map((row) => (
                    <div key={row.feature} className="grid grid-cols-2 items-center gap-2 py-1">
                      <span className="text-body-sm">{row.feature}</span>
                      <span
                        className={`flex items-center gap-2 font-mono-data ${row.builtIn ? "text-inverse-primary" : "text-inverse-on-surface/80"}`}
                      >
                        <MaterialSymbol
                          name={row.builtIn ? "check_circle" : "settings"}
                          className="!text-base"
                        />
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {stackLayers.length > 0 && (
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
                <h3 className="mb-4 font-mono-label text-primary">Coverage by protection layer</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant text-left font-mono-label text-xs text-on-surface-variant">
                        <th className="pb-2 pr-4">Layer</th>
                        <th className="pb-2 pr-4">Rules</th>
                        <th className="pb-2">Explore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stackLayers.map((l) => (
                        <tr key={l.slug} className="border-b border-outline-variant/50 last:border-0">
                          <td className="py-2 pr-4">
                            <Link
                              href={`/layers/${l.slug}`}
                              className="text-on-surface hover:text-primary hover:underline"
                            >
                              {l.name}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 font-mono-data text-on-surface-variant">
                            {l.ruleCount}
                          </td>
                          <td className="py-2">
                            <Link
                              href={`/explore?stack=${detail.slug}&layer=${l.slug}`}
                              className="font-mono-label text-xs text-primary hover:underline"
                            >
                              Explore →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
