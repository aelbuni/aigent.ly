import { auth } from "@/auth";
import {
  CatalogOverviewCards,
  PendingSubmissionsTable,
} from "@/components/nextadmin/overview/catalog-overview";
import { getCoreObjectiveMetrics } from "@/lib/admin-queries";
import { Suspense } from "react";

export default async function AdminOverviewPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const coreObjectives = await getCoreObjectiveMetrics();

  return (
    <>
      <div className="mb-6">
        <h2 className="text-heading-4 text-dark font-bold dark:text-white">
          Hi, {firstName} — welcome back
        </h2>
        <p className="text-dark-6 mt-1 font-medium">
          Catalog health overview for Aigent.ly
        </p>
      </div>

      <Suspense fallback={<OverviewSkeleton />}>
        <CatalogOverviewCards />
      </Suspense>

      {/* Core Objectives */}
      <div className="mt-4">
        <p className="mb-3 text-sm font-medium text-dark-6">Core Objectives</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Objective 1: Threats Amplified */}
          <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-1">
            <p className="text-heading-5 font-bold text-dark dark:text-white">
              {coreObjectives.amplificationPercent}%
            </p>
            <p className="text-sm font-medium text-dark-6">Threats Amplified</p>
            <p className="text-xs text-dark-6">
              {coreObjectives.amplified.toLocaleString()} / {coreObjectives.totalThreats.toLocaleString()} threats
            </p>
            {coreObjectives.amplificationPercent < 80 && (
              <p className="text-xs text-[#D34053]">⚠ Needs attention</p>
            )}
          </div>

          {/* Objective 2: Guardrail Coverage */}
          <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-1">
            <p className="text-heading-5 font-bold text-dark dark:text-white">
              {coreObjectives.coveragePercent}%
            </p>
            <p className="text-sm font-medium text-dark-6">Guardrail Coverage</p>
            <p className="text-xs text-dark-6">
              {coreObjectives.guardrailsCovered} / {coreObjectives.totalPairs} pairs
            </p>
            {coreObjectives.coveragePercent < 50 && (
              <p className="text-xs text-[#D34053]">⚠ Needs attention</p>
            )}
          </div>

          {/* Objective 3: Avg Eval Score */}
          <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-1">
            <p className={`text-heading-5 font-bold dark:text-white ${
              coreObjectives.avgQualityScore != null && coreObjectives.avgQualityScore < 5
                ? "text-[#D34053]"
                : "text-dark"
            }`}>
              {coreObjectives.avgQualityScore != null
                ? `${coreObjectives.avgQualityScore}/10`
                : "—"}
            </p>
            <p className="text-sm font-medium text-dark-6">Avg Eval Score</p>
            <p className="text-xs text-dark-6">
              {coreObjectives.conflictFreePercent}% conflict-free
            </p>
            {coreObjectives.avgQualityScore != null && coreObjectives.avgQualityScore < 5 && (
              <p className="text-xs text-[#D34053]">⚠ Quality below threshold</p>
            )}
          </div>

          {/* Objective 4: Threats in Layers */}
          <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-1">
            <p className="text-heading-5 font-bold text-dark dark:text-white">
              {coreObjectives.layerAssignmentPercent}%
            </p>
            <p className="text-sm font-medium text-dark-6">Threats in Layers</p>
            <p className="text-xs text-dark-6">
              {coreObjectives.layerAssignedThreats.toLocaleString()} assigned
            </p>
            {coreObjectives.layerAssignmentPercent < 50 && (
              <p className="text-xs text-[#D34053]">
                ⚠ Configure source routing
              </p>
            )}
          </div>

        </div>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 md:gap-6 2xl:mt-9 2xl:gap-7.5">
        <Suspense fallback={null}>
          <PendingSubmissionsTable />
        </Suspense>
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="dark:bg-gray-dark h-36 animate-pulse rounded-[10px] bg-white shadow-1"
        />
      ))}
    </div>
  );
}
