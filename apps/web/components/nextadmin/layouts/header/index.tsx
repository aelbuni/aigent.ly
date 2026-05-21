"use client";

import { SearchIcon } from "@/components/nextadmin/assets/icons";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { Notification } from "./notification";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Dashboard",
  llm: "LLM Config",
  sync: "Pipeline Sync",
  guardrails: "Guardrails",
  sources: "Source Routing",
  submissions: "Submissions",
  threats: "Threats",
  stacks: "Stacks",
  rules: "Rules",
  layers: "Layers",
  users: "Users",
  evaluation: "Evaluation",
  patterns: "Patterns",
  "new": "New",
};

/** Returns true for UUID v4 segments (e.g. rule / guardrail IDs). */
function isUuid(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    segment,
  );
}

/** Returns true for CVE IDs and similar identifier patterns (e.g. CVE-2024-47831, GHSA-xxx-yyy). */
function isIdentifier(segment: string): boolean {
  return /^CVE-/i.test(segment) || /^[A-Z]+-\d/i.test(segment);
}

function titleFromPath(pathname: string): string {
  if (pathname === "/admin") return "Dashboard";

  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "admin";
  const parent = parts[parts.length - 2] ?? "admin";

  // If the last segment is an ID (UUID or CVE/identifier), derive title from parent
  if (isUuid(last) || isIdentifier(last)) {
    const parentLabel = SEGMENT_LABELS[parent];
    if (parentLabel) return `${parentLabel} Detail`;
    return "Detail";
  }

  // Known label lookup
  if (SEGMENT_LABELS[last]) return SEGMENT_LABELS[last];

  // Fallback: humanize kebab-case
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const pathname = usePathname();
  const title = titleFromPath(pathname);

  return (
    <header className="border-stroke shadow-1 dark:border-stroke-dark dark:bg-gray-dark sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-5 md:px-5 2xl:px-10">
      <button
        type="button"
        onClick={toggleSidebar}
        className="dark:border-stroke-dark rounded-lg border px-1.5 py-1 lg:hidden dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A]"
      >
        <MenuIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {isMobile && (
        <Link href="/admin" className="2xsm:ml-4 ml-2 max-[430px]:hidden">
          <Image
            src="/images/logo/logo-icon.svg"
            width={32}
            height={32}
            alt=""
            role="presentation"
          />
        </Link>
      )}

      <div className="max-xl:hidden">
        <h1 className="text-heading-5 text-dark mb-0.5 font-bold dark:text-white">
          {title}
        </h1>
        <p className="font-medium text-dark-6">Aigent.ly catalog admin</p>
      </div>

      <div className="2xsm:gap-4 flex flex-1 items-center justify-end gap-2">
        <form
          action="/admin/search"
          method="GET"
          className="relative hidden w-full max-w-75 md:block"
        >
          <input
            type="search"
            name="q"
            placeholder="Search catalog"
            className="bg-gray-2 focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary flex w-full items-center gap-3.5 rounded-full border py-3 pr-5 pl-13.25 transition-colors outline-none"
          />
          <SearchIcon className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 max-[1015px]:size-5" />
        </form>

        <ThemeToggleSwitch />
        <Notification />
        <div className="shrink-0">
          <UserInfo />
        </div>
      </div>
    </header>
  );
}
