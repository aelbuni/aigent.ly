import Link from "next/link";
import { BrainCircuit } from "lucide-react";

import { LLM_REF_LABELS } from "@/lib/threats-showcase";

const AI_LLM_PACKAGES = [
  "langchain", "langchain-community", "langchain-core",
  "llama-index", "llama-index-core", "llama-cpp-python",
  "transformers", "huggingface_hub", "vllm", "gradio",
  "ollama", "anthropic", "openai", "pydantic-ai",
  "crewai", "autogen-agentchat", "dspy-ai",
];

type LlmBreakdownEntry = { ref: string; label: string; count: number };

interface Props {
  stackName: string;
  threatCount: number;
  llmBreakdown: LlmBreakdownEntry[];
  exampleGuardrail?: string | null;
  rulesHref: string;
}

export function StackLlmOverview({
  stackName,
  threatCount,
  llmBreakdown,
  exampleGuardrail,
  rulesHref,
}: Props) {
  const hasBreakdown = llmBreakdown.some((e) => e.count > 0);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex items-start gap-4 rounded-xl border border-purple-400/30 bg-purple-500/5 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-purple-400/40 bg-purple-500/10">
          <BrainCircuit className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-on-surface">{stackName} Security</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Coverage for LangChain, LlamaIndex, Hugging Face transformers, vLLM, Ollama, and 10+ AI frameworks.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 font-mono-label text-xs text-purple-700 dark:text-purple-300">
              {threatCount} threats
            </span>
            <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 font-mono-label text-xs text-purple-700 dark:text-purple-300">
              OWASP LLM Top 10
            </span>
          </div>
        </div>
      </div>

      {/* OWASP LLM breakdown */}
      <section>
        <h2 className="mb-4 font-mono-label text-on-surface-variant">OWASP LLM Top 10 coverage</h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant">
          {hasBreakdown ? (
            <ul className="divide-y divide-outline-variant">
              {llmBreakdown.map((entry) => (
                <li key={entry.ref} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 rounded border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-center font-mono-data text-xs text-purple-700 dark:text-purple-300">
                      {entry.ref}
                    </span>
                    <span className="text-sm text-on-surface">{entry.label}</span>
                  </div>
                  <span className={`font-mono-data text-sm font-semibold tabular-nums ${entry.count > 0 ? "text-purple-700 dark:text-purple-300" : "text-on-surface-variant/40"}`}>
                    {entry.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-on-surface-variant">
              <p>LLM threat breakdown populates on next catalog sync.</p>
              <p className="mt-1 text-xs text-on-surface-variant/60">
                Threats are ingested daily — check back after the next pipeline run.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Example guardrail */}
      {exampleGuardrail && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono-label text-on-surface-variant">Example guardrail</h2>
            <Link href={rulesHref} className="font-mono-label text-xs text-primary hover:underline">
              View all rules →
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-low p-5 font-mono-data text-xs leading-relaxed text-on-surface">
            {exampleGuardrail}
          </pre>
        </section>
      )}

      {/* Packages covered */}
      <section>
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low px-5 py-3 hover:bg-surface-container">
              <h2 className="font-mono-label text-on-surface-variant">
                Packages covered ({AI_LLM_PACKAGES.length})
              </h2>
              <span className="font-mono-label text-xs text-primary group-open:hidden">Show ↓</span>
              <span className="hidden font-mono-label text-xs text-primary group-open:inline">Hide ↑</span>
            </div>
          </summary>
          <div className="mt-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="flex flex-wrap gap-2">
              {AI_LLM_PACKAGES.map((pkg) => (
                <span key={pkg} className="rounded border border-outline-variant bg-surface-container px-2 py-1 font-mono-data text-xs text-on-surface-variant">
                  {pkg}
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
