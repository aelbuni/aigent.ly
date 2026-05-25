import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import {
  countDistinctThreatsOnLaunchStacks,
  getLastCatalogSyncFinishedAt,
  getLaunchStackThreatSeverityCounts,
  getRuleCountByThreatPublicId,
  listThreatsPagedFromDb,
  type ThreatFeedPage,
} from "@/lib/catalog-from-db";
import { toFeedItem, type ThreatFeedItem } from "@/lib/threats-showcase";

export const dynamic = "force-dynamic";

/** Strip markdown syntax from advisory descriptions so they render as plain text.
 *  GHSA/NVD descriptions often contain ### headings, [link](url), and ** bold. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")           // ## headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")    // ![img](url) → remove
    .replace(/\*\*([^*]+)\*\*/g, "$1")       // **bold** → text
    .replace(/\*([^*]+)\*/g, "$1")           // *italic* → text
    .replace(/`([^`]+)`/g, "$1")             // `code` → text
    .replace(/^\s*[-*+]\s+/gm, "")          // bullet points
    .replace(/\n{3,}/g, "\n\n")             // collapse excess newlines
    .trim();
}

function severityStyle(sev: string | null | undefined) {
  switch (sev) {
    case "critical":
      return "text-error border-error bg-error-container/30";
    case "high":
      return "text-tertiary-container border-tertiary bg-tertiary-container/15";
    case "medium":
      return "text-primary border-primary bg-primary-fixed-dim/20";
    case "low":
      return "text-primary border-primary/60";
    default:
      return "text-on-surface-variant border-outline bg-surface-container";
  }
}

type SeverityMode = "critical_high" | "all" | "single";

const THREAT_FEED_PAGE_SIZE = 15;

function firstString(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : v[0] ?? "";
}

function parseThreatSearch(sp: Record<string, string | string[] | undefined> | undefined) {
  const raw = firstString(sp?.severity);
  let mode: SeverityMode = "critical_high";
  let single: "" | "critical" | "high" | "medium" | "low" = "";
  if (raw === "all") mode = "all";
  else if (raw === "critical" || raw === "high" || raw === "medium" || raw === "low") {
    mode = "single";
    single = raw;
  }
  const q = firstString(sp?.q).trim();
  const pageRaw = parseInt(firstString(sp?.page), 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  return { mode, single, q, page };
}

function buildThreatsHref(patch: {
  mode?: SeverityMode;
  single?: string;
  q?: string;
  page?: number;
}) {
  const p = new URLSearchParams();
  if (patch.mode === "all") p.set("severity", "all");
  else if (patch.mode === "critical_high") {
    /* default — omit param */
  } else if (patch.single) p.set("severity", patch.single);
  if (patch.q) p.set("q", patch.q);
  if (patch.page !== undefined && patch.page > 1) p.set("page", String(patch.page));
  const s = p.toString();
  return s ? `/threats?${s}` : "/threats";
}

function severityFilterButtonClass(s: "critical" | "high" | "medium" | "all", active: boolean) {
  const base =
    "inline-flex items-center gap-2 rounded border px-3 py-2 font-mono-label uppercase tracking-wide transition-colors";
  if (!active) {
    return `${base} border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-outline hover:bg-surface-container`;
  }
  if (s === "critical") return `${base} border-error bg-error-container/35 text-error`;
  if (s === "high") return `${base} border-tertiary-container bg-tertiary-container/15 text-tertiary-container`;
  if (s === "all") return `${base} border-outline bg-surface-container text-on-surface`;
  return `${base} border-primary bg-primary-fixed-dim/25 text-primary`;
}

function SeveritySwatch({ s }: { s: "critical" | "high" | "medium" | "all" }) {
  if (s === "critical") return <span className="h-2 w-2 shrink-0 rounded-sm bg-error" aria-hidden />;
  if (s === "high") return <span className="h-2 w-2 shrink-0 rounded-sm bg-tertiary-container" aria-hidden />;
  if (s === "all") return <span className="h-2 w-2 shrink-0 rounded-sm bg-outline" aria-hidden />;
  return <span className="h-2 w-2 shrink-0 rounded-sm bg-primary" aria-hidden />;
}

function feedCardBorderClass(sev: string | null | undefined) {
  switch (sev) {
    case "critical":
      return "border-l-4 border-l-error";
    case "high":
      return "border-l-4 border-l-tertiary-container";
    case "medium":
      return "border-l-4 border-l-primary";
    default:
      return "border-l-4 border-l-outline";
  }
}


export default async function ThreatsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const { mode, single, q, page: requestedPage } = parseThreatSearch(sp);

  // Map severity mode → DB severities array
  const severities =
    mode === "critical_high" ? ["critical", "high"] :
    mode === "single" && single ? [single] :
    []; // empty = all

  let dbPage: ThreatFeedPage = { items: [], total: 0 };
  let matrixRows: Awaited<ReturnType<typeof getLaunchStackThreatSeverityCounts>> = [];
  let verifiedCount = 0;
  let lastSync: string | null = null;
  let protectByThreat = new Map<string, number>();
  try {
    // All DB calls in parallel — paginated query is the fast path
    [dbPage, matrixRows, verifiedCount, lastSync, protectByThreat] = await Promise.all([
      listThreatsPagedFromDb({ severities, q, page: requestedPage, perPage: THREAT_FEED_PAGE_SIZE }),
      getLaunchStackThreatSeverityCounts(),
      countDistinctThreatsOnLaunchStacks(),
      getLastCatalogSyncFinishedAt(),
      getRuleCountByThreatPublicId(),
    ]);
  } catch {
    /* DB unavailable */
  }

  const paginatedFeed: ThreatFeedItem[] = dbPage.items.map((t) => {
    const item = toFeedItem(t);
    const n = protectByThreat.get(t.publicId) ?? 0;
    return { ...item, rulesProtect: n };
  });

  const totalFiltered = dbPage.total;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / THREAT_FEED_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const sliceStart = (page - 1) * THREAT_FEED_PAGE_SIZE;
  const rangeStart = totalFiltered === 0 ? 0 : sliceStart + 1;
  const rangeEnd = Math.min(sliceStart + THREAT_FEED_PAGE_SIZE, totalFiltered);

  const filterLinks = (
    <>
      <Link
        href={buildThreatsHref({ mode: "critical_high", q })}
        className={severityFilterButtonClass("critical", mode === "critical_high")}
      >
        <SeveritySwatch s="critical" />
        CRITICAL+HIGH
      </Link>
      {(["critical", "high", "medium"] as const).map((s) => {
        const active = mode === "single" && single === s;
        return (
          <Link
            key={s}
            href={buildThreatsHref({ mode: "single", single: s, q })}
            className={severityFilterButtonClass(s, active)}
          >
            <SeveritySwatch s={s} />
            {s.toUpperCase()}
          </Link>
        );
      })}
      <Link
        href={buildThreatsHref({ mode: "all", q })}
        className={severityFilterButtonClass("all", mode === "all")}
      >
        <SeveritySwatch s="all" />
        ALL
      </Link>
    </>
  );

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl px-gutter py-10">
        <header className="relative mb-8 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-on-surface">Threat intelligence</h1>
              <span className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary-fixed-dim/25 px-2.5 py-1 font-mono-label text-primary">
                <MaterialSymbol name="verified" className="!text-base" aria-hidden />
                Verified CVEs
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-body-sm text-on-surface-variant">
              {verifiedCount} threats tracked across MVP launch stacks — each entry links to NVD or a published advisory.
              {lastSync ? (
                <>
                  {" "}
                  Last pipeline sync:{" "}
                  <time dateTime={lastSync}>{new Date(lastSync).toLocaleString()}</time>.
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by severity">
              {filterLinks}
            </div>
            <form
              action="/threats"
              method="get"
              className="flex w-full min-w-0 sm:w-auto sm:max-w-md sm:flex-1 sm:justify-end lg:max-w-lg"
            >
              {mode === "single" && single ? <input type="hidden" name="severity" value={single} /> : null}
              {mode === "all" ? <input type="hidden" name="severity" value="all" /> : null}
              {/* New search resets to page 1 (page param omitted) */}
              <div className="relative w-full min-w-0 sm:min-w-[280px]">
                <MaterialSymbol
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 !text-xl -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search threats..."
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2.5 pl-11 pr-3 text-sm text-on-surface shadow-sm outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </form>
          </div>
        </header>

        <div className="relative grid gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-on-surface">Launch stacks · severity counts</h2>
                <span className="font-mono-label text-on-surface-variant">From catalog DB</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant font-mono-label text-on-surface-variant">
                      <th className="py-2 text-left">Stack</th>
                      <th className="py-2 text-right text-error">Critical</th>
                      <th className="py-2 text-right text-tertiary-container">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-on-surface-variant">
                          No matrix data. Run migrations and seed.
                        </td>
                      </tr>
                    ) : (
                      matrixRows.map((row) => (
                        <tr key={row.slug} className="border-b border-outline-variant/60">
                          <td className="py-2 font-medium text-on-surface">{row.name}</td>
                          <td className="py-2 text-right font-mono-data">{row.critical}</td>
                          <td className="py-2 text-right font-mono-data">{row.high}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-mono-label text-on-surface-variant">Threat feed</h2>
              {totalFiltered > 0 ? (
                <p className="font-mono-data text-sm text-on-surface-variant">
                  Showing {rangeStart}–{rangeEnd} of {totalFiltered}
                  {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : null}
                </p>
              ) : null}
            </div>
            <div className="space-y-4">
              {totalFiltered === 0 ? (
                <p className="rounded-lg border border-outline-variant bg-surface-container-low p-6 text-sm text-on-surface-variant">
                  No threats match.{" "}
                  <Link href="/threats" className="text-primary hover:underline">
                    Reset filters
                  </Link>
                </p>
              ) : (
                paginatedFeed.map((t) => (
                  <article
                    key={t.publicId}
                    className={`rounded-lg border border-y border-r border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:border-primary/40 ${feedCardBorderClass(t.severity)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded px-2 py-0.5 font-mono-label uppercase ${severityStyle(t.severity)}`}>
                            {t.severity ?? "n/a"}
                          </span>
                          {t.referenceUrl ? (
                            <a
                              href={t.referenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-sm font-mono-data text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                              {t.cveLabel ?? t.publicId}
                              <MaterialSymbol name="open_in_new" className="!text-base" aria-hidden />
                              <span className="sr-only">Opens reference in a new tab</span>
                            </a>
                          ) : null}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-on-surface">{t.name}</h3>
                        {t.description ? (
                          <p className="mt-2 line-clamp-4 text-body-sm text-on-surface-variant">{stripMarkdown(t.description)}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {t.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded border border-outline-variant bg-surface-container px-2 py-0.5 font-mono-label text-on-surface-variant"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end justify-start gap-2 pt-0.5">
                        <span className="whitespace-nowrap rounded-full border border-primary/35 bg-primary-fixed-dim/20 px-3 py-1 font-mono-label text-primary">
                          {t.rulesProtect} {t.rulesProtect === 1 ? "rule" : "rules"} protect
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
            {totalFiltered > 0 && totalPages > 1 ? (
              <nav
                className="flex flex-col gap-3 border-t border-outline-variant pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                aria-label="Threat feed pagination"
              >
                {page <= 1 ? (
                  <span className="rounded-lg border border-outline-variant/50 px-4 py-2 font-mono-label text-sm text-on-surface-variant/40">
                    Previous
                  </span>
                ) : (
                  <Link
                    href={buildThreatsHref({
                      mode,
                      single: mode === "single" ? single : undefined,
                      q,
                      page: page - 1,
                    })}
                    className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 font-mono-label text-sm text-on-surface hover:border-primary hover:bg-surface-container"
                    prefetch={false}
                  >
                    Previous
                  </Link>
                )}
                <span className="font-mono-data text-sm text-on-surface-variant">
                  Page {page} / {totalPages}
                </span>
                {page >= totalPages ? (
                  <span className="rounded-lg border border-outline-variant/50 px-4 py-2 font-mono-label text-sm text-on-surface-variant/40">
                    Next
                  </span>
                ) : (
                  <Link
                    href={buildThreatsHref({
                      mode,
                      single: mode === "single" ? single : undefined,
                      q,
                      page: page + 1,
                    })}
                    className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 font-mono-label text-sm text-on-surface hover:border-primary hover:bg-surface-container"
                    prefetch={false}
                  >
                    Next
                  </Link>
                )}
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
