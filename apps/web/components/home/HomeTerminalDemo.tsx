"use client";

import { useEffect, useRef } from "react";

export function HomeTerminalDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (document.getElementById("asciicast-hvKBCjRDdgQVEZQH")) return;
    const script = document.createElement("script");
    script.src = "https://asciinema.org/a/hvKBCjRDdgQVEZQH.js";
    script.id = "asciicast-hvKBCjRDdgQVEZQH";
    script.async = true;
    containerRef.current.appendChild(script);
  }, []);

  return (
    <section className="relative border-b border-inverse-on-surface/10 bg-inverse-surface px-gutter pb-16 pt-10">
      {/* Thin accent line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-inverse-primary/40 to-transparent" />

      <div className="mx-auto max-w-4xl">
        {/* Label row */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-inverse-on-surface/10" />
          <span className="font-mono-label inline-flex items-center gap-2 text-[11px] tracking-widest text-inverse-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-inverse-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-inverse-primary" />
            </span>
            see it in action
          </span>
          <div className="h-px flex-1 bg-inverse-on-surface/10" />
        </div>

        {/* Player wrapper — subtle border + shadow so it reads as a contained UI */}
        <div className="overflow-hidden rounded-2xl border border-inverse-on-surface/15 shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
          <div ref={containerRef} />
        </div>

        <p className="mt-4 text-center font-mono-label text-[10px] tracking-widest text-inverse-on-surface/35">
          click to play · real 2026 cves · before / after plan comparison
        </p>
      </div>
    </section>
  );
}
