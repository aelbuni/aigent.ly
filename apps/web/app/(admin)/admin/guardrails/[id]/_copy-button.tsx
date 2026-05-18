"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-dark-6 hover:text-primary flex items-center gap-1.5 text-xs font-medium transition-colors"
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          Copy
        </>
      )}
    </button>
  );
}
