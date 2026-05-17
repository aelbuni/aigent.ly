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
import {
  triggerSync as _triggerSync,
  triggerAmplification,
  triggerSummarizeRules,
  triggerSummarizeLayers,
  triggerExportCatalog,
} from "@/features/admin-sync/actions/sync-actions";
import { SnapshotPanel } from "@/features/admin-sync/components/snapshot-panel";
import {
  getCoreObjectiveMetrics,
  getPipelinePhaseStatus,
  listSyncLogs,
} from "@/lib/admin-queries";
import { RefreshCw } from "lucide-react";
import { PipelinePhaseCard } from "./_components/pipeline-phase-card";
import { ClearZombieRunsButton } from "./_components/clear-zombie-runs-button";

// Adapter: triggerSync is a form action (void). Wrap it so it satisfies
// PipelinePhaseCard's triggerAction type: () => Promise<{ ok; message }>.
async function triggerSyncAction(): Promise<{ ok: boolean; message: string }> {
  "use server";
  await _triggerSync();
  return { ok: true, message: "Sync triggered." };
}

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);

  const [{ rows, total }, pipelineStatus, coreObjectives] = await Promise.all([
    listSyncLogs({ page, perPage: 20 }),
    getPipelinePhaseStatus(),
    getCoreObjectiveMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <SnapshotPanel />

      <AdminPageHeader
        title="Sync Logs"
        description={`${total} sync runs recorded`}
        action={
          <form action={_triggerSync}>
            <button
              type="submit"
              className="border-stroke text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 inline-flex items-center gap-2 rounded-sm border bg-white px-4 py-2.5 text-sm font-medium dark:text-white"
            >
              <RefreshCw className="size-4" />
              Trigger Sync
            </button>
          </form>
        }
      />

      {/* Pipeline Control Center */}
      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-dark dark:text-white">
              Pipeline Control Center
            </p>
            <p className="text-sm text-dark-6">
              6-phase daily pipeline — sync → amplify → summarize rules → summarize layers → score → export
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <PipelinePhaseCard
            phase="1. Sync Threats"
            description="Fetch CVEs from NVD, GHSA, CISA KEV, OSV"
            status={
              pipelineStatus.lastSyncRun?.status === "success"
                ? "success"
                : "idle"
            }
            metric={`${coreObjectives.totalThreats.toLocaleString()} threats in DB`}
            lastRunLabel={
              pipelineStatus.lastSyncRun?.finishedAt
                ? `Last: ${new Date(pipelineStatus.lastSyncRun.finishedAt).toLocaleString()}`
                : undefined
            }
            triggerAction={triggerSyncAction}
            triggerLabel="Trigger Sync"
          />
          <PipelinePhaseCard
            phase="2. Amplify"
            description="Claude generates ALWAYS/NEVER patterns per threat"
            status={
              pipelineStatus.unamplifiedThreats > 0 ? "needs_action" : "success"
            }
            metric={`${pipelineStatus.unamplifiedThreats} unamplified`}
            warningMessage={
              pipelineStatus.unamplifiedThreats > 0
                ? `${pipelineStatus.unamplifiedThreats} threats missing AI amplification`
                : undefined
            }
            triggerAction={triggerAmplification}
            triggerLabel="Run Amplification"
          />
          <PipelinePhaseCard
            phase="3. Summarize Rules"
            description="Claude clusters CVEs into themed security rules"
            status={
              pipelineStatus.zeroStrengthRules > 0 ? "needs_action" : "success"
            }
            metric={`${pipelineStatus.zeroStrengthRules} rules at score 0`}
            triggerAction={triggerSummarizeRules}
            triggerLabel="Summarize Rules"
          />
          <PipelinePhaseCard
            phase="4. Summarize Layers"
            description="Generate layer guardrail summaries per stack"
            status={
              pipelineStatus.staleGuardrails > 0
                ? "needs_action"
                : coreObjectives.coveragePercent < 10
                  ? "needs_action"
                  : "success"
            }
            metric={`${coreObjectives.guardrailsCovered}/${coreObjectives.totalPairs} pairs covered`}
            warningMessage={
              pipelineStatus.staleGuardrails > 0
                ? `${pipelineStatus.staleGuardrails} stale guardrails`
                : undefined
            }
            triggerAction={triggerSummarizeLayers}
            triggerLabel="Summarize Layers"
          />
          <PipelinePhaseCard
            phase="5. Score"
            description="Quality scores computed per guardrail"
            status={
              coreObjectives.avgQualityScore != null &&
              coreObjectives.avgQualityScore < 5
                ? "needs_action"
                : "success"
            }
            metric={
              coreObjectives.avgQualityScore != null
                ? `Avg ${coreObjectives.avgQualityScore}/10`
                : "No scores yet"
            }
            warningMessage={
              coreObjectives.avgQualityScore != null &&
              coreObjectives.avgQualityScore < 5
                ? `Low avg quality: ${coreObjectives.avgQualityScore}/10`
                : undefined
            }
          />
          <PipelinePhaseCard
            phase="6. Export Catalog"
            description="Commit JSON snapshots to aigently-catalog repo"
            status="idle"
            metric="Manual trigger only"
            triggerAction={triggerExportCatalog}
            triggerLabel="Export Now"
          />
        </div>

        {/* Zombie run warning */}
        {pipelineStatus.zombieRuns.length > 0 && (
          <div className="flex items-center justify-between rounded-[10px] border border-[#FFA70B]/40 bg-[#FFA70B]/5 p-4">
            <p className="text-sm text-[#FFA70B]">
              {pipelineStatus.zombieRuns.length} sync run
              {pipelineStatus.zombieRuns.length !== 1 ? "s" : ""} stuck in
              &quot;running&quot; status for &gt;30 minutes.
            </p>
            <ClearZombieRunsButton count={pipelineStatus.zombieRuns.length} />
          </div>
        )}
      </div>

      {/* Sync Log Table */}
      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Run</AdminTableHead>
            <AdminTableHead>Coverage</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={3} message="No sync logs yet." />
          ) : (
            rows.map((log) => (
              <AdminTableRow key={log.id}>
                <AdminPrimaryCell
                  title={new Date(log.startedAt).toLocaleString()}
                  subtitle={
                    log.finishedAt
                      ? `Finished: ${new Date(log.finishedAt).toLocaleString()}`
                      : log.errorMessage ?? undefined
                  }
                />
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">
                    {log.coveragePercent != null
                      ? `${log.coveragePercent}%`
                      : "—"}
                  </p>
                </AdminTableCell>
                <AdminTableCell>
                  <AdminStatusPill status={log.status} />
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
