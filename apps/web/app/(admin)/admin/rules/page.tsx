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
  AdminSearchForm,
  AdminSearchInput,
  AdminSearchSubmit,
} from "@/components/nextadmin/admin-page-header";
import { listRules } from "@/lib/admin-queries";
import { CheckCircle } from "lucide-react";

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { rows, total } = await listRules({ page, perPage: 25, search: params.search });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Rules"
        description={`${total} security rules`}
      />

      <AdminSearchForm>
        <AdminSearchInput
          placeholder="Search rules…"
          defaultValue={params.search}
        />
        <AdminSearchSubmit />
      </AdminSearchForm>

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Rule</AdminTableHead>
            <AdminTableHead>Strength</AdminTableHead>
            <AdminTableHead>Type</AdminTableHead>
            <AdminTableHead>Layers</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={5} message="No rules found." />
          ) : (
            rows.map((r) => (
              <AdminTableRow key={r.id}>
                <AdminPrimaryCell
                  title={
                    <span className="flex items-center gap-2">
                      <span className="truncate">{r.name}</span>
                      {r.certified && (
                        <CheckCircle className="text-green size-3.5 shrink-0" />
                      )}
                    </span>
                  }
                  subtitle={r.author}
                  href={`/admin/rules/${r.id}`}
                />
                <AdminTableCell>
                  <div className="flex items-center gap-2">
                    <div className="bg-gray-3 h-1.5 w-16 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${r.strengthScore}%` }}
                      />
                    </div>
                    <span className="text-dark-6 text-sm">{r.strengthScore}</span>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <AdminStatusPill status={r.ruleType} />
                </AdminTableCell>
                <AdminTableCell>
                  <span className="text-muted-foreground text-sm">{r.layerCount ?? 0}</span>
                </AdminTableCell>
                <AdminRowActions viewHref={`/admin/rules/${r.id}`} />
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
