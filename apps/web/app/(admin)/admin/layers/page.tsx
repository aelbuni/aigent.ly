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
} from "@/components/nextadmin/admin-page-header";
import { listLayers } from "@/lib/admin-queries";
import { Plus } from "lucide-react";

export default async function LayersPage() {
  const layers = await listLayers();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Layers"
        description={`${layers.length} protection layers`}
        action={
          <AdminPrimaryButton href="/admin/layers/new">
            <Plus className="size-4" />
            New Layer
          </AdminPrimaryButton>
        }
      />

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Layer</AdminTableHead>
            <AdminTableHead>Catalog</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {layers.length === 0 ? (
            <AdminEmptyState colSpan={4} message="No layers found." />
          ) : (
            layers.map((l) => (
              <AdminTableRow key={l.id} className={!l.isActive ? "opacity-60" : ""}>
                <AdminPrimaryCell
                  title={l.name}
                  subtitle={l.slug}
                  href={`/admin/layers/${l.id}`}
                />
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">
                    {l.ruleCount} rules · {l.threatCount} threats
                  </p>
                  <p className="text-body-sm text-dark-6 mt-0.5">
                    {l.policyCount} patterns
                  </p>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {l.isSystem && <AdminStatusPill status="system" />}
                    {!l.isActive && <AdminStatusPill status="inactive" />}
                    {l.isActive && !l.isSystem && (
                      <AdminStatusPill status="active" />
                    )}
                  </div>
                </AdminTableCell>
                <AdminRowActions viewHref={`/admin/layers/${l.id}`} />
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
