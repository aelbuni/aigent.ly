import type { Metadata } from "next";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { AdminShell } from "@/components/nextadmin/admin-shell";
import { getAdminOverviewStats } from "@/lib/admin-queries";
import { redirect } from "next/navigation";

import { AdminProviders } from "./_components/admin-providers";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin | Aigent.ly",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!ADMIN_BYPASS && (!session || session.user?.role !== "admin")) {
    redirect("/");
  }

  const effectiveSession = session ?? { user: { name: "Dev", email: "", role: "admin", id: "dev", image: null, emailVerified: null }, expires: "2099-01-01T00:00:00.000Z" };

  const stats = await getAdminOverviewStats();
  const badgeCounts: Record<string, number> = {
    pendingSubmissions: stats.pendingSubmissions,
    stackCount: stats.stackCount,
  };

  return (
    <div className="admin-root min-h-svh">
      <AdminProviders session={effectiveSession}>
        <AdminShell badgeCounts={badgeCounts}>{children}</AdminShell>
      </AdminProviders>
    </div>
  );
}
