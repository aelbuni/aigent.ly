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
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          {USER_STORIES.map((story) => (
            <article
              key={story.tag}
              className="flex flex-col rounded-xl border border-inverse-on-surface/20 bg-inverse-on-surface/10 p-6"
            >
              <h3 className="mb-2 text-[18px] font-medium leading-tight">{story.title}</h3>
              <span className="mb-4 font-mono text-[10px] uppercase tracking-widest text-inverse-primary">
                {story.tag}
              </span>
              <p className="flex-grow font-body-base text-sm text-inverse-on-surface/85">{story.body}</p>
            </article>
          ))}
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
