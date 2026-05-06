import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-slate-800 bg-slate-950 py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <span className="mb-4 block font-bold text-indigo-500">Aigent.ly</span>
          <p className="font-mono text-[10px] uppercase leading-relaxed text-slate-500">
            © 2026 Aigent.ly Security. Technical Minimalism via DM Mono.
          </p>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">Resources</h4>
          <nav className="flex flex-col gap-2">
            <Link
              href="/learn"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Documentation
            </Link>
            <a
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
              href="#"
            >
              API Reference
            </a>
          </nav>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">System</h4>
          <nav className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase text-slate-500">Status</span>
            <span className="font-mono text-[10px] uppercase text-slate-500">Network</span>
          </nav>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">Legal</h4>
          <nav className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase text-slate-500">Privacy</span>
            <span className="font-mono text-[10px] uppercase text-slate-500">Security</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
