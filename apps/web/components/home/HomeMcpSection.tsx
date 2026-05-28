import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { MCP_SECTION } from "@/lib/home-marketing-content";

export function HomeMcpSection() {
  return (
    <section className="marketing-section border-b border-outline-variant bg-inverse-surface">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="mb-3 inline-flex items-center gap-2 rounded border border-inverse-primary/40 bg-inverse-primary/10 px-3 py-1 font-mono-label text-xs uppercase tracking-widest text-inverse-primary">
              <MaterialSymbol name="hub" className="!text-base" />
              {MCP_SECTION.badge}
            </span>
            <h2 className="font-h2 text-h2 max-w-xl text-inverse-on-surface">{MCP_SECTION.headline}</h2>
            <p className="mt-3 max-w-2xl text-body-sm text-inverse-on-surface/80">{MCP_SECTION.subcopy}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:items-end">
            <Link
              href={MCP_SECTION.cta.href}
              className="inline-flex items-center gap-2 rounded-lg bg-inverse-primary px-5 py-2.5 font-semibold text-inverse-on-primary transition-opacity hover:opacity-90"
            >
              {MCP_SECTION.cta.label}
              <MaterialSymbol name="arrow_forward" className="!text-sm" />
            </Link>
            <a
              href={MCP_SECTION.githubHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono-label text-xs text-inverse-on-surface/70 hover:text-inverse-on-surface"
            >
              <MaterialSymbol name="open_in_new" className="!text-sm" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Code snippet + features grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Code block */}
          <div className="overflow-hidden rounded-xl border border-inverse-on-surface/20 bg-black/40">
            <div className="flex items-center gap-2 border-b border-inverse-on-surface/15 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-2 font-mono-label text-xs text-inverse-on-surface/50">mcp.json</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono-label text-sm leading-relaxed text-[#e2e8f0]">
              {MCP_SECTION.snippet}
            </pre>
            <div className="border-t border-inverse-on-surface/15 px-4 py-3">
              <p className="font-mono-label text-xs text-inverse-on-surface/50">
                Change <span className="text-inverse-primary">AIGENTLY_TARGET_IDE</span> to:{" "}
                {MCP_SECTION.ides.map((ide, i) => (
                  <span key={ide}>
                    <span className="text-inverse-on-surface/80">{ide}</span>
                    {i < MCP_SECTION.ides.length - 1 && <span className="text-inverse-on-surface/40"> · </span>}
                  </span>
                ))}
              </p>
            </div>
          </div>

          {/* Feature list */}
          <div className="flex flex-col justify-center gap-6">
            {MCP_SECTION.features.map((f) => (
              <div key={f.text} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-inverse-on-surface/20 bg-inverse-on-surface/10">
                  <MaterialSymbol name={f.icon} className="!text-xl text-inverse-primary" />
                </div>
                <p className="pt-1.5 text-body-sm text-inverse-on-surface/85">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
