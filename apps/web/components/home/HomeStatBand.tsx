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
    <section className="marketing-section border-b border-outline-variant bg-surface-container-low">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 text-center md:grid-cols-4">
        {resolved.map((tile) => (
          <div key={tile.label}>
            <span className="font-h1 text-h1 block text-primary">{tile.value}</span>
            <span className="font-mono-label text-on-surface-variant">{tile.label}</span>
            <p className="mt-2 font-body-sm text-on-surface-variant/80">{tile.footnote}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
