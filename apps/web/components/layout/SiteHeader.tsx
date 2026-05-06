"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/rules", label: "Rules" },
  { href: "/threats", label: "Threats" },
  { href: "/stacks", label: "Stacks" },
] as const;

function navClass(active: boolean) {
  return active
    ? "text-indigo-600 font-semibold"
    : "text-slate-500 font-medium hover:text-indigo-600";
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b-[0.5px] border-slate-200 bg-white px-6">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-lg font-bold tracking-tighter text-slate-900">
          Aigent.ly
        </Link>
        <nav className="hidden items-center gap-6 font-sans md:flex">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium tracking-tight transition-colors font-sans ${navClass(active)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <a
          className="font-sans text-sm tracking-tight text-slate-500 transition-colors hover:text-indigo-600"
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <Link
          href="/work-with-us"
          className="scale-100 rounded bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          Work with us
        </Link>
      </div>
    </header>
  );
}
