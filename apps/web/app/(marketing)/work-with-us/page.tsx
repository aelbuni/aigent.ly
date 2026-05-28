import type { Metadata } from "next";
import Link from "next/link";
import { MaterialSymbol } from "@/components/MaterialSymbol";

export const metadata: Metadata = {
  title: "Contribute | Aigent.ly",
  description:
    "Help make AI-generated code safer. Contribute a stack, sharpen CVE patterns, or improve the MCP server — the catalog is fully open source.",
};

export default function ContributePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-gutter">
      {/* Header */}
      <div className="mb-12">
        <span className="mb-4 inline-block font-mono-label text-xs uppercase tracking-widest text-primary">
          Open Source
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
          Contribute to Aigent.ly
        </h1>
        <p className="mt-4 text-lg text-on-surface-variant">
          The catalog, pipeline, and MCP server are fully open source. Help make AI-generated code safer for
          everyone — no permission needed, just a PR.
        </p>
        <a
          href="https://github.com/aelbuni/aigently-catalog"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90"
        >
          <MaterialSymbol name="open_in_new" className="!text-base" />
          Open on GitHub
        </a>
      </div>

      {/* Ways to contribute */}
      <div className="space-y-6">
        {[
          {
            icon: "layers" as const,
            title: "Add a stack",
            body: "Add a new tech stack to the registry. We need Go, Django, Rails, iOS, and Android fully guardrailed — each needs CVE coverage, rule patterns, and synthesized guardrails.",
            href: "https://github.com/aelbuni/aigently-catalog/blob/main/packages/mvp-catalog/src/stack-registry.ts",
            cta: "View stack registry →",
          },
          {
            icon: "crisis_alert" as const,
            title: "Improve CVE patterns",
            body: "Sharpen the ALWAYS/NEVER patterns for existing CVEs. Edit mustLines, ruleContext, or alwaysPin in seed-master.json to make rules more precise and actionable.",
            href: "https://github.com/aelbuni/aigently-catalog/blob/main/CONTRIBUTING.md",
            cta: "Read contributing guide →",
          },
          {
            icon: "hub" as const,
            title: "Improve the MCP server",
            body: "The MCP server is how your IDE consumes the catalog. Better tool descriptions, smarter stack detection, or new tools — PRs welcome.",
            href: "https://github.com/aelbuni/aigently-catalog/tree/main/packages/mcp-server",
            cta: "Browse mcp-server source →",
          },
          {
            icon: "bug_report" as const,
            title: "Report a bad rule",
            body: "If an ALWAYS/NEVER directive is wrong, too generic, or contradicts another rule — open an issue. Rule quality is the product.",
            href: "https://github.com/aelbuni/aigently-catalog/issues/new",
            cta: "Open an issue →",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container">
                <MaterialSymbol name={item.icon} className="!text-xl text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-on-surface">{item.title}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{item.body}</p>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 font-mono-label text-xs text-primary hover:underline"
                >
                  {item.cta}
                  <MaterialSymbol name="open_in_new" className="!text-xs" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary CTA */}
      <div className="mt-12 rounded-xl border border-primary/30 bg-primary-fixed-dim/10 p-6">
        <p className="font-mono-label text-xs uppercase tracking-widest text-primary">For teams</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Need help rolling out Aigent.ly across an engineering team, or want custom rules for your internal stack?
          Reach out directly.
        </p>
        <a
          href="mailto:hello@aigent.ly"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <MaterialSymbol name="mail" className="!text-base" />
          hello@aigent.ly
        </a>
      </div>

      {/* Learn link */}
      <p className="mt-8 text-sm text-on-surface-variant">
        Want to understand the threat model first?{" "}
        <Link href="/learn" className="text-primary hover:underline">
          Read the security guide →
        </Link>
      </p>
    </div>
  );
}
