"use client";

import { useRef, useState } from "react";
import { Download, Upload, Loader2, CheckCircle, XCircle } from "lucide-react";

type ImportResult = {
  imported: { threats: number; rules: number; guardrails: number; skipped: number };
  ok: boolean;
};

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; result: ImportResult }
  | { status: "error"; message: string };

export function SnapshotPanel() {
  const [importing, setImporting] = useState<ImportState>({ status: "idle" });
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/snapshot");
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aigently-snapshot-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting({ status: "loading" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/snapshot", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setImporting({ status: "ok", result: json });
    } catch (e) {
      setImporting({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Export card */}
      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-3">
        <h2 className="text-dark font-semibold dark:text-white">Export snapshot</h2>
        <p className="text-dark-6 text-sm">
          Downloads a single JSON file with all threats, rules, layers, AI enrichments, and layer summaries.
        </p>
        <button
          onClick={handleExport}
          disabled={downloading}
          className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {downloading ? "Preparing…" : "Download snapshot"}
        </button>
      </div>

      {/* Import card */}
      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-3">
        <h2 className="text-dark font-semibold dark:text-white">Import snapshot</h2>
        <p className="text-dark-6 text-sm">
          Merges a snapshot file into this environment. Existing rows are updated; nothing is deleted.
        </p>
        <form onSubmit={handleImport} className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            required
            className="block w-full text-sm text-dark-6 file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary dark:text-dark-6"
          />
          <button
            type="submit"
            disabled={importing.status === "loading"}
            className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {importing.status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {importing.status === "loading" ? "Importing…" : "Import snapshot"}
          </button>
        </form>

        {importing.status === "ok" && (
          <div className="flex items-start gap-2 rounded border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950/30">
            <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="text-xs text-emerald-800 dark:text-emerald-300 space-y-0.5">
              <p className="font-medium">Import complete</p>
              <p>Threats: {importing.result.imported.threats} · Rules: {importing.result.imported.rules} · Guardrails: {importing.result.imported.guardrails} · Skipped: {importing.result.imported.skipped}</p>
            </div>
          </div>
        )}

        {importing.status === "error" && (
          <div className="flex items-start gap-2 rounded border border-destructive/20 bg-destructive/5 p-3">
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{importing.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
