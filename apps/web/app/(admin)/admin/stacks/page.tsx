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
  AdminPrimaryButton,
  AdminSearchForm,
  AdminSearchInput,
  AdminSearchSubmit,
} from "@/components/nextadmin/admin-page-header";
import { listStacks } from "@/lib/admin-queries";
import { Plus } from "lucide-react";

export default async function StacksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { rows, total } = await listStacks({ page, perPage: 20, search: params.search });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Stacks"
        description={`${total} stacks in catalog`}
        action={
          <AdminPrimaryButton href="/admin/stacks/new">
            <Plus className="size-4" />
            New Stack
          </AdminPrimaryButton>
        }
      />

      <AdminSearchForm>
        <AdminSearchInput
          placeholder="Search stacks…"
          defaultValue={params.search}
        />
        <AdminSearchSubmit />
      </AdminSearchForm>

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Stack</AdminTableHead>
            <AdminTableHead>Catalog</AdminTableHead>
            <AdminTableHead>Grade</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={5} message="No stacks found." />
          ) : (
            rows.map((s) => (
              <AdminTableRow key={s.id}>
                <AdminPrimaryCell
                  title={
                    <span className="flex items-center gap-1.5">
                      {s.name}
                      {s.ruleCount === 0 && s.catalogStatus === "launch" && (
                        <span className="text-xs font-medium text-[#FFA70B]">⚠ 0 rules</span>
                      )}
                    </span>
                  }
                  subtitle={`${s.slug} · ${s.ecosystem ?? "—"}`}
                  href={`/admin/stacks/${s.id}`}
                />
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">
                    {s.ruleCount} rules
                  </p>
                  <p className="text-body-sm text-dark-6 mt-0.5">
                    {s.threatCount} threats
                  </p>
                </AdminTableCell>
                <AdminTableCell>
                  {s.securityGrade ? (
                    <span className="font-mono text-sm font-bold text-dark dark:text-white">
                      {s.securityGrade}
                    </span>
                  ) : (
                    <span className="text-sm text-dark-6">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <AdminStatusPill status={s.catalogStatus} />
                </AdminTableCell>
                <AdminRowActions viewHref={`/admin/stacks/${s.id}`} />
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
