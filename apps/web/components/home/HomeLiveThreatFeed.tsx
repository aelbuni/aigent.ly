import Link from "next/link";
import type { HomeThreatRow } from "@/lib/catalog-from-db";

function SeverityBadge({ severity }: { severity: string | null }) {
  const cls =
    severity === "critical"
      ? "text-error border-error/40 bg-error/8"
      : "text-tertiary-container border-tertiary-container/40 bg-tertiary-container/8";
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono-label text-[10px] uppercase ${cls}`}>
      {severity ?? "?"}
    </span>
  );
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(d);
}

export function HomeLiveThreatFeed({ threats }: { threats: HomeThreatRow[] }) {
  if (threats.length === 0) return null;

  return (
    <section className="marketing-section border-t border-outline-variant bg-surface-container-low py-14">
      <div className="mx-auto max-w-7xl px-gutter">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 font-mono-label text-primary">LIVE THREAT INTELLIGENCE</p>
            <h2 className="text-h2 font-h2 text-on-surface">
              Top critical threats — this week
            </h2>
            <p className="mt-2 text-body-base text-on-surface-variant">
              Real CVEs from NVD, GHSA, and OSV — verified and linked to your stack.
            </p>
          </div>
          <Link
            href="/threats"
            className="shrink-0 font-mono-label text-sm text-primary hover:underline"
          >
            View all 519 threats →
          </Link>
        </div>

        {/* Threat list */}
        <div className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
          {threats.map((t) => {
            const href = t.sourceUrl ?? (t.cveId ? `https://nvd.nist.gov/vuln/detail/${t.cveId}` : null);
            return (
              <div key={t.publicId} className="flex items-start gap-4 px-5 py-4">
                {/* Severity + exploited indicator */}
                <div className="flex shrink-0 flex-col items-start gap-1.5 pt-0.5">
                  <SeverityBadge severity={t.severity} />
                  {t.isActivelyExploited && (
                    <span className="rounded border border-error/40 bg-error/8 px-1.5 py-0.5 font-mono-label text-[9px] text-error uppercase">
                      exploited
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono-data text-sm text-primary hover:underline"
                      >
                        {t.cveId ?? t.publicId}
                      </a>
                    ) : (
                      <span className="font-mono-data text-sm text-on-surface-variant">
                        {t.cveId ?? t.publicId}
                      </span>
                    )}
                    {t.publishedAt && (
                      <span className="font-mono-label text-xs text-on-surface-variant/60">
                        {formatDate(t.publishedAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-body-sm text-on-surface">{t.name}</p>
                  {t.stackNames.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.stackNames.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="rounded bg-surface-container px-1.5 py-0.5 font-mono-label text-[10px] text-on-surface-variant"
                        >
                          {s}
                        </span>
                      ))}
                      {t.stackNames.length > 4 && (
                        <span className="font-mono-label text-[10px] text-on-surface-variant/60">
                          +{t.stackNames.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/composer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            Get guardrails for your stack →
          </Link>
        </div>
      </div>
    </section>
  );
}
