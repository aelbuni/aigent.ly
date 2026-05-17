import {
  AdminDataTable,
  AdminEmptyState,
  AdminPrimaryCell,
  AdminRowActions,
  AdminStatusPill,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
  AdminTableHeaderRow,
  AdminTableRow,
} from "@/components/nextadmin/admin-data-table";
import {
  AdminPageHeader,
  AdminPagination,
  AdminPrimaryButton,
  AdminSearchForm,
  AdminSearchInput,
  AdminSearchSubmit,
} from "@/components/nextadmin/admin-page-header";
import { listThreats } from "@/lib/admin-queries";
import { AlertTriangle, Plus } from "lucide-react";

export default async function ThreatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; severity?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { rows, total } = await listThreats({
    page,
    perPage: 25,
    search: params.search,
    severity: params.severity,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Threats"
        description={`${total} threats in database`}
        action={
          <AdminPrimaryButton href="/admin/threats/new">
            <Plus className="size-4" />
            Add Threat
          </AdminPrimaryButton>
        }
      />

      <AdminSearchForm>
        <AdminSearchInput
          placeholder="Search threats…"
          defaultValue={params.search}
        />
        <select
          name="severity"
          defaultValue={params.severity ?? ""}
          className="border-stroke bg-white text-dark focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white h-11 rounded-sm border px-3 text-sm outline-none transition-colors"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <AdminSearchSubmit label="Filter" />
      </AdminSearchForm>

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Threat</AdminTableHead>
            <AdminTableHead>Source</AdminTableHead>
            <AdminTableHead>Severity</AdminTableHead>
            <AdminTableHead>Amplified</AdminTableHead>
            <AdminTableHead>Layers</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={6} message="No threats found." />
          ) : (
            rows.map((t) => (
              <AdminTableRow key={t.publicId}>
                <AdminPrimaryCell
                  title={
                    <span className="flex items-center gap-2">
                      {t.isActivelyExploited && (
                        <AlertTriangle className="text-red size-3.5 shrink-0" />
                      )}
                      <span className="truncate">{t.name}</span>
                    </span>
                  }
                  subtitle={`${t.publicId} · ${t.layerCount} layers · ${t.stackCount} stacks`}
                  href={`/admin/threats/${encodeURIComponent(t.publicId)}`}
                />
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">{t.source}</p>
                  <p className="text-body-sm text-dark-6 mt-0.5">{t.family}</p>
                </AdminTableCell>
                <AdminTableCell>
                  {t.severity ? (
                    <AdminStatusPill status={t.severity} />
                  ) : (
                    <span className="text-dark-6 text-sm">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <AdminStatusPill status={t.isAmplified ? "active" : "inactive"} />
                </AdminTableCell>
                <AdminTableCell>
                  <span className={`text-sm font-medium ${Number(t.layerCount) === 0 ? "text-[#FFA70B]" : "text-dark dark:text-white"}`}>
                    {t.layerCount}
                    {Number(t.layerCount) === 0 && <span className="ml-1">⚠</span>}
                  </span>
                </AdminTableCell>
                <AdminRowActions
                  viewHref={`/admin/threats/${encodeURIComponent(t.publicId)}`}
                />
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminPagination
        page={page}
        perPage={25}
        total={total}
        searchParams={{ search: params.search, severity: params.severity }}
      />
    </div>
  );
}
