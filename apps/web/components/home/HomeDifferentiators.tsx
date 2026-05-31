import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { THREE_USPS } from "@/lib/home-marketing-content";

export function HomeDifferentiators() {
  return (
    <section className="marketing-section marketing-section--inverse border-b border-outline-variant bg-inverse-surface text-inverse-on-surface">
      <div className="mx-auto max-w-7xl">
        <div className="marketing-section-header text-center">
          <span className="font-mono-label uppercase text-inverse-primary">Why it matters</span>
          <h2 className="font-h2 text-h2 tracking-tight">Three differences vs. raw AI IDEs</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {THREE_USPS.map((item, i) => (
            <div
              key={item.title}
              className="group relative flex flex-col rounded-2xl border border-inverse-on-surface/15 bg-inverse-on-surface/5 p-8 transition-colors hover:border-inverse-on-surface/25 hover:bg-inverse-on-surface/10"
            >
              {/* Step indicator */}
              <span className="font-mono-label mb-6 text-[10px] tracking-widest text-inverse-on-surface/30">
                0{i + 1}
              </span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-inverse-on-surface/20 bg-inverse-on-surface/10">
                <MaterialSymbol name={item.icon} className="!text-2xl text-inverse-primary" />
              </div>
              <h3 className="font-h3 text-h3 mb-3 text-inverse-on-surface">{item.title}</h3>
              <p className="mb-6 flex-grow text-[13px] leading-relaxed text-inverse-on-surface/70">{item.body}</p>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1.5 font-mono-label text-[11px] text-inverse-primary transition-opacity hover:opacity-70"
              >
                Explore
                <MaterialSymbol name="arrow_forward" className="!text-[13px] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
