import Link from "next/link";

import type { components } from "@aigently/api-client";

import { MaterialSymbol } from "@/components/MaterialSymbol";

type Stack = components["schemas"]["Stack"];

export function HomeLaunchStacks({ stacks }: { stacks: Stack[] }) {
  if (stacks.length === 0) return null;

  return (
    <section className="marketing-section marketing-section--spacious-bottom border-b border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto max-w-7xl">
        <div className="marketing-section-header text-center">
          <span className="font-mono-label text-primary">MVP</span>
          <h2 className="font-h2 text-h2 text-on-surface">Pick your stack</h2>
          <p className="mx-auto max-w-2xl text-body-base text-on-surface-variant">
            Six launch stacks with certified rules and verified CVE linkage — browse posture and rules for each.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stacks.map((s) => {
            const grade = (s as { securityGrade?: string }).securityGrade ?? "B";
            const gradeColor =
              grade === "A" ? "text-[#22c55e] border-[#22c55e]/30 bg-[#22c55e]/10"
              : grade === "B" ? "text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/10"
              : "text-[#f59e0b] border-[#f59e0b]/30 bg-[#f59e0b]/10";
            return (
              <li key={s.slug}>
                <Link
                  href={`/stacks/${encodeURIComponent(s.slug)}`}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 transition-all duration-200 hover:border-primary/50 hover:bg-surface-container-low hover:shadow-[0_2px_16px_rgba(31,16,142,0.08)]"
                >
                  {/* Hover accent */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-primary/60 to-transparent transition-transform duration-300 group-hover:scale-x-100" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary">
                    <MaterialSymbol name="layers" className="!text-xl" />
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="font-semibold text-on-surface">{s.name}</h3>
                    <p className="font-mono-data text-[11px] text-on-surface-variant/70">{s.slug}</p>
                  </div>

                  <div className={`shrink-0 rounded border px-1.5 py-0.5 font-mono-label text-[10px] font-semibold ${gradeColor}`}>
                    {grade}
                  </div>
                  <MaterialSymbol name="chevron_right" className="shrink-0 text-outline transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-center font-body-sm text-on-surface-variant">
          <Link href="/stacks" className="font-semibold text-primary underline-offset-4 hover:underline">
            View all stacks and coming soon
          </Link>
        </p>
      </div>
    </section>
  );
}
