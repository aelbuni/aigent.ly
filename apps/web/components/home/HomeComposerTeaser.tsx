import Link from "next/link";

import { MaterialSymbol } from "@/components/MaterialSymbol";

export function HomeComposerTeaser() {
  return (
    <section className="marketing-section marketing-section--inset mx-auto max-w-7xl">
      <div className="flex flex-col items-center gap-8 rounded-xl bg-primary-container p-8 text-white sm:gap-12 sm:p-12 md:flex-row">
        <div className="md:w-1/3">
          <span className="font-mono-label block text-on-primary-container">Composer (post-MVP)</span>
          <h2 className="font-h2 text-h2 mb-6">Build your agent&apos;s guardrails in seconds.</h2>
          <p className="font-body-base mb-8 text-white/80">
            Today: pick a stack and install the certified rule from the directory. Composer returns later for layered
            exports across IDEs.
          </p>
          <Link
            href="/stacks"
            className="font-body-base inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-primary"
          >
            Pick your stack
            <MaterialSymbol name="arrow_forward" className="!text-sm" />
          </Link>
        </div>
        <div className="w-full rounded-lg border border-slate-700 bg-slate-900 p-8 shadow-2xl md:w-2/3">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="space-y-4">
              <label className="font-mono-label text-slate-400">01. STACK</label>
              <select
                className="font-mono-data w-full rounded border border-slate-600 bg-slate-800 p-2 text-white"
                disabled
                defaultValue="0"
              >
                <option>Next.js</option>
                <option>Python / FastAPI</option>
                <option>Ruby on Rails</option>
              </select>
            </div>
            <div className="space-y-4">
              <label className="font-mono-label text-slate-400">02. IDE / AGENT</label>
              <select
                className="font-mono-data w-full rounded border border-slate-600 bg-slate-800 p-2 text-white"
                disabled
                defaultValue="0"
              >
                <option>Cursor (Rules)</option>
                <option>Windsurf</option>
                <option>Claude Code</option>
              </select>
            </div>
            <div className="space-y-4">
              <label className="font-mono-label text-slate-400">03. LAYERS</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked
                    readOnly
                    className="rounded border-slate-600 bg-slate-800 text-primary"
                  />
                  <span className="font-mono-data text-xs text-white">Security baseline</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked
                    readOnly
                    className="rounded border-slate-600 bg-slate-800 text-primary"
                  />
                  <span className="font-mono-data text-xs text-white">Secret hygiene</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" readOnly className="rounded border-slate-600 bg-slate-800 text-primary" />
                  <span className="font-mono-data text-xs text-white">Architecture boundaries</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-slate-700 pt-8">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <span className="font-mono-data text-slate-500">Preview: stack + IDE + layers</span>
          </div>
        </div>
      </div>
    </section>
  );
}
