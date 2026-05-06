"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

export function RuleBodyPanel({
  body,
  initialView,
}: {
  body: string;
  initialView: RuleBodyViewMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = resolveMode(searchParams, initialView);

  const display = body.trim() ? body : "_No body stored for this rule._";

  function setMode(next: RuleBodyViewMode) {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "raw") p.delete("view");
    else p.set("view", next);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Rule body view">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "raw"}
          onClick={() => setMode("raw")}
          className={`rounded-lg px-4 py-2 font-mono-label text-sm transition-colors ${
            mode === "raw"
              ? "bg-primary text-on-primary"
              : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          Raw
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "preview"}
          onClick={() => setMode("preview")}
          className={`rounded-lg px-4 py-2 font-mono-label text-sm transition-colors ${
            mode === "preview"
              ? "bg-primary text-on-primary"
              : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          Preview
        </button>
      </div>

      {mode === "raw" ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-outline-variant bg-surface-container-lowest p-6 font-mono-data text-sm text-on-surface">
          {display}
        </pre>
      ) : (
        <article className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-body-sm text-on-surface [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:border [&_code]:border-outline-variant [&_code]:bg-surface-container [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono-data [&_code]:text-sm [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:first:mt-0 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-outline-variant [&_pre]:bg-surface-container [&_pre]:p-4 [&_strong]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-outline-variant [&_td]:p-2 [&_th]:border [&_th]:border-outline-variant [&_th]:p-2 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {display}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
}
