import { STAT_TILES } from "@/lib/home-marketing-content";

type Tile = { value: string; label: string; footnote: string };

export function HomeStatBand({
  verifiedThreatCount,
  statTiles,
}: {
  verifiedThreatCount: number | null;
  statTiles?: readonly Tile[];
}) {
  const tiles: readonly Tile[] = statTiles ?? [...STAT_TILES];
  const resolved: Tile[] = tiles.map((t, i) => {
    if (i === 0 && verifiedThreatCount != null) {
      return {
        ...t,
        value: String(verifiedThreatCount),
        label: "Verified threats (launch stacks)",
        footnote: "Distinct CVE-level rows linked to MVP launch stacks in Postgres.",
      };
    }
    return { ...t };
  });

  return (
    <section className="border-b border-outline-variant bg-outline-variant/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-outline-variant/30 md:grid-cols-4">
        {resolved.map((tile) => (
          <div key={tile.label} className="bg-surface-container-lowest px-8 py-6 text-center">
            <span
              className="block font-sans tracking-tight text-primary"
              style={{ fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em" }}
            >
              {tile.value}
            </span>
            <span className="font-mono-label mt-2 block text-[10px] tracking-widest text-on-surface-variant">
              {tile.label}
            </span>
            <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant/60">{tile.footnote}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
