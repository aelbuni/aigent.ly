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

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type SeverityMode = "critical_high" | "all" | "single";

const THREAT_FEED_PAGE_SIZE = 20;

function firstString(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : v[0] ?? "";
}

function parseThreatSearch(sp: Record<string, string | string[] | undefined> | undefined) {
  const raw = firstString(sp?.severity);
  let mode: SeverityMode = "all";
  let single: "" | "critical" | "high" | "medium" | "low" = "";
  if (raw === "critical_high" || raw === "critical+high") mode = "critical_high";
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
  if (patch.mode === "critical_high") p.set("severity", "critical_high");
  else if (patch.mode === "all") {
    /* default — omit param */
  } else if (patch.single) p.set("severity", patch.single);
  if (patch.q) p.set("q", patch.q);
  if (patch.page !== undefined && patch.page > 1) p.set("page", String(patch.page));
  const s = p.toString();
  return s ? `/threats?${s}` : "/threats";
}

const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "text-error", border: "border-error/60", bg: "bg-error-container/30", pill: "bg-error text-white" },
  high:     { label: "High",     color: "text-tertiary-container", border: "border-tertiary/60", bg: "bg-tertiary-container/15", pill: "bg-tertiary-container text-white" },
  medium:   { label: "Medium",   color: "text-primary", border: "border-primary/50", bg: "bg-primary-fixed-dim/20", pill: "bg-primary/80 text-white" },
  low:      { label: "Low",      color: "text-on-surface-variant", border: "border-outline-variant", bg: "bg-surface-container", pill: "bg-outline text-on-surface" },
} as const;

function SeverityPill({ sev }: { sev: string | null | undefined }) {
  const cfg = SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG];
  if (!cfg) return <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono-label text-xs text-on-surface-variant">n/a</span>;
  return <span className={`rounded-full px-2.5 py-0.5 font-mono-label text-xs font-semibold uppercase ${cfg.pill}`}>{cfg.label}</span>;
}

function filterButtonClass(active: boolean, severity?: keyof typeof SEVERITY_CONFIG) {
  const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors";
  if (!active) return `${base} border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-outline hover:bg-surface-container`;
  if (!severity) return `${base} border-on-surface/40 bg-surface-container text-on-surface`;
  const cfg = SEVERITY_CONFIG[severity];
  return `${base} ${cfg.border} ${cfg.bg} ${cfg.color}`;
}

export default async function ThreatsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const { mode, single, q, page: requestedPage } = parseThreatSearch(sp);

  const severities =
    mode === "critical_high" ? ["critical", "high"] :
    mode === "single" && single ? [single] :
    [];

  let dbPage: ThreatFeedPage = { items: [], total: 0 };
  let matrixRows: Awaited<ReturnType<typeof getLaunchStackThreatSeverityCounts>> = [];
  let verifiedCount = 0;
  let lastSync: string | null = null;
  let protectByThreat = new Map<string, number>();
  try {
    [dbPage, matrixRows, verifiedCount, lastSync, protectByThreat] = await Promise.all([
      listThreatsPagedFromDb({ severities, q, page: requestedPage, perPage: THREAT_FEED_PAGE_SIZE }),
      getLaunchStackThreatSeverityCounts(),
      countDistinctThreatsOnLaunchStacks(),
      getLastCatalogSyncFinishedAt(),
      getRuleCountByThreatPublicId(),
    ]);
  } catch { /* DB unavailable */ }

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

  const activeFilterLabel =
    mode === "critical_high" ? "Critical + High" :
    mode === "single" && single ? SEVERITY_CONFIG[single as keyof typeof SEVERITY_CONFIG]?.label ?? single :
    "All severities";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Threat Intelligence</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-fixed-dim/25 px-2.5 py-1 font-mono-label text-xs text-primary">
              <MaterialSymbol name="verified" className="!text-sm" aria-hidden />
              Live CVE feed
            </span>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">{verifiedCount}</span> threats tracked across 6 launch stacks — sourced from NVD, GHSA, CISA KEV, and OSV.
            {lastSync ? (
              <> Updated <time dateTime={lastSync}>{new Date(lastSync).toLocaleDateString()}</time>.</>
            ) : null}
          </p>
        </header>

        {/* ── Severity stats strip ────────────────────────────────────────── */}
        {matrixRows.length > 0 && (
          <div className="mb-6 overflow-x-auto">
            <div className="flex min-w-max gap-3">
              {matrixRows.slice(0, 6).map((row) => (
                <div key={row.slug} className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs whitespace-nowrap">
                  <span className="font-medium text-on-surface">{row.name}</span>
                  <span className="font-semibold text-error">{row.critical} critical</span>
                  <span className="text-outline-variant">·</span>
                  <span className="font-semibold text-tertiary-container">{row.high} high</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters + search ───────────────────────────────────────────── */}
        <div className="mb-6 space-y-3">
          {/* Severity filters — scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by severity">
            <Link href={buildThreatsHref({ mode: "all", q })} className={filterButtonClass(mode === "all")}>
              All
            </Link>
            <Link href={buildThreatsHref({ mode: "critical_high", q })} className={filterButtonClass(mode === "critical_high", "critical")}>
              <span className="h-1.5 w-1.5 rounded-full bg-error" />
              Critical + High
            </Link>
            {(["critical", "high", "medium", "low"] as const).map((s) => (
              <Link key={s} href={buildThreatsHref({ mode: "single", single: s, q })} className={filterButtonClass(mode === "single" && single === s, s)}>
                {SEVERITY_CONFIG[s].label}
              </Link>
            ))}
          </div>

          {/* Search row */}
          <form action="/threats" method="get" className="flex gap-2">
            {mode === "critical_high" && <input type="hidden" name="severity" value="critical_high" />}
            {mode === "single" && single && <input type="hidden" name="severity" value={single} />}
            <div className="relative flex-1">
              <MaterialSymbol name="search" className="pointer-events-none absolute left-3 top-1/2 !text-lg -translate-y-1/2 text-on-surface-variant" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search CVEs, packages, keywords..."
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2.5 pl-10 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            {q && (
              <Link
                href={buildThreatsHref({ mode, single: mode === "single" ? single : undefined })}
                className="flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface-variant hover:bg-surface-container"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {/* ── Results meta + CTA ─────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            {totalFiltered > 0 ? (
              <>
                <span className="font-semibold text-on-surface">{totalFiltered}</span>
                <span>threats · {activeFilterLabel}</span>
                {totalPages > 1 && (
                  <span className="text-on-surface-variant/60">· page {page}/{totalPages}</span>
                )}
              </>
            ) : (
              <span>No threats match</span>
            )}
          </div>
          <Link
            href="/composer"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <MaterialSymbol name="shield" className="!text-sm" />
            Get guardrails →
          </Link>
        </div>

        {/* ── Threat cards ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          {totalFiltered === 0 ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-10 text-center">
              <MaterialSymbol name="search_off" className="!text-4xl text-on-surface-variant/40" />
              <p className="mt-3 text-sm text-on-surface-variant">No threats match your filters.</p>
              <Link href="/threats" className="mt-2 inline-block text-sm text-primary hover:underline">Clear filters</Link>
            </div>
          ) : (
            paginatedFeed.map((t) => {
              const cfg = SEVERITY_CONFIG[t.severity as keyof typeof SEVERITY_CONFIG];
              const borderColor = cfg ? `border-l-[3px] ${
                t.severity === "critical" ? "border-l-error" :
                t.severity === "high" ? "border-l-tertiary-container" :
                t.severity === "medium" ? "border-l-primary" : "border-l-outline"
              }` : "";
              return (
                <article
                  key={t.publicId}
                  className={`rounded-xl border border-outline-variant bg-surface-container-lowest p-4 transition-colors hover:border-primary/30 hover:bg-surface-container-low sm:p-5 ${borderColor}`}
                >
                  {/* Top row: severity + CVE ID + rules badge */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityPill sev={t.severity} />
                      {t.referenceUrl ? (
                        <a
                          href={t.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono-data text-xs text-primary hover:underline"
                        >
                          {t.cveLabel ?? t.publicId}
                          <MaterialSymbol name="open_in_new" className="!text-xs" aria-hidden />
                        </a>
                      ) : (
                        <span className="font-mono-data text-xs text-on-surface-variant">{t.publicId}</span>
                      )}
                    </div>
                    {t.rulesProtect > 0 && (
                      <span className="shrink-0 rounded-full border border-primary/30 bg-primary-fixed-dim/20 px-2 py-0.5 font-mono-label text-xs text-primary">
                        {t.rulesProtect} {t.rulesProtect === 1 ? "rule" : "rules"}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="mt-2 text-base font-semibold leading-snug text-on-surface sm:text-lg">{t.name}</h2>

                  {/* Description */}
                  {t.description && (
                    <p className="mt-1.5 line-clamp-3 text-sm text-on-surface-variant">
                      {stripMarkdown(t.description)}
                    </p>
                  )}

                  {/* Tags + CTA */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {t.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded border border-outline-variant bg-surface-container px-2 py-0.5 font-mono-label text-xs text-on-surface-variant">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Link href="/composer" className="shrink-0 font-mono-label text-xs text-primary hover:underline">
                      Get guardrail →
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {totalFiltered > 0 && totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-between gap-4 border-t border-outline-variant pt-6" aria-label="Pagination">
            {page <= 1 ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-4 py-2 text-sm text-on-surface-variant/40">
                <MaterialSymbol name="chevron_left" className="!text-base" />
                Previous
              </span>
            ) : (
              <Link
                href={buildThreatsHref({ mode, single: mode === "single" ? single : undefined, q, page: page - 1 })}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface hover:border-primary hover:bg-surface-container"
                prefetch={false}
              >
                <MaterialSymbol name="chevron_left" className="!text-base" />
                Previous
              </Link>
            )}

            <div className="flex items-center gap-1">
              {/* Page number pills — show at most 5 */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p2 = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <Link
                    key={p2}
                    href={buildThreatsHref({ mode, single: mode === "single" ? single : undefined, q, page: p2 === 1 ? undefined : p2 })}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                      p2 === page
                        ? "border-primary bg-primary text-white"
                        : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/50"
                    }`}
                    prefetch={false}
                  >
                    {p2}
                  </Link>
                );
              })}
              {totalPages > 5 && page < totalPages - 2 && (
                <span className="px-1 text-xs text-on-surface-variant">…{totalPages}</span>
              )}
            </div>

            {page >= totalPages ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-4 py-2 text-sm text-on-surface-variant/40">
                Next
                <MaterialSymbol name="chevron_right" className="!text-base" />
              </span>
            ) : (
              <Link
                href={buildThreatsHref({ mode, single: mode === "single" ? single : undefined, q, page: page + 1 })}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface hover:border-primary hover:bg-surface-container"
                prefetch={false}
              >
                Next
                <MaterialSymbol name="chevron_right" className="!text-base" />
              </Link>
            )}
          </nav>
        )}

        {/* ── Showing range ──────────────────────────────────────────────── */}
        {totalFiltered > 0 && (
          <p className="mt-4 text-center text-xs text-on-surface-variant/60">
            Showing {rangeStart}–{rangeEnd} of {totalFiltered} threats
          </p>
        )}
      </div>
    </div>
  );
}
