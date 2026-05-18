import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import {
  listLayersWithStatsFromDb,
  listThreatsForLayerFromDb,
} from "@/lib/catalog-from-db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const layers = await listLayersWithStatsFromDb();
    return layers.map((l) => ({ slug: l.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const layers = await listLayersWithStatsFromDb();
  const l = layers.find((x) => x.slug === slug);
  if (!l) return { title: "Layer not found | Aigent.ly" };
  return {
    title: `${l.name} Guardrails | Aigent.ly`,
    description: l.concernStatement,
    alternates: { canonical: `/layers/${slug}` },
  };
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
  info: "bg-surface-container text-on-surface-variant",
};

export default async function LayerDetailPage({ params }: Props) {
  const { slug } = await params;
  const [layers, threats] = await Promise.all([
    listLayersWithStatsFromDb(),
    listThreatsForLayerFromDb(slug),
  ]);

  const l = layers.find((x) => x.slug === slug);
  if (!l) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant">
        <Link href="/layers" className="hover:text-on-surface">
          Layers
        </Link>
        <span>/</span>
        <span className="text-on-surface">{l.name}</span>
      </nav>

      {/* Hero */}
      <header className="mb-10 flex items-start gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container">
          {l.iconName ? (
            <MaterialSymbol name={l.iconName} className="!text-3xl text-primary" />
          ) : null}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">{l.name}</h1>
            {l.isSystem && (
              <span className="rounded-sm bg-primary/10 px-2 py-0.5 font-mono-label text-xs text-primary">
                Core layer
              </span>
            )}
          </div>
          <p className="mt-2 text-on-surface-variant">{l.description}</p>
          <p className="mt-1 text-sm italic text-on-surface-variant">
            This layer is concerned with {l.concernStatement}.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
            <span className="font-medium text-on-surface">{l.ruleCount}</span> rules
            <span className="text-outline-variant">·</span>
            <span className="font-medium text-on-surface">{l.threatCount}</span> threats
            <span className="text-outline-variant">·</span>
            <span className="font-medium text-on-surface">{l.stackCount}</span> stacks
          </div>
        </div>
      </header>

      {/* CTAs */}
      <div className="mb-10 flex flex-wrap gap-3">
        <Link
          href={`/explore?layer=${slug}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <MaterialSymbol name="search" className="!text-base" />
          Explore rules on this layer
        </Link>
        <Link
          href={`/rules?layers=${slug}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Browse all rules
        </Link>
      </div>

      {/* Threats */}
      {threats.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 font-mono-label text-sm text-primary">
            Threats mapped to this layer
          </h2>
          <div className="flex flex-col gap-3">
            {threats.map((t) => (
              <div
                key={t.threatId}
                className="flex flex-col gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-on-surface">{t.name}</span>
                  {t.severity && (
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono-label text-xs ${SEVERITY_BADGE[t.severity] ?? SEVERITY_BADGE.info}`}
                    >
                      {t.severity}
                    </span>
                  )}
                  {t.relevance && (
                    <span className="rounded-sm border border-outline-variant px-1.5 py-0.5 font-mono-label text-xs text-on-surface-variant">
                      {t.relevance}
                    </span>
                  )}
                  {t.cveId && (
                    <span className="font-mono-data text-xs text-on-surface-variant">
                      {t.cveId}
                    </span>
                  )}
                </div>
                {t.rationale && (
                  <p className="text-sm text-on-surface-variant">{t.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {threats.length === 0 && (
        <section className="mb-10 rounded-lg border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
          No threats mapped to this layer yet.{" "}
          <Link href="/contributing" className="text-primary hover:underline">
            Contribute a mapping →
          </Link>
        </section>
      )}
    </main>
  );
}
