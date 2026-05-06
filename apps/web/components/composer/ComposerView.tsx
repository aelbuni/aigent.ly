"use client";

import type { components } from "@aigently/api-client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  listIdesAction,
  listPolicyTemplatesForStackAction,
  listRulesPreviewAction,
  listStacksAction,
  postComposerExportAction,
} from "@/app/actions/api-data";
import { MaterialSymbol } from "@/components/MaterialSymbol";

type Stack = components["schemas"]["Stack"];
type Ide = components["schemas"]["Ide"];
type Rule = components["schemas"]["Rule"];
type RuleLayer = components["schemas"]["RuleLayer"];
type PolicyTemplate = components["schemas"]["PolicyTemplate"];

type PolicyCard = { id: string; label: string; layers: RuleLayer[] };

const STATIC_SECURITY_FALLBACK: PolicyCard[] = [
  { id: "owasp", label: "OWASP Top 10 Patterns", layers: ["security"] },
  { id: "cred", label: "Credential leak prevention", layers: ["security"] },
  { id: "supply", label: "Supply chain integrity", layers: ["architecture"] },
];

const QUALITY_POLICIES: PolicyCard[] = [
  { id: "ts", label: "Strict TypeScript rules", layers: ["code_quality"] },
  { id: "vitest", label: "Vitest coverage min. 80%", layers: ["code_quality"] },
  { id: "perf", label: "Performance budgeting", layers: ["architecture"] },
];

function buildSecurityCards(templates: PolicyTemplate[]): PolicyCard[] {
  const fromDb = templates
    .filter((t) => t.layer === "security")
    .map((t) => ({ id: t.slug, label: t.name, layers: ["security"] as RuleLayer[] }));
  return fromDb.length > 0 ? fromDb : STATIC_SECURITY_FALLBACK;
}

function layersFromPolicies(selected: Set<string>, security: PolicyCard[]): RuleLayer[] | undefined {
  if (selected.size === 0) return undefined;
  const out = new Set<RuleLayer>();
  for (const p of [...security, ...QUALITY_POLICIES]) {
    if (selected.has(p.id)) for (const L of p.layers) out.add(L);
  }
  return out.size ? [...out] : undefined;
}

export function ComposerView({
  initialStacks,
  initialIdes,
  initialPreview,
  initialPolicyTemplates = [],
}: {
  initialStacks: Stack[];
  initialIdes: Ide[];
  initialPreview: Rule[];
  initialPolicyTemplates?: PolicyTemplate[];
}) {
  const [stacks, setStacks] = useState(initialStacks);
  const [ides, setIdes] = useState(initialIdes);
  const [stackSlug, setStackSlug] = useState(initialStacks[0]?.slug ?? "");
  const [ideSlug, setIdeSlug] = useState(initialIdes[0]?.slug ?? "");
  const [securityPolicies, setSecurityPolicies] = useState<PolicyCard[]>(() =>
    buildSecurityCards(initialPolicyTemplates)
  );
  const [policies, setPolicies] = useState<Set<string>>(() => {
    const sec = buildSecurityCards(initialPolicyTemplates);
    const pick = sec.slice(0, 2).map((p) => p.id);
    return new Set([...pick, "ts"]);
  });
  const [preview, setPreview] = useState<Rule[]>(initialPreview);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (initialStacks.length > 0 && initialIdes.length > 0) return;
    void (async () => {
      const [s, i] = await Promise.all([listStacksAction(), listIdesAction()]);
      setStacks(s);
      setIdes(i);
      setStackSlug((cur) => cur || s[0]?.slug || "");
      setIdeSlug((cur) => cur || i[0]?.slug || "");
    })();
  }, [initialStacks.length, initialIdes.length]);

  async function selectStack(slug: string) {
    setStackSlug(slug);
    setStatus(null);
    const [rows, tpl] = await Promise.all([
      listRulesPreviewAction(slug, 8),
      listPolicyTemplatesForStackAction(slug),
    ]);
    setPreview(rows);
    const cards = buildSecurityCards(tpl);
    setSecurityPolicies(cards);
    setPolicies(new Set([...cards.slice(0, 2).map((c) => c.id), "ts"]));
  }

  function togglePolicy(id: string) {
    setPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const exportLayers = useMemo(
    () => layersFromPolicies(policies, securityPolicies),
    [policies, securityPolicies]
  );

  const previewYaml = useMemo(() => {
    const stackName = stacks.find((s) => s.slug === stackSlug)?.name ?? stackSlug;
    const ideName = ides.find((i) => i.slug === ideSlug)?.name ?? ideSlug;
    const layerLine =
      exportLayers && exportLayers.length > 0 ? `[${exportLayers.join(", ")}]` : "[all matching layers]";
    const lines = [
      "# .cursorrules — live preview",
      `stack: ${stackName}`,
      `agent: ${ideName}`,
      `policies: ${layerLine}`,
      "",
      "rules:",
      ...preview.slice(0, 4).map((r) => `  - id: ${r.slug}`),
      preview.length > 4 ? "  # …" : "",
    ].filter(Boolean);
    return lines.join("\n");
  }, [stackSlug, ideSlug, stacks, ides, preview, exportLayers]);

  async function onExport() {
    if (!stackSlug || !ideSlug) {
      setStatus("Select a stack and IDE.");
      return;
    }
    setExporting(true);
    setStatus(null);
    const res = await postComposerExportAction({
      stackSlug,
      ideSlug,
      layers: exportLayers,
    });
    setExporting(false);
    if (!res.ok) {
      setStatus(res.error);
      return;
    }
    const blob = new Blob([res.data.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Download started.");
  }

  const moreStacksLabel =
    stacks.length > 5
      ? stacks
          .slice(5)
          .map((s) => s.name)
          .join(", ")
      : "Django, NestJS, Laravel, Phoenix, Gin…";

  return (
    <div className="mx-auto max-w-7xl px-gutter pb-20 pt-10">
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Rule Composer</h1>
        <p className="mt-2 max-w-2xl text-body-base text-on-surface-variant">
          Build your security ruleset in seconds with technical precision.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
            <div className="mb-6 flex items-center gap-2">
              <span className="rounded bg-surface-container-highest px-2 py-1 font-mono-label text-on-surface-variant">
                01
              </span>
              <h2 className="text-lg font-semibold text-on-surface">Selection stack</h2>
            </div>
            {stacks.length === 0 ? (
              <p className="font-body-sm text-on-surface-variant">
                No stacks from API. Seed the database and set <code className="font-mono">INTERNAL_API_URL</code>.
              </p>
            ) : (
              <>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {stacks.slice(0, 6).map((s) => {
                    const active = stackSlug === s.slug;
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => void selectStack(s.slug)}
                        className={`flex min-w-[100px] shrink-0 flex-col items-center justify-center rounded-lg border p-4 transition-colors ${
                          active
                            ? "border-primary bg-primary-fixed-dim/20 text-primary"
                            : "border-outline-variant hover:border-primary/50"
                        }`}
                      >
                        <MaterialSymbol name="layers" className="mb-2 !text-2xl" />
                        <span className="font-mono-label text-center leading-tight">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 font-body-sm text-on-surface-variant">
                  <span className="font-mono-label text-on-surface-variant">More stacks:</span> {moreStacksLabel}
                </p>
              </>
            )}
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
            <div className="mb-6 flex items-center gap-2">
              <span className="rounded bg-surface-container-highest px-2 py-1 font-mono-label text-on-surface-variant">
                02
              </span>
              <h2 className="text-lg font-semibold text-on-surface">IDE / Intelligence agent</h2>
            </div>
            {ides.length === 0 ? (
              <p className="font-body-sm text-on-surface-variant">No IDEs from API.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ides.map((ide) => {
                  const active = ideSlug === ide.slug;
                  return (
                    <button
                      key={ide.slug}
                      type="button"
                      onClick={() => setIdeSlug(ide.slug)}
                      className={`rounded-lg border px-4 py-3 text-left font-mono-data transition-colors ${
                        active
                          ? "border-primary bg-primary-fixed-dim/15 text-primary"
                          : "border-outline-variant hover:border-primary/50"
                      }`}
                    >
                      {ide.name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
            <div className="mb-6 flex items-center gap-2">
              <span className="rounded bg-surface-container-highest px-2 py-1 font-mono-label text-on-surface-variant">
                03
              </span>
              <h2 className="text-lg font-semibold text-on-surface">Policy layers</h2>
            </div>
            <p className="mb-6 font-body-sm text-on-surface-variant">
              When none selected, export includes all rules for stack+IDE. When policies are selected, each rule must
              include every derived guardrail layer.
            </p>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-mono-label text-tertiary-container">Security &amp; risk</h3>
                <div className="space-y-2">
                  {securityPolicies.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 font-mono-data text-on-surface">
                      <input
                        type="checkbox"
                        checked={policies.has(p.id)}
                        onChange={() => togglePolicy(p.id)}
                        className="rounded border-outline"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-mono-label text-primary">Quality &amp; testing</h3>
                <div className="space-y-2">
                  {QUALITY_POLICIES.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 font-mono-data text-on-surface">
                      <input
                        type="checkbox"
                        checked={policies.has(p.id)}
                        onChange={() => togglePolicy(p.id)}
                        className="rounded border-outline"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-5">
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-inverse-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-inverse-on-surface/20 px-4 py-2 font-mono-label text-inverse-primary">
              <span>.cursorrules</span>
              <span className="text-inverse-on-surface/70">YAML · live preview</span>
            </div>
            <pre className="max-h-[320px] overflow-auto p-4 font-mono text-[13px] leading-relaxed text-inverse-on-surface">
              {previewYaml}
            </pre>
          </div>

          {stackSlug === "nextjs" ? (
            <div className="flex gap-3 rounded-xl border border-error/40 bg-error-container/25 p-4">
              <MaterialSymbol name="priority_high" className="shrink-0 text-error" />
              <p className="text-body-sm text-on-error-container">
                <span className="font-semibold">Critical requirement:</span> Your Next.js stack requires strict
                environment variable checking enabled for production rules.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={exporting || !stackSlug || !ideSlug}
              onClick={() => void onExport()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-50"
            >
              <MaterialSymbol name="download" className="!text-xl" />
              {exporting ? "Exporting…" : "Export ruleset (.cursorrules)"}
            </button>
            <Link
              href="/rules"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 font-semibold text-on-surface hover:border-primary"
            >
              Save to library
            </Link>
          </div>

          {status ? <p className="font-body-sm text-on-surface-variant">{status}</p> : null}

          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/80 p-6 text-center">
            <p className="font-mono-label text-on-surface-variant">Rules preview</p>
            <ul className="mt-4 space-y-2 border-t border-outline-variant pt-4 text-left">
              {preview.length === 0 ? (
                <li className="font-body-sm text-on-surface-variant">No rules yet for this stack.</li>
              ) : (
                preview.map((r) => (
                  <li key={r.id}>
                    <Link href={`/rules/${encodeURIComponent(r.slug)}`} className="font-mono-data text-primary hover:underline">
                      {r.slug}
                    </Link>
                    <span className="font-body-sm text-on-surface-variant"> — {r.name}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <Link href="/rules" className="inline-flex text-sm font-medium text-primary hover:underline">
            Browse rules directory
          </Link>
        </aside>
      </div>
    </div>
  );
}
