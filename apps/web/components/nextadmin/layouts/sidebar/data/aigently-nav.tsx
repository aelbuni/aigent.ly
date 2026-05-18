import { adminNavGroups } from "@/config/admin-nav";
import type { LucideIcon } from "lucide-react";
import type { SVGProps } from "react";
import * as Icons from "../icons";

function lucideNavIcon(Icon: LucideIcon) {
  return function NavIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon className="size-6 shrink-0" aria-hidden {...props} />;
  };
}

export const NAV_DATA = adminNavGroups.map((group) => ({
  label: group.label.toUpperCase(),
  items: group.items.map((item) => ({
    title: item.title,
    url: item.url,
    icon: lucideNavIcon(item.icon),
    items: [] as { title: string; url: string }[],
  })),
}));

/** Fallback icons for overview-style pages */
export { Icons };
