import { MARQUEE_ITEMS } from "@/lib/home-marketing-content";

export function HomeMarqueeStrip() {
  const segment = (
    <div className="flex shrink-0 items-center gap-12 whitespace-nowrap">
      {MARQUEE_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-4">
          <span className={`font-mono-label ${item.tone}`}>{item.label}</span>
          <span className="font-mono-data text-white">{item.text}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-y border-slate-800 bg-slate-950 py-4">
      <div className="animate-marquee flex gap-12 px-gutter">
        {segment}
        {segment}
      </div>
    </div>
  );
}
