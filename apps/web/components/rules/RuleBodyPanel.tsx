"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export type RuleBodyViewMode = "raw" | "preview";

function resolveMode(searchParams: URLSearchParams, initialView: RuleBodyViewMode): RuleBodyViewMode {
  const v = searchParams.get("view");
  if (v === "preview") return "preview";
  if (v === "raw") return "raw";
  return initialView;
}

const ARTICLE_PROSE =
  "rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-body-sm text-on-surface [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:border [&_code]:border-outline-variant [&_code]:bg-surface-container [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono-data [&_code]:text-sm [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:first:mt-0 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-outline-variant [&_pre]:bg-surface-container [&_pre]:p-4 [&_strong]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-outline-variant [&_td]:p-2 [&_th]:border [&_th]:border-outline-variant [&_th]:p-2 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6";

export function RuleBodyPanel({
  body,
  summaryMdx,
  initialView,
}: {
  body: string;
  summaryMdx?: string | null;
  initialView: RuleBodyViewMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = resolveMode(searchParams, initialView);

  const display = body.trim() ? body : "_No body stored for this rule._";
  const canCopy = body.trim().length > 0;
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyRuleBody = useCallback(async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 2000);
    } catch {
      /* clipboard may be denied in non-secure contexts */
    }
  }, [body, canCopy]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  function setMode(next: RuleBodyViewMode) {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "raw") p.delete("view");
    else p.set("view", next);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rule body view">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "raw"}
            onClick={() => setMode("raw")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono-label text-sm transition-colors ${
              mode === "raw"
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <MaterialSymbol name="code" className="!text-lg shrink-0" />
            Raw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            onClick={() => setMode("preview")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono-label text-sm transition-colors ${
              mode === "preview"
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <MaterialSymbol name="article" className="!text-lg shrink-0" />
            Preview
          </button>
        </div>
        <button
          type="button"
          disabled={!canCopy}
          onClick={() => void copyRuleBody()}
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 font-mono-label text-sm text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={copied ? "Rule body copied" : "Copy rule body to clipboard"}
        >
          <MaterialSymbol name={copied ? "check" : "content_copy"} className="!text-lg shrink-0" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {summaryMdx?.trim() && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary-fixed-dim/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <MaterialSymbol name="auto_awesome" className="!text-lg shrink-0 text-primary" />
            <span className="font-mono-label text-sm text-primary">AI Summary</span>
          </div>
          <article className={ARTICLE_PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {summaryMdx}
            </ReactMarkdown>
          </article>
        </div>
      )}

      <details className="group" open={!summaryMdx?.trim()}>
        <summary className="mb-3 cursor-pointer select-none list-none font-mono-label text-sm text-on-surface-variant hover:text-on-surface [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1">
            <MaterialSymbol
              name="expand_more"
              className="!text-lg shrink-0 transition-transform group-open:rotate-180"
            />
            {summaryMdx?.trim() ? "View all CVE patterns" : "Rule body"}
          </span>
        </summary>

        {mode === "raw" ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-outline-variant bg-surface-container-lowest p-6 font-mono-data text-sm text-on-surface">
            {display}
          </pre>
        ) : (
          <article className={ARTICLE_PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {display}
            </ReactMarkdown>
          </article>
        )}
      </details>
    </div>
  );
}
