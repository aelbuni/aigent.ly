import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { HERO, TESTIMONIAL } from "@/lib/home-marketing-content";

export function HomeHeroValue() {
  return (
    <section className="dot-grid flex min-h-[640px] flex-col items-center justify-center bg-inverse-surface px-gutter py-xl text-center text-inverse-on-surface">
      <div className="mb-6 inline-flex items-center rounded border border-inverse-on-surface/25 bg-inverse-on-surface/10 px-3 py-1">
        <span className="font-mono-label mr-2 uppercase tracking-widest text-inverse-primary">{HERO.badge}</span>
        <div className="h-1 w-1 rounded-full bg-inverse-primary" />
      </div>
      <h1 className="font-h1 text-h1 mb-6 max-w-3xl">{HERO.headline}</h1>
      <p className="font-body-base mb-10 max-w-2xl text-lg text-inverse-on-surface/85">{HERO.subcopy}</p>
      <div className="mb-10 flex flex-wrap justify-center gap-4">
        <Link
          href={HERO.primaryCta.href}
          className="font-body-base flex items-center gap-2 rounded-lg bg-inverse-primary px-6 py-3 font-semibold text-inverse-on-primary"
        >
          {HERO.primaryCta.label}
          <MaterialSymbol name="arrow_forward" className="!text-sm" />
        </Link>
        <Link
          href={HERO.secondaryCta.href}
          className="font-body-base rounded-lg border border-inverse-on-surface/30 bg-transparent px-6 py-3 text-inverse-on-surface transition-colors hover:bg-inverse-on-surface/10"
        >
          {HERO.secondaryCta.label}
        </Link>
      </div>
      <blockquote className="mb-1 max-w-2xl rounded-xl border border-inverse-on-surface/20 bg-inverse-on-surface/10 px-6 py-4 text-left">
        <p className="font-body-base italic text-inverse-on-surface">&quot;{TESTIMONIAL.quote}&quot;</p>
        <footer className="mt-3 font-mono-label text-[11px] uppercase tracking-widest text-inverse-primary">
          — {TESTIMONIAL.attribution}
        </footer>
      </blockquote>
    </section>
  );
}
