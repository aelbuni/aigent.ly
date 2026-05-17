import {
  AdminDataTable,
  AdminEmptyState,
  AdminPrimaryCell,
  AdminStatusPill,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
  AdminTableHeaderRow,
  AdminTableRow,
} from "@/components/nextadmin/admin-data-table";
import { AdminPageHeader } from "@/components/nextadmin/admin-page-header";
import { getGuardrailCoverage } from "@/lib/admin-queries";
import { cn } from "@/lib/utils";
import { CoverageMatrix } from "./_components/coverage-matrix";
import { RegenButton } from "./_regen-button";

function ScoreBadge({ score, override }: { score: number; override?: number | null }) {
  const display = override ?? score;
  const colorClass =
    display >= 8 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : display >= 5 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", colorClass)}>
      {display}/10
      {override !== null && override !== undefined && (
        <span className="opacity-60" title="Admin override">✎</span>
      )}
    </span>
  );
}

function CoverageBar({ covered, total }: { covered: number; total: number }) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-2 dark:bg-dark-2">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-dark-6 tabular-nums">{covered}/{total}</span>
    </div>
  );
}

export default async function GuardrailEvaluationPage() {
  const data = await getGuardrailCoverage();
  const now = new Date();

  const avgScore = data.qualityStats.avgScore ?? 0;
  const cleanPct = data.qualityStats.totalCount > 0
    ? Math.round((Number(data.qualityStats.zeroConflictCount) / data.qualityStats.totalCount) * 100)
    : 0;

  // Build matrix cells from matrixRows (covered guardrails only)
  const matrixCells = data.matrixRows.map((g) => ({
    stackSlug: g.stackSlug,
    layerSlug: g.layerSlug,
    guardrailId: g.id,
    score: g.scoreOverride ?? g.qualityScore ?? 0,
    isStale: g.expiresAt != null && new Date(g.expiresAt) < now,
    conflictCount: g.conflictCount ?? 0,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Guardrail Evaluation"
        description="Coverage, quality scores, and re-generation for synthesized guardrails"
      />

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "True Coverage",
            value: `${data.coveragePct}%`,
            sub: `${data.coveredPairs} / ${data.totalPairs} pairs (${data.allStacks.length} stacks × ${data.allActiveLayers.length} layers)`,
          },
          { label: "Avg quality score", value: `${avgScore}/10`, sub: "across all guardrails" },
          { label: "Conflict-free", value: `${cleanPct}%`, sub: `${data.qualityStats.zeroConflictCount} clean guardrails` },
          { label: "Needs attention", value: String(data.qualityStats.needsAttentionCount), sub: "score below 5/10" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-1">
            <p className="text-heading-5 font-bold text-dark dark:text-white">{value}</p>
            <p className="text-sm font-medium text-dark-6">{label}</p>
            <p className="text-xs text-dark-6">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Stack × Layer coverage matrix ───────────────────────────────────── */}
      <CoverageMatrix
        stacks={data.allStacks}
        layers={data.allActiveLayers}
        cells={matrixCells}
        totalPairs={data.totalPairs}
        coveredPairs={data.coveredPairs}
      />

      {/* ── Per-stack coverage bars ──────────────────────────────────────────── */}
      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-3">
        <h2 className="text-base font-semibold text-dark dark:text-white">Coverage by stack</h2>
        {data.perStack.length === 0 ? (
          <p className="text-sm text-dark-6">No active stack×layer pairs found.</p>
        ) : (
          <ul className="space-y-2">
            {data.perStack.map((s) => (
              <li key={s.stackSlug} className="flex items-center gap-4">
                <span className="w-28 shrink-0 text-sm text-dark dark:text-white truncate">{s.stackName}</span>
                <CoverageBar covered={s.coveredLayers} total={s.totalLayers} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Quality matrix ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-dark dark:text-white px-1">Quality matrix</h2>
        <AdminDataTable>
          <AdminTableHeader>
            <AdminTableHeaderRow>
              <AdminTableHead>Guardrail</AdminTableHead>
              <AdminTableHead>Source Rules</AdminTableHead>
              <AdminTableHead>Conflicts</AdminTableHead>
              <AdminTableHead>Score</AdminTableHead>
              <AdminTableHead>Age</AdminTableHead>
              <AdminTableHead>Status</AdminTableHead>
              <AdminTableHead align="right">Re-score &amp; Regen</AdminTableHead>
            </AdminTableHeaderRow>
          </AdminTableHeader>
          <AdminTableBody>
            {data.matrixRows.length === 0 ? (
              <AdminEmptyState colSpan={7} message="No guardrails generated yet." />
            ) : (
              data.matrixRows.map((g) => {
                const isExpired = g.expiresAt && new Date(g.expiresAt) <= now;
                const daysSince = Math.floor((now.getTime() - new Date(g.generatedAt).getTime()) / 86_400_000);
                return (
                  <AdminTableRow key={g.id}>
                    <AdminPrimaryCell
                      title={g.stackName}
                      subtitle={`${g.layerName} · v${g.summarizerVersion}`}
                      href={`/admin/guardrails/${g.id}`}
                    />
                    <AdminTableCell>
                      <span className="text-sm text-dark dark:text-white">{g.sourceRuleCount ?? 0}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className={cn("text-sm", (g.conflictCount ?? 0) > 2 ? "text-destructive font-medium" : "text-dark dark:text-white")}>
                        {g.conflictCount ?? 0}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <ScoreBadge score={g.qualityScore ?? 0} override={g.scoreOverride} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className="text-sm text-dark-6">{daysSince === 0 ? "Today" : `${daysSince}d ago`}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <AdminStatusPill status={isExpired ? "expired" : "active"} />
                    </AdminTableCell>
                    <AdminTableCell align="right">
                      <RegenButton guardrailId={g.id} defaultScore={g.scoreOverride} />
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>

      {/* ── Uncovered pairs ──────────────────────────────────────────────────── */}
      {data.uncoveredPairs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-dark dark:text-white px-1">
            Uncovered pairs ({data.uncoveredPairs.length})
          </h2>
          <AdminDataTable>
            <AdminTableHeader>
              <AdminTableHeaderRow>
                <AdminTableHead>Stack</AdminTableHead>
                <AdminTableHead>Layer</AdminTableHead>
                <AdminTableHead align="right">Action</AdminTableHead>
              </AdminTableHeaderRow>
            </AdminTableHeader>
            <AdminTableBody>
              {data.uncoveredPairs.map((p) => (
                <AdminTableRow key={`${p.stackSlug}-${p.layerSlug}`}>
                  <AdminTableCell>
                    <span className="text-sm text-dark dark:text-white">{p.stackName}</span>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className="text-sm text-dark dark:text-white">{p.layerName}</span>
                  </AdminTableCell>
                  <AdminTableCell align="right">
                    <a
                      href={`/admin/guardrails`}
                      className="text-xs text-primary hover:underline"
                    >
                      Generate →
                    </a>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminDataTable>
        </div>
      )}
    </div>
  );
}
