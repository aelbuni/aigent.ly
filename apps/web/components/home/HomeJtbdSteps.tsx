import Link from "next/link";

import { JTBD_STEPS } from "@/lib/home-marketing-content";

export function HomeJtbdSteps() {
  return (
    <section className="mx-auto max-w-4xl border-t border-outline-variant px-gutter py-xl">
      <div className="mb-12 text-center">
        <span className="font-mono-label mb-2 block uppercase text-primary">The job to be done</span>
        <h2 className="font-h2 text-h2 uppercase tracking-tight">Under one minute</h2>
        <p className="mt-2 text-on-surface-variant">Five steps from stack to live guardrails — each links where it helps.</p>
      </div>
      <ol className="space-y-6">
        {JTBD_STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-wrap items-start gap-6">
            <span className="font-h2 text-h2 text-outline-variant" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={step.href} className="font-h3 text-primary hover:underline">
                {step.title}
              </Link>
              <p className="mt-1 text-sm text-on-surface-variant">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
