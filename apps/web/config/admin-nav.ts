import {
  AlertTriangle,
  BarChart2,
  Bot,
  Cpu,
  FileText,
  Inbox,
  LayoutDashboard,
  Layers,
  RefreshCw,
  Route,
  Shield,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  badge?: "pendingSubmissions" | "stackCount";
  badgeVariant?: "default" | "destructive" | "secondary" | "outline";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const adminNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Stacks", url: "/admin/stacks", icon: Layers, badge: "stackCount" },
      {
        title: "Submissions",
        url: "/admin/submissions",
        icon: Inbox,
        badge: "pendingSubmissions",
        badgeVariant: "destructive",
      },
      { title: "Rules", url: "/admin/rules", icon: Shield },
      { title: "Threats", url: "/admin/threats", icon: AlertTriangle },
      { title: "Patterns", url: "/admin/patterns", icon: FileText },
    ],
  },
  {
    label: "Data Sources",
    items: [
      { title: "Source Routing", url: "/admin/sources", icon: Route },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Guardrails", url: "/admin/guardrails", icon: Bot },
      { title: "Guardrail Eval", url: "/admin/guardrails/evaluation", icon: BarChart2 },
      { title: "LLM Config", url: "/admin/llm", icon: Cpu },
      { title: "Users", url: "/admin/users", icon: Users },
      { title: "Sync Logs", url: "/admin/sync", icon: RefreshCw },
    ],
  },
];
