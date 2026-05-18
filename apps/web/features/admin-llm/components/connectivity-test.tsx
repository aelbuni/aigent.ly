"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; latencyMs: number }
  | { status: "error"; message: string };

export function ConnectivityTest() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function run() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/llm-config");
      const data = await res.json();
      if (data.connectivity === "ok") {
        setState({ status: "ok", latencyMs: data.latencyMs ?? 0 });
      } else {
        setState({ status: "error", message: data.connectivityError ?? "Unknown error" });
      }
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={state.status === "loading"}
          className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {state.status === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {state.status === "loading" ? "Testing…" : "Test connection"}
        </button>

        {state.status === "ok" && (
          <span className="flex items-center gap-2 text-sm">
            <CheckCircle className="size-5 text-emerald-500" />
            <span className="text-dark dark:text-white">
              Connected · {state.latencyMs}ms
            </span>
          </span>
        )}

        {state.status === "error" && (
          <span className="flex items-center gap-2 text-sm">
            <XCircle className="size-5 text-destructive" />
            <span className="text-destructive">Connection failed</span>
          </span>
        )}
      </div>

      {state.status === "error" && (
        <p className="break-all rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
