import { getAdminOverviewStats, listSubmissions } from "@/lib/admin-queries";
import { compactFormat } from "@/lib/format-number";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/nextadmin/ui/table";
import { OverviewCard } from "./card";
import * as icons from "./icons";

export async function CatalogOverviewCards() {
  const stats = await getAdminOverviewStats();

  const cards = [
    {
      label: "Stacks",
      value: compactFormat(stats.stackCount),
      growthRate: 0,
      Icon: icons.Product,
    },
    {
      label: "Rules",
      value: compactFormat(stats.ruleCount),
      growthRate: 0,
      Icon: icons.Views,
    },
    {
      label: "Threats",
      value: compactFormat(stats.threatCount),
      growthRate: 0,
      Icon: icons.Profit,
    },
    {
      label: "Pending submissions",
      value: compactFormat(stats.pendingSubmissions),
      growthRate: stats.pendingSubmissions > 0 ? 1 : 0,
      Icon: icons.Users,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
      {cards.map((card) => (
        <OverviewCard
          key={card.label}
          label={card.label}
          data={{ value: card.value, growthRate: card.growthRate }}
          Icon={card.Icon}
        />
      ))}
    </div>
  );
}

export async function PendingSubmissionsTable() {
  const { rows } = await listSubmissions({
    page: 1,
    perPage: 8,
    status: "pending",
  });

  return (
    <div className="dark:bg-gray-dark dark:shadow-card col-span-12 grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-body-2xlg text-dark font-bold dark:text-white">
          Pending submissions
        </h2>
        <Link
          href="/admin/submissions"
          className="text-primary text-sm font-medium hover:underline"
        >
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-dark-6 py-6 text-sm">No pending submissions.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-none uppercase [&>th]:text-left">
              <TableHead>Stack</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="text-dark text-base font-medium dark:text-white"
              >
                <TableCell>
                  <Link
                    href={`/admin/submissions/${row.id}`}
                    className="text-primary hover:underline"
                  >
                    {row.proposedName}
                  </Link>
                </TableCell>
                <TableCell>{row.submittedBy?.email ?? "—"}</TableCell>
                <TableCell>
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleDateString()
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
