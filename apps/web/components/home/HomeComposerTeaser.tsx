import Link from "next/link";
import { MaterialSymbol } from "@/components/MaterialSymbol";

export function HomeComposerTeaser() {
  return (
    <section className="marketing-section marketing-section--inset mx-auto max-w-7xl">
      <div className="flex flex-col items-center gap-8 rounded-xl bg-primary-container p-8 text-white sm:gap-12 sm:p-12 md:flex-row">
        {/* Left: headline + CTA */}
        <div className="md:w-1/3">
          <span className="font-mono-label block text-on-primary-container">Free &amp; instant</span>
          <h2 className="font-h2 text-h2 mb-6">Build your agent&apos;s guardrails in seconds.</h2>
          <p className="font-body-base mb-8 text-white/80">
            Pick your stack and IDE — the Composer merges all CVE-backed rules into a single ready-to-paste file.
            No sign-up, no API key, no cost.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/composer"
              className="font-body-base inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-primary transition-opacity hover:opacity-90"
            >
              Open the Composer
              <MaterialSymbol name="arrow_forward" className="!text-sm" />
            </Link>
            <Link
              href="/stacks"
              className="font-body-base inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
            >
              Browse stacks
            </Link>
          </div>
        </div>

        {/* Right: real generated file preview */}
        <div className="w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl md:w-2/3">
          {/* Fake window chrome */}
          <div className="flex items-center gap-1.5 border-b border-slate-700 bg-slate-800 px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-3 font-mono text-[11px] text-slate-400">CLAUDE.md</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-relaxed text-slate-300">
            <code>{`# Aigent.ly guardrails — Next.js · Claude Code
# patterns + deps — auto-generated, do not edit manually

## Authentication & Session
WHEN generating login/register handlers
THEN always hash passwords with bcrypt (min 12 rounds).
If not possible, STOP and explain.

## Dependency Advisories
⚠ CVE-2026-45109 (HIGH) next@<15.3.3
  Middleware/proxy bypass via segment-prefetch.
  ACTION: upgrade to next ≥ 15.3.3 before shipping.

## Input Validation
WHEN accepting user input in API routes
THEN validate and sanitize with zod before use.`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
