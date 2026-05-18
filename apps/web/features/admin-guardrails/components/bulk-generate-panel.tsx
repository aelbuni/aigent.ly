"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle, Loader2, RefreshCw, XCircle, Zap } from "lucide-react";

type Mode = "empty" | "stale" | "all";

type ProgressEvent = {
  type: "progress";
  index: number;
  total: number;
  stackName: string;
  layerName: string;
  status: "ok" | "skip" | "error";
  ruleCount: number;
  elapsed: number;
  error?: string;
};

type LogEntry = Pick<ProgressEvent, "stackName" | "layerName" | "status">;

type RunState =
  | { phase: "idle" }
  | { phase: "counting" }
  | { phase: "running"; toProcess: number; alreadyFilled: number; noRules: number; processed: number; current: string; elapsed: number; log: LogEntry[] }
  | { phase: "done"; generated: number; skipped: number; noRules: number; errors: string[]; elapsed: number }
  | { phase: "error"; message: string };

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtEta(elapsedMs: number, processed: number, total: number) {
  if (processed < 2) return null;
  const avgMs = elapsedMs / processed;
  const remaining = total - processed;
  const etaMs = avgMs * remaining;
  return fmtElapsed(etaMs);
}

const MODE_LABELS: Record<Mode, { label: string; desc: string; icon: React.ReactNode }> = {
  empty: {
    label: "Fill empty",
    desc: "Generates only missing guardrails — won't touch existing ones",
    icon: <Zap className="size-4" />,
  },
  stale: {
    label: "Refresh stale",
    desc: "Regenerates expired entries and fills any missing ones",
    icon: <RefreshCw className="size-4" />,
  },
  all: {
    label: "Regenerate all",
    desc: "Forces LLM regeneration of every stack × layer pair",
    icon: <RefreshCw className="size-4 text-destructive" />,
  },
};

export function BulkGeneratePanel() {
  const router = useRouter();
  const [state, setState] = useState<RunState>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function startRun(mode: Mode) {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setState({ phase: "counting" });

    try {
      const res = await fetch(`/api/admin/guardrails/bulk-generate?mode=${mode}`, {
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        setState({ phase: "error", message: text || "Request failed" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));

            if (ev.type === "start") {
              setState({
                phase: "running",
                toProcess: ev.toProcess,
                alreadyFilled: ev.alreadyFilled ?? 0,
                noRules: ev.noRules ?? 0,
                processed: 0,
                current: ev.toProcess === 0 ? "Nothing to generate" : "Starting…",
                elapsed: 0,
                log: [],
              });
            } else if (ev.type === "progress") {
              const entry: LogEntry = {
                stackName: ev.stackName,
                layerName: ev.layerName,
                status: ev.status,
              };
              setState((prev) => {
                if (prev.phase !== "running") return prev;
                const log = [entry, ...prev.log].slice(0, 3);
                return {
                  ...prev,
                  processed: ev.index,
                  current: `${ev.stackName} · ${ev.layerName}`,
                  elapsed: ev.elapsed,
                  log,
                };
              });
            } else if (ev.type === "done") {
              setState({
                phase: "done",
                generated: ev.generated,
                skipped: ev.skipped,
                noRules: ev.noRules ?? 0,
                errors: ev.errors,
                elapsed: ev.elapsed,
              });
              router.refresh();
            } else if (ev.type === "error") {
              setState({ phase: "error", message: ev.message });
            }
          } catch {
            // malformed line — skip
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const isRunning = state.phase === "counting" || state.phase === "running";

  return (
    <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark sm:p-6 space-y-4">
      <h2 className="text-dark text-base font-semibold dark:text-white">Bulk generate</h2>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {(["empty", "stale", "all"] as Mode[]).map((mode) => {
          const { label, desc, icon } = MODE_LABELS[mode];
          return (
            <div key={mode} className="flex flex-col gap-1">
              <button
                onClick={() => startRun(mode)}
                disabled={isRunning}
                className="border-stroke text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white inline-flex items-center gap-2 rounded border bg-white px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {icon}
                {label}
              </button>
              <p className="text-dark-6 max-w-[180px] text-xs">{desc}</p>
            </div>
          );
        })}
      </div>

      {/* Progress area */}
      {state.phase === "counting" && (
        <div className="flex items-center gap-2 text-sm text-dark-6 dark:text-dark-6">
          <Loader2 className="size-4 animate-spin" />
          Counting pairs…
        </div>
      )}

      {state.phase === "running" && (
        <div className="space-y-3">
          {/* Context row: already-filled and no-rules skipped pairs */}
          {(state.alreadyFilled > 0 || state.noRules > 0) && (
            <p className="text-dark-6 text-xs">
              {[
                state.alreadyFilled > 0 && `${state.alreadyFilled} already up-to-date`,
                state.noRules > 0 && `${state.noRules} pairs have no rules yet`,
              ].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Nothing to generate */}
          {state.toProcess === 0 ? (
            <p className="text-dark-6 text-sm">All guardrails are already up-to-date.</p>
          ) : (
            <>
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-dark-6">
                  <span>{state.current}</span>
                  <span>{state.processed} / {state.toProcess}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-2 dark:bg-dark-2">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(state.processed / state.toProcess) * 100}%` }}
                  />
                </div>
              </div>

              {/* Timing */}
              <div className="flex gap-4 text-xs text-dark-6">
                <span>{fmtElapsed(state.elapsed)} elapsed</span>
                {fmtEta(state.elapsed, state.processed, state.toProcess) && (
                  <span>~{fmtEta(state.elapsed, state.processed, state.toProcess)} remaining</span>
                )}
              </div>
            </>
          )}

          {/* Recent log */}
          {state.log.length > 0 && (
            <ul className="space-y-1">
              {state.log.map((entry, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-dark-6">
                  {entry.status === "ok" ? (
                    <CheckCircle className="size-3.5 shrink-0 text-emerald-500" />
                  ) : entry.status === "error" ? (
                    <XCircle className="size-3.5 shrink-0 text-destructive" />
                  ) : (
                    <span className="size-3.5 shrink-0 rounded-full border border-dark-5" />
                  )}
                  {entry.stackName} · {entry.layerName}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.phase === "done" && (
        <div className="flex items-start gap-3 rounded border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950/30">
          <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div className="flex-1 space-y-0.5 text-xs text-emerald-800 dark:text-emerald-300">
            <p className="font-medium">Done in {fmtElapsed(state.elapsed)}</p>
            <p>
              Generated {state.generated} · Skipped {state.skipped} · Errors {state.errors.length}
              {state.noRules > 0 && ` · ${state.noRules} pairs have no rules yet`}
            </p>
            {state.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-destructive dark:text-red-400">
                {state.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button
            onClick={() => setState({ phase: "idle" })}
            className="text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {state.phase === "error" && (
        <div className="flex items-start gap-2 rounded border border-destructive/20 bg-destructive/5 p-3">
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="flex-1 text-xs text-destructive">{state.message}</p>
          <button
            onClick={() => setState({ phase: "idle" })}
            className="text-xs text-destructive underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
