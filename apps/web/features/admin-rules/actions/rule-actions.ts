"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, rule, ruleLayerMap, ruleStack, ruleThreatMap } from "@/lib/db";
import { computeStrengthScore } from "@/lib/rules-directory-showcase";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireAdmin() {
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

const ruleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  dateAdded: z.string(),
  lastUpdated: z.string(),
  author: z.string().min(1),
  ruleType: z.enum(["pattern", "deps", "config", "runtime"]),
  bodyMdx: z.string().optional(),
  summaryMdx: z.string().optional(),
  certified: z.boolean().optional(),
});

export async function updateRule(id: string, formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const data = ruleSchema.parse({ ...raw, certified: raw.certified === "on" });
  const strengthScore = computeStrengthScore({
    certified: data.certified ?? false,
    bodyMdx: data.bodyMdx,
    lineCount: data.bodyMdx ? data.bodyMdx.split("\n").length : null,
  });
  await db.update(rule).set({ ...data, strengthScore, updatedAt: new Date() }).where(eq(rule.id, id));
  revalidatePath("/admin/rules");
  revalidatePath(`/admin/rules/${id}`);
}

export async function setCertified(id: string, certified: boolean) {
  await requireAdmin();
  await db.update(rule).set({ certified, updatedAt: new Date() }).where(eq(rule.id, id));
  revalidatePath(`/admin/rules/${id}`);
}

export async function assignRuleLayers(ruleId: string, layerIds: string[]) {
  await requireAdmin();
  await db.delete(ruleLayerMap).where(eq(ruleLayerMap.ruleId, ruleId));
  if (layerIds.length) {
    await db.insert(ruleLayerMap).values(layerIds.map((layerId) => ({ ruleId, layerId })));
  }
  revalidatePath(`/admin/rules/${ruleId}`);
}

export async function assignRuleStacks(ruleId: string, stackIds: number[]) {
  await requireAdmin();
  await db.delete(ruleStack).where(eq(ruleStack.ruleId, ruleId));
  if (stackIds.length) {
    await db.insert(ruleStack).values(stackIds.map((stackId) => ({ ruleId, stackId })));
  }
  revalidatePath(`/admin/rules/${ruleId}`);
}
