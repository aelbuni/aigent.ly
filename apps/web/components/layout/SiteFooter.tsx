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
            <Link
              href="/rules"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Rules directory
            </Link>
          </nav>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">Platform</h4>
          <nav className="flex flex-col gap-2">
            <Link
              href="/stacks"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Stacks
            </Link>
            <Link
              href="/threats"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Threat feed
            </Link>
          </nav>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[10px] uppercase text-white">Company</h4>
          <nav className="flex flex-col gap-2">
            <Link
              href="/work-with-us"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Contribute
            </Link>
            <a
              href="https://github.com/aelbuni/aigently-catalog"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase text-slate-500 transition-colors hover:text-white"
            >
              Open source ↗
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
