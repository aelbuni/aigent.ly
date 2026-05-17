import Link from "next/link";

interface MatrixCell {
  stackSlug: string;
  layerSlug: string;
  guardrailId?: string;
  score?: number | null;
  isStale?: boolean;
  conflictCount?: number;
}

interface CoverageMatrixProps {
  stacks: { slug: string; name: string }[];
  layers: { slug: string; name: string }[];
  cells: MatrixCell[];
  totalPairs: number;
  coveredPairs: number;
}

function getCellClasses(cell: MatrixCell | undefined): string {
  if (!cell?.guardrailId) return "bg-gray-3 dark:bg-dark-2 text-dark-6";
  const score = cell.score ?? 0;
  if (score === 0) return "bg-[#D34053]/15 text-[#D34053]";
  if (score < 5) return "bg-[#FFA70B]/15 text-[#FFA70B]";
  return "bg-[#219653]/15 text-[#219653]";
}

export function CoverageMatrix({
  stacks,
  layers,
  cells,
  totalPairs,
  coveredPairs,
}: CoverageMatrixProps) {
  const coveragePct =
    totalPairs > 0 ? Math.round((coveredPairs / totalPairs) * 100) : 0;

  const cellMap = new Map(
    cells.map((c) => [`${c.stackSlug}:${c.layerSlug}`, c])
  );

  return (
    <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark dark:text-white">
          Stack × Layer Coverage Matrix
        </h3>
        <span className="text-sm text-dark-6">
          {coveredPairs} / {totalPairs} pairs ({coveragePct}%)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-28 min-w-[7rem] p-1 text-left font-medium text-dark-6">
                Stack \ Layer
              </th>
              {layers.map((l) => (
                <th
                  key={l.slug}
                  className="max-w-[3rem] p-1 text-center font-medium text-dark-6"
                >
                  <span className="block truncate" title={l.name}>
                    {l.name.split(/[\s&]/)[0]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stacks.map((s) => (
              <tr
                key={s.slug}
                className="border-t border-stroke dark:border-dark-3"
              >
                <td
                  className="max-w-[7rem] truncate p-1 text-xs font-medium text-dark-6"
                  title={s.name}
                >
                  {s.name}
                </td>
                {layers.map((l) => {
                  const cell = cellMap.get(`${s.slug}:${l.slug}`);
                  const score = cell?.score ?? null;
                  return (
                    <td key={l.slug} className="p-1 text-center">
                      {cell?.guardrailId ? (
                        <Link
                          href={`/admin/guardrails/${cell.guardrailId}`}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${getCellClasses(cell)} ${cell.isStale ? "opacity-60 ring-1 ring-[#FFA70B]" : ""}`}
                          title={`Score: ${score ?? "?"}/10, Conflicts: ${cell.conflictCount ?? 0}${cell.isStale ? " (stale)" : ""}`}
                        >
                          {score ?? "?"}
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/guardrails?stack=${s.slug}&layer=${l.slug}`}
                          className="inline-flex h-5 w-5 items-center justify-center rounded bg-gray-3 text-dark-6 hover:bg-gray-4 dark:bg-dark-2 dark:text-white"
                          title="Missing — click to generate"
                        >
                          <span className="text-[10px]">+</span>
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-dark-6">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#219653]/15" />
          Score &ge;5
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#FFA70B]/15" />
          Score 1&ndash;4
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#D34053]/15" />
          Score 0
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-3 dark:bg-dark-2" />
          Missing
        </span>
      </div>
    </div>
  );
}
