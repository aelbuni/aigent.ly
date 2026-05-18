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
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          {THREE_USPS.map((item) => (
            <div key={item.title} className="flex flex-col">
              <MaterialSymbol name={item.icon} className="mb-4 text-3xl text-inverse-primary" />
              <h3 className="font-h3 mb-2">{item.title}</h3>
              <p className="mb-4 flex-grow font-body-sm leading-relaxed text-inverse-on-surface/85">{item.body}</p>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 font-mono-label text-inverse-primary hover:underline"
              >
                Explore
                <MaterialSymbol name="chevron_right" className="!text-base" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
