import {
  AdminDataTable,
  AdminDeleteButton,
  AdminRowActions,
  AdminStatusPill,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
  AdminTableHeaderRow,
  AdminTableRow,
} from "@/components/nextadmin/admin-data-table";
import { AdminPageHeader } from "@/components/nextadmin/admin-page-header";
import { getSourceRoutingConfig } from "@/lib/admin-queries";
import {
  toggleSourceMappingActive,
  deleteSourceMapping,
  toggleOwaspMappingActive,
  reAssignAllThreatLayers,
  upsertSourceMapping,
} from "@/features/admin-sources/actions/source-actions";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { DefaultMappingsLoader } from "./_components/default-mappings-loader";

const SOURCES = ["nvd", "osv", "ghsa", "cisa_kev", "aigently", "mitre_atlas", "aigently_internal"] as const;

export default async function SourceRoutingPage() {
  const { sourceMappings, owaspMappings, allLayers } = await getSourceRoutingConfig();

  const bySource = SOURCES.reduce<Record<string, typeof sourceMappings>>((acc, src) => {
    acc[src] = sourceMappings.filter((m) => m.source === src);
    return acc;
  }, {} as Record<string, typeof sourceMappings>);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Source → Layer Routing"
        description="Configure which data sources automatically populate which layers after a sync."
        action={
          <form action={reAssignAllThreatLayers}>
            <button
              type="submit"
              className="border-stroke text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 inline-flex items-center gap-2 rounded-sm border bg-white px-4 py-2.5 text-sm font-medium dark:text-white"
            >
              <RefreshCw className="size-4" />
              Re-assign All Threat Layers
            </button>
          </form>
        }
      />

      {sourceMappings.length === 0 && (
        <div className="flex items-start gap-3 rounded-[10px] border border-[#D34053]/40 bg-[#D34053]/5 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#D34053]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#D34053]">
              No source-layer mappings configured
            </p>
            <p className="text-dark-6 mt-1 text-sm">
              Threat layer assignment is disabled. All 7 data sources are unrouted — threats
              synced from NVD, GHSA, CISA KEV, OSV, and internal sources will not be assigned
              to any layer. Guardrail generation is blocked for most layers.
            </p>
            <div className="mt-3">
              <DefaultMappingsLoader />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-dark text-lg font-semibold dark:text-white">Data sources</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOURCES.map((src) => (
            <AdminDataTable key={src} className="sm:p-5">
              <AdminTableHeader>
                <AdminTableHeaderRow>
                  <AdminTableHead className="xl:pl-4">{src}</AdminTableHead>
                  <AdminTableHead align="right">Actions</AdminTableHead>
                </AdminTableHeaderRow>
              </AdminTableHeader>
              <AdminTableBody>
                {bySource[src].length === 0 ? (
                  <AdminTableRow>
                    <AdminTableCell colSpan={2} className="text-dark-6 py-4 text-sm xl:pl-4">
                      No layer mappings configured.
                    </AdminTableCell>
                  </AdminTableRow>
                ) : (
                  bySource[src].map((m) => (
                    <AdminTableRow key={m.id}>
                      <AdminTableCell className="xl:pl-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminStatusPill status={m.relevance} />
                          <span className="text-dark text-sm dark:text-white">
                            {m.layerName}
                          </span>
                          {!m.isActive && <AdminStatusPill status="inactive" />}
                        </div>
                      </AdminTableCell>
                      <AdminRowActions
                        extra={
                          <form
                            action={toggleSourceMappingActive.bind(null, m.id, !m.isActive)}
                          >
                            <button
                              type="submit"
                              className="text-dark-6 hover:text-primary text-xs font-medium"
                            >
                              {m.isActive ? "Disable" : "Enable"}
                            </button>
                          </form>
                        }
                        deleteAction={
                          <AdminDeleteButton
                            formAction={deleteSourceMapping.bind(null, m.id)}
                          />
                        }
                      />
                    </AdminTableRow>
                  ))
                )}
                {/* Add mapping row */}
                <AdminTableRow>
                  <AdminTableCell colSpan={2} className="xl:pl-4">
                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        const layerId = fd.get("layerId") as string;
                        const relevance = fd.get("relevance") as "primary" | "secondary";
                        if (layerId) await upsertSourceMapping(src, layerId, relevance);
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <select
                        name="layerId"
                        required
                        className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-8 rounded border px-2 text-xs outline-none"
                      >
                        <option value="">Add layer…</option>
                        {allLayers.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                      <select
                        name="relevance"
                        className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-8 rounded border px-2 text-xs outline-none"
                      >
                        <option value="primary">primary</option>
                        <option value="secondary">secondary</option>
                      </select>
                      <button
                        type="submit"
                        className="bg-primary hover:bg-primary/90 inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-white"
                      >
                        <Plus className="size-3" />
                        Add
                      </button>
                    </form>
                  </AdminTableCell>
                </AdminTableRow>
              </AdminTableBody>
            </AdminDataTable>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-dark text-lg font-semibold dark:text-white">
          OWASP ref → layer routing
        </h2>
        <p className="text-dark-6 text-sm">
          When a threat has an OWASP ref (e.g. A03), it auto-assigns to the mapped layer during sync.
        </p>
        <AdminDataTable>
          <AdminTableHeader>
            <AdminTableHeaderRow>
              <AdminTableHead>OWASP</AdminTableHead>
              <AdminTableHead>Layer</AdminTableHead>
              <AdminTableHead>Relevance</AdminTableHead>
              <AdminTableHead align="right">Actions</AdminTableHead>
            </AdminTableHeaderRow>
          </AdminTableHeader>
          <AdminTableBody>
            {owaspMappings.map((m) => (
              <AdminTableRow key={m.id}>
                <AdminTableCell>
                  <code className="bg-gray-3 text-dark rounded px-1.5 py-0.5 font-mono text-xs">
                    {m.owaspRef}
                  </code>
                </AdminTableCell>
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">{m.layerName}</p>
                </AdminTableCell>
                <AdminTableCell>
                  <AdminStatusPill status={m.relevance} />
                  {!m.isActive && <AdminStatusPill status="inactive" />}
                </AdminTableCell>
                <AdminRowActions
                  extra={
                    <form
                      action={toggleOwaspMappingActive.bind(null, m.id, !m.isActive)}
                    >
                      <button
                        type="submit"
                        className="text-dark-6 hover:text-primary text-xs font-medium"
                      >
                        {m.isActive ? "Active" : "Disabled"}
                      </button>
                    </form>
                  }
                />
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
      </div>
    </div>
  );
}
