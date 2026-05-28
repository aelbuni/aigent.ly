"use client";

import { useState } from "react";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { trackRuleUse } from "@/app/actions/rule-usage";

export function RuleCopyButton({ slug, bodyMdx }: { slug: string; bodyMdx?: string | null }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = bodyMdx ?? slug;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for non-secure contexts
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    void trackRuleUse([slug]);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-2 text-on-surface-variant hover:bg-surface-container"
      aria-label={copied ? "Copied!" : "Copy rule"}
      title={copied ? "Copied!" : "Copy rule body"}
    >
      <MaterialSymbol name={copied ? "check" : "content_copy"} className="!text-xl" />
    </button>
  );
}
