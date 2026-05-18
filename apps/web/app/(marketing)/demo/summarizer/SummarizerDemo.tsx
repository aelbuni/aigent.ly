"use client";

import { useRef, useState } from "react";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import type { LayerWithStats } from "@/lib/catalog-from-db";

type Stack = { slug: string; name: string; catalogStatus: string };

const RULE_TYPES = [
  { value: "all", label: "All" },
  { value: "pattern", label: "Patterns only" },
  { value: "deps", label: "Deps only" },
  { value: "config", label: "Config only" },
] as const;

// Marker used by streamSummarizer to signal a new layer section
const LAYER_MARKER_RE = /\x00LAYER:([^\x00]+)\x00/;

type LayerSection = { layerSlug: string; layerName: string; content: string };

type Props = {
  stacks: Stack[];
  layers: LayerWithStats[];
};

export function SummarizerDemo({ stacks, layers }: Props) {
  const [selectedStack, setSelectedStack] = useState("");
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState("all");
  const [sections, setSections] = useState<LayerSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentLayer, setCurrentLayer] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // Buffer for partial marker bytes across chunks
  const bufferRef = useRef("");
  // Track which layer we're currently writing to (also stored as ref for use inside async loop)
  const currentLayerRef = useRef<string>("");

  const canGenerate = selectedStack && selectedLayers.length > 0 && !isGenerating;

  function toggleLayer(slug: string) {
    setSelectedLayers((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function toggleSection(slug: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function appendToSection(layerSlug: string, chunk: string) {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.layerSlug === layerSlug);
      const layerName = layers.find((l) => l.slug === layerSlug)?.name ?? layerSlug;
      if (idx === -1) {
        return [...prev, { layerSlug, layerName, content: chunk }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], content: next[idx].content + chunk };
      return next;
    });
  }

  async function generate() {
    if (!canGenerate) return;
    setIsGenerating(true);
    setSections([]);
    setExpandedSections(new Set(selectedLayers));
    setError("");
    setCurrentLayer("");
    bufferRef.current = "";
    currentLayerRef.current = "";

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/summarize-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stackSlug: selectedStack,
          layerSlugs: selectedLayers,
          ruleType: selectedType,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        setError(text || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (!value) continue;

        // Accumulate into buffer and process markers
        bufferRef.current += decoder.decode(value, { stream: !done });

        let buf = bufferRef.current;
        let markerMatch: RegExpExecArray | null;

        while ((markerMatch = LAYER_MARKER_RE.exec(buf)) !== null) {
          const before = buf.slice(0, markerMatch.index);
          const newLayerSlug = markerMatch[1];
          buf = buf.slice(markerMatch.index + markerMatch[0].length);

          // Flush anything before the marker to the current layer
          if (before && currentLayerRef.current) {
            appendToSection(currentLayerRef.current, before);
          }

          currentLayerRef.current = newLayerSlug;
          setCurrentLayer(newLayerSlug);
        }

        // Check if buf might contain a partial marker at the end
        const partialMarkerStart = buf.lastIndexOf("\x00");
        if (partialMarkerStart !== -1 && !LAYER_MARKER_RE.test(buf)) {
          // Might be a partial marker — hold back the tail
          const safe = buf.slice(0, partialMarkerStart);
          if (safe && currentLayerRef.current) {
            appendToSection(currentLayerRef.current, safe);
          }
          bufferRef.current = buf.slice(partialMarkerStart);
        } else {
          if (buf && currentLayerRef.current) {
            appendToSection(currentLayerRef.current, buf);
          }
          bufferRef.current = "";
        }
      }

      // Flush any remaining buffer
      if (bufferRef.current && currentLayerRef.current) {
        appendToSection(currentLayerRef.current, bufferRef.current);
        bufferRef.current = "";
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Generation failed");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyAll() {
    const text = sections.map((s) => `## ${s.layerName}\n\n${s.content}`).join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
  }

  function downloadAll() {
    const text = sections.map((s) => `## ${s.layerName}\n\n${s.content}`).join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aigently-${selectedStack}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stackName = stacks.find((s) => s.slug === selectedStack)?.name ?? "";
  const totalSelectedRules = layers
    .filter((l) => selectedLayers.includes(l.slug))
    .reduce((sum, l) => sum + l.ruleCount, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      {/* Left — configuration */}
      <div className="space-y-6">
        {/* Step 1: Stack */}
        <section>
          <h2 className="mb-3 font-mono-label text-sm text-on-surface-variant">
            1 — Pick your stack
          </h2>
          <div className="flex flex-wrap gap-2">
            {stacks.map((s) => (
              <button
                key={s.slug}
                onClick={() => { setSelectedStack(s.slug); setSelectedLayers([]); }}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  selectedStack === s.slug
                    ? "bg-primary text-white"
                    : "border border-outline-variant text-on-surface hover:bg-surface-container-low"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: Layers */}
        <section>
          <h2 className="mb-3 font-mono-label text-sm text-on-surface-variant">
            2 — Choose protection layers
            {totalSelectedRules > 0 && (
              <span className="ml-2 text-primary">{totalSelectedRules} rules selected</span>
            )}
          </h2>
          <div className="flex flex-wrap gap-2">
            {layers.map((l) => {
              const active = selectedLayers.includes(l.slug);
              return (
                <button
                  key={l.slug}
                  onClick={() => toggleLayer(l.slug)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "border border-outline-variant text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  {l.name}
                  {l.ruleCount > 0 && (
                    <span className="ml-1.5 opacity-70 text-xs">×{l.ruleCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3: Rule type */}
        <section>
          <h2 className="mb-3 font-mono-label text-sm text-on-surface-variant">
            3 — Rule type (optional)
          </h2>
          <div className="flex flex-wrap gap-2">
            {RULE_TYPES.map((t) => (
              <label key={t.value} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="ruleType"
                  value={t.value}
                  checked={selectedType === t.value}
                  onChange={() => setSelectedType(t.value)}
                  className="accent-primary"
                />
                <span className="text-sm text-on-surface">{t.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={!canGenerate}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-opacity ${
            canGenerate
              ? "bg-primary text-white hover:opacity-90"
              : "cursor-not-allowed bg-surface-container text-on-surface-variant"
          }`}
        >
          {isGenerating ? (
            <>
              <MaterialSymbol name="sync" className="!text-base animate-spin" />
              Generating {selectedLayers.length} layer{selectedLayers.length !== 1 ? "s" : ""}…
            </>
          ) : (
            <>
              <MaterialSymbol name="auto_awesome" className="!text-base" />
              Generate Guardrail →
            </>
          )}
        </button>

        {!selectedStack && (
          <p className="text-center text-xs text-on-surface-variant">
            Select a stack and at least one layer to begin.
          </p>
        )}
      </div>

      {/* Right — per-layer output */}
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {(sections.length > 0 || isGenerating) && (
          <div className="flex items-center justify-between">
            <span className="font-mono-label text-xs text-on-surface-variant">
              {stackName} · {sections.length} / {selectedLayers.length} layer{selectedLayers.length !== 1 ? "s" : ""}
            </span>
            {sections.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={copyAll}
                  className="flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low"
                >
                  <MaterialSymbol name="content_copy" className="!text-sm" />
                  Copy all
                </button>
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low"
                >
                  <MaterialSymbol name="download" className="!text-sm" />
                  Download
                </button>
              </div>
            )}
          </div>
        )}

        {/* Per-layer accordions */}
        {sections.length === 0 && !isGenerating && !error && (
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">
            Your generated guardrail will appear here, one section per layer.
          </div>
        )}

        {isGenerating && sections.length === 0 && (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest p-8 text-sm text-on-surface-variant">
            <div className="flex items-center gap-2">
              <MaterialSymbol name="hourglass_top" className="!text-base animate-pulse" />
              Composing layer summaries…
            </div>
          </div>
        )}

        <div className="space-y-2">
          {sections.map((section) => (
            <div key={section.layerSlug} className="rounded-lg border border-outline-variant overflow-hidden">
              <button
                onClick={() => toggleSection(section.layerSlug)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-surface-container-low"
              >
                <span className="font-medium text-on-surface">{section.layerName}</span>
                <MaterialSymbol
                  name={expandedSections.has(section.layerSlug) ? "expand_less" : "expand_more"}
                  className="!text-base text-on-surface-variant"
                />
              </button>
              {expandedSections.has(section.layerSlug) && (
                <div className="border-t border-outline-variant bg-surface-container-lowest p-4">
                  <pre className="whitespace-pre-wrap break-words font-mono-data text-xs text-on-surface leading-relaxed">
                    {section.content}
                    {isGenerating && currentLayer === section.layerSlug && (
                      <span className="animate-pulse">▌</span>
                    )}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
