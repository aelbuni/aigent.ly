import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { HERO } from "@/lib/home-marketing-content";

export function HomeHeroValue() {
  return (
    <section className="hero-section dot-grid relative flex min-h-[580px] flex-col items-center justify-center overflow-hidden bg-inverse-surface px-gutter py-xl text-center text-inverse-on-surface sm:min-h-[680px]">
      {/* Ambient glow — gives depth without distraction */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 60%, rgba(99,102,241,0.13) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 50% 40%, rgba(195,192,255,0.07) 0%, transparent 60%)",
        }}
      />
      {/* Live badge */}
      <div className="relative mb-7 inline-flex items-center gap-2 rounded border border-inverse-on-surface/20 bg-inverse-on-surface/10 px-3 py-1.5 backdrop-blur-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
        </span>
        <span className="font-mono-label tracking-widest text-inverse-primary">{HERO.badge}</span>
      </div>

      <h1 className="font-h1 text-h1 relative mb-6 max-w-3xl">{HERO.headline}</h1>
      <p className="font-body-base relative mb-10 max-w-xl text-base text-inverse-on-surface/75 [line-height:1.7]">
        {HERO.subcopy}
      </p>

      <div className="relative flex flex-wrap justify-center gap-4">
        <Link
          href={HERO.primaryCta.href}
          className="font-body-base group flex items-center gap-2 rounded-lg bg-inverse-primary px-7 py-3.5 font-semibold text-inverse-on-primary shadow-[0_0_24px_rgba(99,102,241,0.4)] transition-all hover:shadow-[0_0_32px_rgba(99,102,241,0.6)]"
        >
          {HERO.primaryCta.label}
          <MaterialSymbol name="arrow_forward" className="!text-sm transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href={HERO.secondaryCta.href}
          className="font-body-base rounded-lg border border-inverse-on-surface/25 bg-inverse-on-surface/5 px-7 py-3.5 text-inverse-on-surface/80 backdrop-blur-sm transition-colors hover:border-inverse-on-surface/50 hover:bg-inverse-on-surface/10"
        >
          {HERO.secondaryCta.label}
        </Link>
      </div>
    </section>
  );
}
