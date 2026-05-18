import { TrashIcon } from "@/components/nextadmin/assets/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/nextadmin/ui/table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

import { DownloadIcon, PreviewIcon } from "./table-icons";

const HEADER_ROW_CLASS =
  "border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-base [&>th]:font-medium [&>th]:text-dark dark:[&>th]:text-white";

const BODY_ROW_CLASS = "border-[#eee] dark:border-dark-3";

export function AdminDataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card sm:p-7.5",
        className,
      )}
    >
      <Table>{children}</Table>
    </div>
  );
}

export function AdminTableHeader({ children }: { children: ReactNode }) {
  return <TableHeader>{children}</TableHeader>;
}

export function AdminTableHeaderRow({ children }: { children: ReactNode }) {
  return <TableRow className={HEADER_ROW_CLASS}>{children}</TableRow>;
}

export function AdminTableHead({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <TableHead
      className={cn(
        align === "right" && "text-right xl:pr-7.5",
        align === "left" && "xl:pl-7.5",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <TableBody>{children}</TableBody>;
}

export function AdminTableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <TableRow className={cn(BODY_ROW_CLASS, className)}>{children}</TableRow>;
}

export function AdminTableCell({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
  colSpan?: number;
}) {
  return (
    <TableCell
      colSpan={colSpan}
      className={cn(
        align === "right" && "xl:pr-7.5",
        align === "left" && "xl:pl-7.5",
        className,
      )}
    >
      {children}
    </TableCell>
  );
}

export function AdminPrimaryCell({
  title,
  subtitle,
  href,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <h5 className="text-dark dark:text-white">{title}</h5>
      {subtitle != null && (
        <p className="text-body-sm mt-[3px] font-medium text-dark-6">{subtitle}</p>
      )}
    </>
  );

  return (
    <AdminTableCell className="min-w-[155px]">
      {href ? (
        <Link href={href} className="hover:text-primary block">
          {content}
        </Link>
      ) : (
        content
      )}
    </AdminTableCell>
  );
}

const STATUS_PILL_CLASSES: Record<string, string> = {
  paid: "bg-[#219653]/8 text-[#219653]",
  approved: "bg-[#219653]/8 text-[#219653]",
  launch: "bg-[#219653]/8 text-[#219653]",
  live: "bg-[#219653]/8 text-[#219653]",
  done: "bg-[#219653]/8 text-[#219653]",
  low: "bg-[#219653]/8 text-[#219653]",
  active: "bg-[#219653]/8 text-[#219653]",
  unpaid: "bg-[#D34053]/8 text-[#D34053]",
  rejected: "bg-[#D34053]/8 text-[#D34053]",
  critical: "bg-[#D34053]/8 text-[#D34053]",
  error: "bg-[#D34053]/8 text-[#D34053]",
  expired: "bg-[#D34053]/8 text-[#D34053]",
  pending: "bg-[#FFA70B]/8 text-[#FFA70B]",
  high: "bg-[#FFA70B]/8 text-[#FFA70B]",
  under_review: "bg-[#FFA70B]/8 text-[#FFA70B]",
  running: "bg-[#FFA70B]/8 text-[#FFA70B]",
  onboarding: "bg-[#FFA70B]/8 text-[#FFA70B]",
  medium: "bg-[#3C50E0]/8 text-[#3C50E0]",
  default: "bg-[#3C50E0]/8 text-[#3C50E0]",
  admin: "bg-[#3C50E0]/8 text-[#3C50E0]",
  pattern: "bg-[#3C50E0]/8 text-[#3C50E0]",
  info: "bg-gray-3 text-dark-6",
  outline: "bg-gray-3 text-dark-6",
  secondary: "bg-gray-3 text-dark-6",
  coming_soon: "bg-gray-3 text-dark-6",
  inactive: "bg-gray-3 text-dark-6",
  deps: "bg-gray-3 text-dark-6",
  config: "bg-gray-3 text-dark-6",
  runtime: "bg-gray-3 text-dark-6",
  user: "bg-gray-3 text-dark-6",
  primary: "bg-[#3C50E0]/8 text-[#3C50E0]",
  system: "bg-gray-3 text-dark-6",
};

export function getStatusPillClass(status: string): string {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  return STATUS_PILL_CLASSES[key] ?? "bg-gray-3 text-dark-6";
}

export function AdminStatusPill({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <div
      className={cn(
        "max-w-fit rounded-full px-3.5 py-1 text-sm font-medium capitalize",
        getStatusPillClass(status),
      )}
    >
      {label}
    </div>
  );
}

export function AdminRowActions({
  viewHref,
  downloadHref,
  deleteAction,
  extra,
}: {
  viewHref?: string;
  downloadHref?: string;
  deleteAction?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <AdminTableCell align="right">
      <div className="flex items-center justify-end gap-x-3.5">
        {extra}
        {viewHref && (
          <Link
            href={viewHref}
            className="text-dark-6 hover:text-primary dark:text-dark-6"
          >
            <span className="sr-only">View</span>
            <PreviewIcon />
          </Link>
        )}
        {deleteAction}
        {downloadHref && (
          <Link
            href={downloadHref}
            className="text-dark-6 hover:text-primary dark:text-dark-6"
          >
            <span className="sr-only">Download</span>
            <DownloadIcon />
          </Link>
        )}
      </div>
    </AdminTableCell>
  );
}

export function AdminDeleteButton({
  formAction,
  label = "Delete",
}: {
  formAction: () => void | Promise<void>;
  label?: string;
}) {
  return (
    <form action={formAction}>
      <button
        type="submit"
        className="text-dark-6 hover:text-primary cursor-pointer dark:text-dark-6"
      >
        <span className="sr-only">{label}</span>
        <TrashIcon />
      </button>
    </form>
  );
}

export function AdminEmptyState({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <AdminTableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-dark-6">
        {message}
      </TableCell>
    </AdminTableRow>
  );
}
