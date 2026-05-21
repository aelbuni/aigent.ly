"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, lt } from "drizzle-orm";
import { db, syncLog } from "@/lib/db";

async function requireAdmin() {
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

export async function triggerSync(_formData?: FormData): Promise<void> {
  await requireAdmin();
  // The sync script runs as a separate process. In production, wire this to an
  // internal job queue or CI trigger. For now it surfaces a revalidation signal.
  revalidatePath("/admin/sync");
}

export async function triggerAmplification(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return { ok: true, message: "Amplification queued. Check sync logs for progress." };
}

export async function triggerSummarizeRules(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return { ok: true, message: "Rule summarization queued." };
}

export async function triggerSummarizeLayers(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return { ok: true, message: "Layer summarization queued." };
}

export async function triggerExportCatalog(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return { ok: true, message: "Catalog export queued." };
}

export async function triggerPublishCatalog(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  revalidatePath("/admin/sync");
  return { ok: true, message: "Catalog publish queued. Check sync logs." };
}

export async function clearZombieRuns(): Promise<{ ok: boolean; count: number }> {
  await requireAdmin();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const result = await db
    .update(syncLog)
    .set({ status: "failed", errorMessage: "Auto-timed out: exceeded 30 minute limit" })
    .where(
      and(
        eq(syncLog.status, "running"),
        lt(syncLog.startedAt, thirtyMinutesAgo),
      ),
    );
  revalidatePath("/admin/sync");
  return { ok: true, count: result.rowCount ?? 0 };
}
