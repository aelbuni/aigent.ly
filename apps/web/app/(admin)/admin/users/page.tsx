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
import { updateUserRole } from "@/features/admin-users/actions/user-actions";
import { auth } from "@/auth";
import { listUsers } from "@/lib/admin-queries";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const session = await auth();
  const { rows, total } = await listUsers({ page, perPage: 25, search: params.search });

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Users" description={`${total} registered users`} />

      <AdminSearchForm>
        <AdminSearchInput
          placeholder="Search users…"
          defaultValue={params.search}
        />
        <AdminSearchSubmit />
      </AdminSearchForm>

      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>User</AdminTableHead>
            <AdminTableHead>Role</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={3} message="No users found." />
          ) : (
            rows.map((u) => {
              const isSelf = u.id === session?.user?.id;
              return (
                <AdminTableRow key={u.id}>
                  <AdminPrimaryCell
                    title={u.name ?? "—"}
                    subtitle={u.email ?? "—"}
                  />
                  <AdminTableCell>
                    <AdminStatusPill status={u.role} />
                    {isSelf && (
                      <p className="text-dark-6 mt-1 text-xs">(you)</p>
                    )}
                  </AdminTableCell>
                  <AdminRowActions
                    extra={
                      !isSelf ? (
                        <form
                          action={updateUserRole.bind(
                            null,
                            u.id,
                            u.role === "admin" ? "user" : "admin",
                          )}
                        >
                          <button
                            type="submit"
                            className="border-stroke text-dark hover:border-primary dark:border-dark-3 rounded-sm border px-2.5 py-1 text-xs font-medium"
                          >
                            {u.role === "admin" ? "Demote" : "Promote"}
                          </button>
                        </form>
                      ) : undefined
                    }
                  />
                </AdminTableRow>
              );
            })
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
