"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const nav = [
  { href: "/rules", label: "Rules" },
  { href: "/explore", label: "Explore" },
  { href: "/composer", label: "Composer" },
  { href: "/threats", label: "Threats" },
  { href: "/stacks", label: "Stacks" },
  { href: "/learn", label: "Learn" },
] as const;

function navClass(active: boolean) {
  return active
    ? "text-indigo-600 font-semibold"
    : "text-slate-500 font-medium hover:text-indigo-600";
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b-[0.5px] border-slate-200 bg-white px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center" aria-label="Aigent.ly home">
            <Image
              src="/logo-light.svg"
              alt="Aigent.ly"
              width={134}
              height={32}
              className="h-7 w-auto"
              priority
            />
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
            className="hidden font-sans text-sm tracking-tight text-slate-500 transition-colors hover:text-indigo-600 md:block"
            href="https://github.com/aelbuni/aigently-catalog"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <Link
            href="/work-with-us"
            className="hidden scale-100 rounded bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95 md:block"
          >
            Contribute
          </Link>

          {/* Mobile hamburger */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="fixed inset-0 top-14 z-40 flex flex-col bg-white px-6 py-6 md:hidden">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-3 py-3 text-base font-medium tracking-tight transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6">
            <a
              className="text-base font-medium text-slate-500 transition-colors hover:text-indigo-600"
              href="https://github.com/aelbuni/aigently-catalog"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <Link
              href="/work-with-us"
              onClick={() => setMenuOpen(false)}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-semibold text-white"
            >
              Contribute
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
