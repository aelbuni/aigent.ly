import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-heading-5 text-dark font-bold dark:text-white">{title}</h1>
        {description && (
          <p className="text-dark-6 mt-1 font-medium">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AdminPrimaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-sm font-medium text-white transition-colors"
    >
      {children}
    </Link>
  );
}

export function AdminSearchForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <form className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </form>
  );
}

export function AdminSearchInput({
  name = "search",
  placeholder,
  defaultValue,
  className,
}: {
  name?: string;
  placeholder: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      name={name}
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={cn(
        "border-stroke bg-white text-dark focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white h-11 min-w-[200px] max-w-xs flex-1 rounded-sm border px-4 text-sm outline-none transition-colors",
        className,
      )}
    />
  );
}

export function AdminSearchSubmit({ label = "Search" }: { label?: string }) {
  return (
    <button
      type="submit"
      className="border-stroke text-dark hover:border-primary hover:bg-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:border-primary dark:hover:bg-primary h-11 rounded-sm border bg-white px-5 text-sm font-medium transition-colors hover:text-white"
    >
      {label}
    </button>
  );
}

export function AdminPagination({
  page,
  perPage,
  total,
  searchParams = {},
}: {
  page: number;
  perPage: number;
  total: number;
  searchParams?: Record<string, string | undefined>;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v) params.set(k, v);
    }
    params.set("page", String(p));
    return `?${params.toString()}`;
  };

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-dark-6 text-sm">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="border-stroke text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white inline-flex size-9 items-center justify-center rounded-sm border bg-white transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className="border-stroke text-dark-5 dark:border-dark-3 dark:bg-dark-2 inline-flex size-9 items-center justify-center rounded-sm border bg-white opacity-40">
            <ChevronLeft className="size-4" />
          </span>
        )}

        <span className="text-dark dark:text-white px-2 text-sm font-medium">
          {page} / {totalPages}
        </span>

        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            className="border-stroke text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white inline-flex size-9 items-center justify-center rounded-sm border bg-white transition-colors"
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className="border-stroke text-dark-5 dark:border-dark-3 dark:bg-dark-2 inline-flex size-9 items-center justify-center rounded-sm border bg-white opacity-40">
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
