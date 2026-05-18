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
import { listSubmissions } from "@/lib/admin-queries";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { rows, total } = await listSubmissions({
    page,
    perPage: 20,
    status: params.status === "all" ? undefined : params.status,
    search: params.search,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Submissions"
        description={`${total} total stack submissions`}
      />

      <AdminSearchForm>
        <AdminSearchInput
          placeholder="Search by name…"
          defaultValue={params.search}
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="border-stroke bg-gray-2 text-dark focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white h-11 rounded-sm border px-3 text-sm outline-none"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="onboarding">Onboarding</option>
          <option value="live">Live</option>
        </select>
        <AdminSearchSubmit label="Filter" />
      </AdminSearchForm>

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Submission</AdminTableHead>
            <AdminTableHead>Submitter</AdminTableHead>
            <AdminTableHead>Submitted</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={5} message="No submissions found." />
          ) : (
            rows.map((s) => (
              <AdminTableRow key={s.id}>
                <AdminPrimaryCell
                  title={s.proposedName}
                  subtitle={s.ecosystem ?? "Unknown ecosystem"}
                  href={`/admin/submissions/${s.id}`}
                />
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">
                    {s.submittedBy?.name ?? "Anonymous"}
                  </p>
                  <p className="text-body-sm text-dark-6 mt-0.5 truncate">
                    {s.submittedBy?.email ?? "—"}
                  </p>
                </AdminTableCell>
                <AdminTableCell>
                  <p className="text-dark text-sm dark:text-white">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </AdminTableCell>
                <AdminTableCell>
                  <AdminStatusPill status={s.status} />
                </AdminTableCell>
                <AdminRowActions viewHref={`/admin/submissions/${s.id}`} />
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
