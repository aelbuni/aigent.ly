"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import {
  postComposerExportAction,
} from "@/app/actions/api-data";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stack = { id: number; slug: string; name: string; logoPath?: string | null; sortOrder: number; catalogStatus: string };
type Ide = { id: number; slug: string; name: string; sortOrder: number };

type ClaudeMode = "claude-md" | "skill-md";

// ─── Stack icon config ────────────────────────────────────────────────────────

const STACK_ICONS: Record<string, { logo?: string; initials: string; bg: string; text: string }> = {
  nextjs:      { logo: "/next.svg",  initials: "N",  bg: "bg-black",         text: "text-white" },
  express:     { initials: "Ex",  bg: "bg-slate-800",     text: "text-white" },
  fastapi:     { initials: "FA",  bg: "bg-emerald-700",   text: "text-white" },
  nestjs:      { initials: "Ne",  bg: "bg-red-700",       text: "text-white" },
  nuxt:        { initials: "Nx",  bg: "bg-green-600",     text: "text-white" },
  "react-spa": { initials: "R",   bg: "bg-sky-600",       text: "text-white" },
  django:      { initials: "Dj",  bg: "bg-green-800",     text: "text-white" },
  rails:       { initials: "Rb",  bg: "bg-red-600",       text: "text-white" },
  go:          { initials: "Go",  bg: "bg-cyan-700",      text: "text-white" },
  ios:         { initials: "iOS", bg: "bg-slate-700",     text: "text-white" },
  android:     { initials: "An",  bg: "bg-green-600",     text: "text-white" },
};

function StackIcon({ slug, selected }: { slug: string; selected: boolean }) {
  const cfg = STACK_ICONS[slug];
  if (cfg?.logo) {
    return (
      <span className={`flex h-8 w-8 items-center justify-center rounded-md ${selected ? "bg-white/20" : "bg-surface-container"}`}>
        <Image src={cfg.logo} alt="" width={22} height={22} className="object-contain" />
      </span>
    );
  }
  const { initials = "?", bg = "bg-slate-500", text = "text-white" } = cfg ?? {};
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold ${bg} ${text}`}>
      {initials}
    </span>
  );
}

// ─── IDE metadata ─────────────────────────────────────────────────────────────

const IDE_FILE_HINTS: Record<string, string> = {
  cursor: ".cursor/rules/aigently-{stack}-security.mdc",
  "claude-code": "CLAUDE.md",
  windsurf: ".windsurfrules",
  copilot: ".github/copilot-instructions.md",
  cline: ".clinerules",
};

const SKILL_FILE_HINT = "skills/aigently-{stack}-security/SKILL.md";

function getFileHint(ideSlug: string, stack: string, claudeMode: ClaudeMode): string {
  if (ideSlug === "claude-code" && claudeMode === "skill-md") {
    return SKILL_FILE_HINT.replace("{stack}", stack || "…");
  }
  const tpl = IDE_FILE_HINTS[ideSlug] ?? `${ideSlug}-rules.md`;
  return tpl.replace("{stack}", stack || "…");
}

// ─── Layer tier config ────────────────────────────────────────────────────────


// ─── Component ────────────────────────────────────────────────────────────────

export function ComposerPageClient({
  initialStacks,
  initialIdes,
}: {
  initialStacks: Stack[];
  initialIdes: Ide[];
}) {
  const [stackSlug, setStackSlug] = useState(initialStacks[0]?.slug ?? "");
  const [ideSlug, setIdeSlug] = useState(initialIdes[0]?.slug ?? "");
  const [claudeMode, setClaudeMode] = useState<ClaudeMode>("claude-md");
  const [selectedRuleType, setSelectedRuleType] = useState<"all" | "patterns" | "deps">("all");
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ content: string; filename: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const stackName = useMemo(() => initialStacks.find((s) => s.slug === stackSlug)?.name ?? stackSlug, [initialStacks, stackSlug]);
  const fileHint = useMemo(() => getFileHint(ideSlug, stackSlug, claudeMode), [ideSlug, stackSlug, claudeMode]);

  // ── Stack selection ───────────────────────────────────────────────────────────

  const selectStack = useCallback((slug: string) => {
    setStackSlug(slug);
    setStatus(null);
    setPreview(null);
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────────

  async function onGenerate() {
    if (!stackSlug || !ideSlug) {
      setStatus("Select a stack and IDE first.");
      return;
    }
    setExporting(true);
    setStatus(null);
    const mode = ideSlug === "claude-code" && claudeMode === "skill-md" ? "skill" : "rule";
    const res = await postComposerExportAction({ stackSlug, ideSlug, ruleType: selectedRuleType, mode });
    setExporting(false);
    if (!res.ok) {
      setStatus(res.error);
      return;
    }
    setPreview({
      content: res.data.content,
      filename: res.data.filename,
    });
    setStatus(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3500);
  }

  function onDownload() {
    if (!preview) return;
    const blob = new Blob([preview.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = preview.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onCopy() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-gutter pb-20 pt-10">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Rule Composer</h1>
        <p className="mt-2 max-w-2xl text-body-base text-on-surface-variant">
          Select your stack, IDE, and protection layers — get the right file, ready to paste.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* ── Left panel ─────────────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-7">

          {/* 01 Stack */}
          <Section step="01" title="Stack">
            {initialStacks.length === 0 ? (
              <p className="font-body-sm text-on-surface-variant">No stacks available. Ensure the database is seeded.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {initialStacks.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => void selectStack(s.slug)}
                    className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition-colors ${
                      stackSlug === s.slug
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant hover:border-primary/40 text-on-surface"
                    }`}
                  >
                    <StackIcon slug={s.slug} selected={stackSlug === s.slug} />
                    <span className="font-mono-label text-xs leading-tight">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* 02 IDE */}
          <Section step="02" title="IDE / Agent">
            {initialIdes.length === 0 ? (
              <p className="font-body-sm text-on-surface-variant">No IDEs available.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {initialIdes.map((ide) => (
                    <button
                      key={ide.slug}
                      type="button"
                      onClick={() => { setIdeSlug(ide.slug); setPreview(null); }}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                        ideSlug === ide.slug
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant hover:border-primary/40 text-on-surface"
                      }`}
                    >
                      <span className="font-mono-label text-sm">{ide.name}</span>
                    </button>
                  ))}
                </div>

                {/* Claude Code mode toggle */}
                {ideSlug === "claude-code" && (
                  <div className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3">
                    <span className="font-mono-label text-xs text-on-surface-variant mr-2">Output mode:</span>
                    <button
                      type="button"
                      onClick={() => { setClaudeMode("claude-md"); setPreview(null); }}
                      className={`rounded px-3 py-1.5 font-mono-label text-xs transition-colors ${
                        claudeMode === "claude-md"
                          ? "bg-primary text-on-primary"
                          : "border border-outline-variant text-on-surface hover:border-primary/40"
                      }`}
                    >
                      CLAUDE.md
                    </button>
                    <button
                      type="button"
                      onClick={() => { setClaudeMode("skill-md"); setPreview(null); }}
                      className={`rounded px-3 py-1.5 font-mono-label text-xs transition-colors ${
                        claudeMode === "skill-md"
                          ? "bg-primary text-on-primary"
                          : "border border-outline-variant text-on-surface hover:border-primary/40"
                      }`}
                    >
                      SKILL.md
                    </button>
                    <span className="ml-auto font-mono-label text-xs text-on-surface-variant">
                      {claudeMode === "skill-md" ? "Portable reusable skill" : "Project-level rules"}
                    </span>
                  </div>
                )}

                {/* File path hint */}
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <MaterialSymbol name="folder" className="!text-sm shrink-0" />
                  <code className="font-mono text-xs">{fileHint}</code>
                </div>
              </div>
            )}
          </Section>

          {/* 03 Rule Type */}
          <Section step="03" title="Rule Type">
            <div className="space-y-2">
              {(
                [
                  { value: "all",      label: "Both",         description: "Secure coding patterns + dependency alerts" },
                  { value: "patterns", label: "Patterns only", description: "ALWAYS/NEVER safe-coding directives — no dependency edits" },
                  { value: "deps",     label: "Deps only",     description: "Dependency vulnerability advisories — requires confirmation before upgrades" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    selectedRuleType === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="ruleType"
                    value={opt.value}
                    checked={selectedRuleType === opt.value}
                    onChange={() => setSelectedRuleType(opt.value)}
                    className="accent-primary"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono-label text-sm text-on-surface">{opt.label}</span>
                    <span className="block font-body-sm text-xs text-on-surface-variant">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>

          {/* 04 Generate */}
          <Section step="04" title="Generate">
            <div className="space-y-3">
              <p className="font-body-sm text-on-surface-variant">
                Merges all selected layers into a single{" "}
                <code className="font-mono text-xs">{fileHint.split("/").pop()}</code> file formatted for{" "}
                <strong>{initialIdes.find((i) => i.slug === ideSlug)?.name ?? ideSlug}</strong>.
              </p>
              <button
                type="button"
                disabled={exporting || !stackSlug || !ideSlug}
                onClick={() => void onGenerate()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                <MaterialSymbol name={exporting ? "sync" : "auto_awesome"} className={`!text-xl ${exporting ? "animate-spin" : ""}`} />
                {exporting ? "Generating…" : "Generate file"}
              </button>
              {status && (
                <p className="font-body-sm text-error">{status}</p>
              )}
            </div>
          </Section>
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────────── */}
        <aside className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-inverse-surface shadow-lg">
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-inverse-on-surface/20 px-4 py-2">
              <span className="font-mono-label text-xs text-inverse-primary">
                {preview ? preview.filename : fileHint.split("/").pop()}
              </span>
              <span className="font-mono-label text-xs text-inverse-on-surface/60">
                {preview ? `${preview.content.split("\n").length} lines` : "preview"}
              </span>
            </div>

            {/* Preview content */}
            <pre className="max-h-[420px] min-h-[200px] overflow-auto p-4 font-mono text-[12px] leading-relaxed text-inverse-on-surface">
              {preview ? (
                preview.content.slice(0, 8000) + (preview.content.length > 8000 ? "\n\n… (truncated)" : "")
              ) : (
                <span className="text-inverse-on-surface/40">
                  {stackSlug
                    ? [
                        `# aigently-${stackSlug}-security${ideSlug === "cursor" ? ".mdc" : ".md"}`,
                        `# Aigent.ly guardrails for ${stackName} · ${initialIdes.find((i) => i.slug === ideSlug)?.name ?? ideSlug}`,
                        `# ${selectedRuleType === "all" ? "patterns + deps" : selectedRuleType} rules`,
                        ``,
                        `→ Click "Generate file" to merge and export`,
                      ].join("\n")
                    : `# Select stack, IDE, and rule type\n# then click "Generate file"\n\nstack: …\nide: ${initialIdes.find((i) => i.slug === ideSlug)?.name ?? ideSlug}`}
                </span>
              )}
            </pre>
          </div>

          {/* Success banner */}
          {showSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary-fixed-dim/20 px-4 py-2.5 font-mono-label text-sm text-primary">
              <span>✓</span>
              <span>File ready — copy or download below, then paste into your IDE rules folder.</span>
            </div>
          )}

          {/* Actions */}
          {preview && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void onCopy()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 font-mono-label text-sm text-on-surface hover:border-primary/40 transition-colors"
              >
                <MaterialSymbol name={copied ? "check" : "content_copy"} className="!text-base" />
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-mono-label text-sm text-on-primary hover:bg-primary/90 transition-colors"
              >
                <MaterialSymbol name="download" className="!text-base" />
                Download
              </button>
            </div>
          )}

          {/* Coverage summary */}
          {preview && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-3">
              <p className="font-mono-label text-xs text-on-surface-variant uppercase tracking-wide">Coverage</p>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Stack" value={stackName} />
                <Stat label="IDE" value={initialIdes.find((i) => i.slug === ideSlug)?.name ?? ideSlug} />
                <Stat label="Type" value={selectedRuleType === "all" ? "patterns + deps" : selectedRuleType} />
                <Stat label="File" value={preview.filename} mono />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Small reusable sub-components ───────────────────────────────────────────

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="rounded bg-surface-container-highest px-2 py-1 font-mono-label text-xs text-on-surface-variant">
          {step}
        </span>
        <h2 className="text-base font-semibold text-on-surface">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-mono-label text-xs text-on-surface-variant">{label}</p>
      <p className={`truncate text-sm text-on-surface ${mono ? "font-mono" : "font-medium"}`}>{value}</p>
    </div>
  );
}

type ThreatMetaUI = { cveId: string | null; severity: string | null; name: string; sourceUrl?: string | null };
type LayerMetaUI = { layerSlug: string; layerName: string; threatCount: number; threats: ThreatMetaUI[] };

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function UniqueThreatsPanel({ layers }: { layers: LayerMetaUI[] }) {
  const [expanded, setExpanded] = useState(false);

  // Deduplicate across all layers by cveId (fall back to name for threats without CVE ID)
  const uniqueMap = new Map<string, ThreatMetaUI>();
  for (const layer of layers) {
    for (const t of layer.threats) {
      const key = t.cveId ?? t.name;
      if (!uniqueMap.has(key)) uniqueMap.set(key, t);
    }
  }
  const unique = [...uniqueMap.values()].sort(
    (a, b) => (SEV_ORDER[a.severity ?? ""] ?? 9) - (SEV_ORDER[b.severity ?? ""] ?? 9)
  );

  const critCount = unique.filter((t) => t.severity === "critical").length;
  const highCount = unique.filter((t) => t.severity === "high").length;
  const total = unique.length;

  return (
    <div className="border-t border-outline-variant/50 pt-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <p className="font-mono-label text-xs text-on-surface-variant uppercase tracking-wide">
          Threats covered
        </p>
        <span className="flex shrink-0 items-center gap-1.5">
          {critCount > 0 && (
            <span className="rounded-full bg-error/15 px-1.5 py-0.5 font-mono-label text-[10px] text-error">
              {critCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span className="rounded-full bg-tertiary-container/20 px-1.5 py-0.5 font-mono-label text-[10px] text-tertiary-container">
              {highCount} high
            </span>
          )}
          <span className="font-mono-label text-[10px] text-on-surface-variant">{total} unique CVEs</span>
          <MaterialSymbol
            name={expanded ? "expand_less" : "expand_more"}
            className="!text-sm text-on-surface-variant"
          />
        </span>
      </button>

      {expanded && (
        <div className="space-y-1 rounded-lg bg-surface-container p-2 max-h-64 overflow-y-auto">
          {unique.map((t) => {
            const key = t.cveId ?? t.name;
            const sevClass =
              t.severity === "critical"
                ? "text-error"
                : t.severity === "high"
                  ? "text-tertiary-container"
                  : "text-on-surface-variant";
            const label = t.cveId ?? "—";
            const href = t.sourceUrl ?? (t.cveId ? `https://nvd.nist.gov/vuln/detail/${t.cveId}` : null);
            return (
              <div key={key} className="flex items-start gap-2">
                <span className={`shrink-0 font-mono-label text-[10px] leading-4 ${sevClass}`}>
                  {(t.severity ?? "unknown").toUpperCase()}
                </span>
                <span className="font-mono text-[10px] leading-4 text-on-surface-variant min-w-0">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {label}
                    </a>
                  ) : (
                    <span>{label}</span>
                  )}
                  {" · "}
                  <span className="text-on-surface-variant">
                    {t.name.length > 65 ? t.name.slice(0, 65) + "…" : t.name}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
