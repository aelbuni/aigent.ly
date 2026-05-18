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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stacks.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/stacks/${encodeURIComponent(s.slug)}`}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary hover:bg-surface-container"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest">
                  <MaterialSymbol name="layers" className="!text-2xl text-primary" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="font-semibold text-on-surface">{s.name}</h3>
                  <p className="font-mono-data text-sm text-on-surface-variant">{s.slug}</p>
                </div>
                <MaterialSymbol name="chevron_right" className="ml-auto shrink-0 text-outline" />
              </Link>
            </li>
          ))}
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
