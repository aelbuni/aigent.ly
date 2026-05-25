import type { Metadata } from "next";
import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { listLayersWithStatsFromDb } from "@/lib/catalog-from-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Protection Layers | Aigent.ly",
  description:
    "Browse all 15 protection layer categories for AI coding guardrails — from Authentication to AI Safety.",
};

export default async function LayersPage() {
  const layers = await listLayersWithStatsFromDb();

  const systemLayers = layers.filter((l) => l.isSystem);
  const otherLayers = layers.filter((l) => !l.isSystem);

  return (
    <main className="mx-auto max-w-6xl px-gutter py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Protection Layers</h1>
        <p className="mt-3 max-w-2xl text-on-surface-variant">
          Every guardrail in Aigent.ly is scoped to a protection layer — a category of security
          concern your AI coding assistant should understand and enforce.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 font-mono-label text-xs uppercase tracking-widest text-on-surface-variant">
          Core layers — every project
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systemLayers.map((l) => (
            <LayerCard key={l.slug} layer={l} comingSoon={l.ruleCount === 0} />
          ))}
        </div>
      </section>

      {otherLayers.length > 0 && (
        <section>
          <h2 className="mb-4 font-mono-label text-xs uppercase tracking-widest text-on-surface-variant">
            Infrastructure &amp; operational layers
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherLayers.map((l) => (
              <LayerCard key={l.slug} layer={l} comingSoon={l.ruleCount === 0} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

type LayerCardProps = {
  layer: Awaited<ReturnType<typeof listLayersWithStatsFromDb>>[number];
  comingSoon?: boolean;
};

function LayerCard({ layer: l, comingSoon }: LayerCardProps) {
  const card = (
    <div
      className={`group flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-5 transition-colors ${
        comingSoon ? "opacity-60" : "hover:bg-surface-container-low hover:border-outline"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container">
          {l.iconName ? (
            <MaterialSymbol name={l.iconName} className="!text-xl text-primary" />
          ) : null}
        </div>
        {l.isSystem && (
          <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono-label text-xs text-primary">
            Core
          </span>
        )}
        {comingSoon && (
          <span className="rounded-sm bg-surface-container px-1.5 py-0.5 font-mono-label text-xs text-on-surface-variant">
            Coming soon
          </span>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-on-surface">{l.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{l.description}</p>
      </div>

      <div className="mt-auto flex items-center gap-3 text-xs text-on-surface-variant">
        <span>{l.ruleCount} rules</span>
        <span className="text-outline-variant">·</span>
        <span>{l.threatCount} threats</span>
        <span className="text-outline-variant">·</span>
        <span>{l.stackCount} stacks</span>
      </div>
    </div>
  );

  if (comingSoon && !l.isSystem) return card;
  return <Link href={`/layers/${l.slug}`}>{card}</Link>;
}
