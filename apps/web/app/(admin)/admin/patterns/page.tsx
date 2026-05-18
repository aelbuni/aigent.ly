import {
  AdminDataTable,
  AdminEmptyState,
  AdminPrimaryCell,
  AdminRowActions,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
  AdminTableHeaderRow,
  AdminTableRow,
} from "@/components/nextadmin/admin-data-table";
import { AdminPageHeader } from "@/components/nextadmin/admin-page-header";
import { listPatterns } from "@/lib/admin-queries";

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { rows, total } = await listPatterns({ page, perPage: 25 });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Policy Patterns"
        description={`${total} patterns`}
      />

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Pattern</AdminTableHead>
            <AdminTableHead>Stacks</AdminTableHead>
            <AdminTableHead>Layer</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={4} message="No patterns found." />
          ) : (
            rows.map((p) => (
              <AdminTableRow key={p.id}>
                <AdminPrimaryCell
                  title={p.name}
                  subtitle={p.slug}
                  href={`/admin/patterns/${p.id}`}
                />
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">
                    {p.stackCount} stacks
                  </p>
                </AdminTableCell>
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">{p.layerName}</p>
                </AdminTableCell>
                <AdminRowActions viewHref={`/admin/patterns/${p.id}`} />
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
