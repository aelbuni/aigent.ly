import Link from "next/link";

import { USER_STORIES } from "@/lib/home-marketing-content";

export function HomePersonaGrid() {
  return (
    <section className="marketing-section marketing-section--inverse bg-inverse-surface text-inverse-on-surface">
      <div className="mx-auto max-w-7xl">
        <div className="marketing-section-header">
          <span className="font-mono-label uppercase text-inverse-primary">Who this is for</span>
          <h2 className="font-h2 text-h2 tracking-tight">Four real stories</h2>
          <p className="max-w-2xl text-inverse-on-surface/80">
            If one of these sounds like your team, you are the audience for a rules-first security layer on top of AI
            IDEs.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {USER_STORIES.map((story, i) => {
            const accents = ["#818cf8", "#34d399", "#fb923c", "#a78bfa"];
            const accent = accents[i % accents.length];
            return (
              <article
                key={story.tag}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-inverse-on-surface/15 bg-inverse-on-surface/8 p-7 transition-colors hover:border-inverse-on-surface/30"
              >
                {/* Top accent bar */}
                <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}cc, ${accent}44)` }} />

                <span
                  className="mb-3 font-mono-label text-[10px] tracking-widest"
                  style={{ color: accent }}
                >
                  {story.tag}
                </span>
                <h3 className="mb-3 text-[17px] font-semibold leading-snug text-inverse-on-surface">
                  {story.title}
                </h3>
                <p className="flex-grow text-[13px] leading-relaxed text-inverse-on-surface/70">{story.body}</p>
              </article>
            );
          })}
        </div>
        <p className="mt-10 text-center font-body-sm text-inverse-on-surface/70">
          Ready to try it?{" "}
          <Link href="/rules" className="font-semibold text-inverse-primary underline-offset-4 hover:underline">
            Browse rules
          </Link>{" "}
          or{" "}
          <Link href="/stacks" className="font-semibold text-inverse-primary underline-offset-4 hover:underline">
            pick a stack
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
