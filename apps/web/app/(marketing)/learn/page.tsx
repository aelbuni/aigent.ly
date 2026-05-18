import type { Metadata } from "next";
import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";

import styles from "./learn.module.css";

export const metadata: Metadata = {
  title: "The Honest Answer | Aigent.ly Learn",
  description: "Aigent.ly Learn: LLMs in production defense and why rules need a system of record.",
};

export default function LearnPage() {
  return (
    <main className="relative min-h-[calc(100vh-3.5rem)]">
      <div className={`pointer-events-none absolute inset-0 ${styles.dotGridLearn}`} />

      <article className="relative z-10 mx-auto max-w-5xl px-gutter py-24">
        <div className={`mb-24 border-l-4 border-primary pl-8 ${styles.animateReveal}`}>
          <span className="mb-4 block font-mono-label text-primary uppercase tracking-[0.2em]">
            Whitepaper // Series 01
          </span>
          <h1 className="mb-8 max-w-2xl text-4xl font-bold leading-none tracking-tight text-on-surface md:text-5xl">
            The Honest Answer:
            <br />
            LLMs in Production Defense
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            Modern LLMs like Claude and Copilot can generate authoritative-looking security rules in seconds. While they
            are exceptional drafting partners, relying on them for production defense exposes five critical
            architectural failings that compromise system integrity.
          </p>
        </div>

        <section className="mb-32">
          <div
            className={`mb-8 flex items-baseline justify-between border-b border-outline-variant pb-2 ${styles.animateReveal} ${styles.delay100}`}
          >
            <h2 className="font-mono-label uppercase tracking-widest text-on-surface">Architectural failings</h2>
            <span className="font-mono-data text-on-surface-variant">SEC_AUDIT_LOG_V2.0</span>
          </div>

          <div className="grid grid-cols-1 gap-px border border-outline-variant bg-outline-variant md:grid-cols-2">
            <div className={`bg-surface-container-lowest p-8 ${styles.animateReveal} ${styles.delay200}`}>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-2 w-2 bg-error" />
                <span className="font-mono-label uppercase text-error">01. Training cutoff blindness</span>
              </div>
              <p className="mb-4 text-on-surface-variant">
                AI models are frozen in time. They cannot protect against zero-day exploits or CVEs released after their
                last training update.
              </p>
              <div className="flex items-center gap-2 font-mono-data text-on-surface-variant">
                <MaterialSymbol name="event_busy" className="!text-sm" />
                <span>TEMPORAL_LIMITATION_HIGH</span>
              </div>
            </div>

            <div className={`bg-surface-container-lowest p-8 ${styles.animateReveal} ${styles.delay200}`}>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-2 w-2 bg-tertiary-container" />
                <span className="font-mono-label uppercase text-tertiary-container">02. Knowledge gap</span>
              </div>
              <p className="mb-4 text-on-surface-variant">
                You can’t ask for what you don’t know exists. AI requires specific user prompts, missing threats you
                haven’t considered.
              </p>
              <div className="flex items-center gap-2 font-mono-data text-on-surface-variant">
                <MaterialSymbol name="visibility_off" className="!text-sm" />
                <span>PROMPT_DEPENDENCY_CRITICAL</span>
              </div>
            </div>

            <div className={`bg-surface-container-lowest p-8 ${styles.animateReveal} ${styles.delay300}`}>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-2 w-2 bg-secondary" />
                <span className="font-mono-label uppercase text-secondary">03. No real-world validation</span>
              </div>
              <p className="mb-4 text-on-surface-variant">
                AI-written rules are theoretical hallucinations until tested. They lack the empirical evidence of
                successful deployment.
              </p>
              <div className="flex items-center gap-2 font-mono-data text-on-surface-variant">
                <MaterialSymbol name="verified_user" className="!text-sm" />
                <span>EMPIRICAL_DATA_MISSING</span>
              </div>
            </div>

            <div className={`bg-surface-container-lowest p-8 ${styles.animateReveal} ${styles.delay300}`}>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-2 w-2 bg-outline" />
                <span className="font-mono-label uppercase text-on-surface-variant">04. Lack of version history</span>
              </div>
              <p className="mb-4 text-on-surface-variant">
                LLM sessions are ephemeral. Every session starts from zero, losing the historical context of previous
                rule iterations.
              </p>
              <div className="flex items-center gap-2 font-mono-data text-on-surface-variant">
                <MaterialSymbol name="history" className="!text-sm" />
                <span>CONTEXT_VOLATILITY_MED</span>
              </div>
            </div>

            <div className={`bg-surface-container-lowest p-8 md:col-span-2 ${styles.animateReveal} ${styles.delay400}`}>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-2 w-2 bg-primary" />
                <span className="font-mono-label uppercase text-primary">05. Context collapse</span>
              </div>
              <p className="mb-4 text-on-surface-variant">
                AI misses stack-specific edge cases. A rule for Nginx might inadvertently break a specific Node.js
                middleware configuration or microservice bridge.
              </p>
              <div className="flex items-center gap-2 font-mono-data text-on-surface-variant">
                <MaterialSymbol name="layers_clear" className="!text-sm" />
                <span>STACK_INTERFERENCE_DETECTED</span>
              </div>
            </div>
          </div>
        </section>

        <section className={`mb-32 ${styles.animateReveal} ${styles.delay500}`}>
          <div className="mb-8 flex items-baseline justify-between border-b border-outline-variant pb-2">
            <h2 className="font-mono-label uppercase tracking-widest text-on-surface">Platform benchmarks</h2>
            <span className="font-mono-data text-on-surface-variant">REF_ID: AG-COMP-99</span>
          </div>

          <div className="overflow-x-auto border border-outline-variant">
            <table className="w-full min-w-[520px] border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="w-1/3 border-r border-outline-variant p-4 text-left font-mono-label text-on-surface-variant">
                    CAPABILITY_METRIC
                  </th>
                  <th className="border-r border-outline-variant p-4 text-left font-mono-label text-on-surface-variant">
                    LEGACY_AI_MODEL
                  </th>
                  <th className="p-4 text-left font-mono-label text-primary">AIGENT.LY_PLATFORM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-mono-data text-sm">
                <tr className="transition-colors hover:bg-surface-container-lowest">
                  <td className="border-r border-outline-variant p-4 font-medium text-on-surface">DEPLOYMENT_SPEED</td>
                  <td className="border-r border-outline-variant p-4 text-tertiary-container">MANUAL_REVIEW_REQD</td>
                  <td className="p-4 font-bold text-secondary">INSTANT_CI_CD_SYNC</td>
                </tr>
                <tr className="transition-colors hover:bg-surface-container-lowest">
                  <td className="border-r border-outline-variant p-4 font-medium text-on-surface">LIVE_CVE_UPDATES</td>
                  <td className="border-r border-outline-variant p-4 text-error">CUTOFF_GAP_DETECTED</td>
                  <td className="p-4 font-bold text-secondary">REALTIME_O_DAY_FEED</td>
                </tr>
                <tr className="transition-colors hover:bg-surface-container-lowest">
                  <td className="border-r border-outline-variant p-4 font-medium text-on-surface">COMMUNITY_RATING</td>
                  <td className="border-r border-outline-variant p-4 text-on-surface-variant">NO_SOCIAL_PROOF</td>
                  <td className="p-4 font-bold text-secondary">PEER_VALIDATED_N10K</td>
                </tr>
                <tr className="transition-colors hover:bg-surface-container-lowest">
                  <td className="border-r border-outline-variant p-4 font-medium text-on-surface">EASE_OF_USE</td>
                  <td className="border-r border-outline-variant p-4 text-tertiary-container">HIGH_PROMPT_EFFORT</td>
                  <td className="p-4 font-bold text-secondary">ONE_CLICK_COMPOSER</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={`border-l-4 border-secondary bg-on-surface p-10 text-surface md:p-16 ${styles.animateReveal} ${styles.delay500}`}>
          <div className="max-w-3xl">
            <span className="mb-6 block font-mono-label uppercase tracking-widest text-secondary">
              Conclusion // System of record
            </span>
            <h2 className="mb-8 text-3xl font-semibold leading-tight">The Real Answer to the Objection</h2>
            <p className="mb-12 text-lg leading-relaxed opacity-80">
              We don’t suggest replacing AI; we suggest grounding it. Use Aigent.ly as your{" "}
              <strong className="text-surface">system of record</strong>. Load a community-vetted, production-hardened
              rule from our Stacks as your baseline. Then, and only then, use your preferred AI to extend that rule for
              your specific, unique context.
            </p>
            <div className="flex flex-wrap gap-4 md:gap-6">
              <Link
                href="/stacks"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-mono-label uppercase tracking-widest text-on-primary hover:brightness-110 active:scale-[0.98]"
              >
                <span>Explore stacks</span>
                <MaterialSymbol name="arrow_forward" className="!text-sm" />
              </Link>
              <Link
                href="/composer"
                className="inline-flex items-center gap-2 rounded-lg border border-surface/20 px-8 py-3 font-mono-label uppercase tracking-widest text-surface hover:bg-surface/5 active:scale-[0.98]"
              >
                Start composer
              </Link>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
