import Link from "next/link";

import { JTBD_STEPS } from "@/lib/home-marketing-content";

export function HomeJtbdSteps() {
  return (
    <section className="marketing-section mx-auto max-w-4xl border-t border-outline-variant">
      <div className="marketing-section-header text-center">
        <span className="font-mono-label uppercase text-primary">The job to be done</span>
        <h2 className="font-h2 text-h2 uppercase tracking-tight">Under one minute</h2>
        <p className="text-on-surface-variant">Five steps from stack to live guardrails — each links where it helps.</p>
      </div>
      <ol className="relative space-y-0">
        {/* Vertical connector line */}
        <div className="absolute bottom-4 left-[23px] top-4 w-px bg-outline-variant/40" aria-hidden />

        {JTBD_STEPS.map((step, i) => (
          <li key={step.title} className="group relative flex items-start gap-6 py-5">
            {/* Step dot + number */}
            <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest transition-colors group-hover:border-primary/50 group-hover:bg-surface-container-low">
              <span className="font-mono-data text-[13px] font-semibold text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-2.5">
              <Link href={step.href} className="font-h3 text-h3 font-semibold text-on-surface hover:text-primary">
                {step.title}
              </Link>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
