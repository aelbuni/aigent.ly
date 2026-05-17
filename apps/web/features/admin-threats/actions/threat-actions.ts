"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, threat, threatLayer, threatStack } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireAdmin() {
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

const threatSchema = z.object({
  publicId: z.string().min(1),
  externalId: z.string().optional(),
  cveId: z.string().optional(),
  source: z.enum(["nvd", "osv", "ghsa", "cisa_kev", "aigently", "mitre_atlas", "aigently_internal"]),
  family: z.enum(["owasp_web", "owasp_llm", "mitre_atlas", "vibe_coding"]),
  name: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  description: z.string().optional(),
  aiAmplification: z.string().optional().transform((v) => {
    if (!v) return undefined;
    try { return JSON.parse(v) as Record<string, unknown>; } catch { return undefined; }
  }),
  sourceUrl: z.string().optional(),
  isActivelyExploited: z.boolean().optional(),
  cisaActionDue: z.string().optional(),
  patchedVersion: z.string().optional(),
});

export async function createThreat(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const data = threatSchema.parse({ ...raw, isActivelyExploited: raw.isActivelyExploited === "on" });

  const owaspRefs = formData.getAll("owaspRefs") as string[];
  const mitreAttackIds = formData.getAll("mitreAttackIds") as string[];

  await db.insert(threat).values({
    ...data,
    owaspRefs,
    mitreAttackIds,
    affectedProducts: {},
  });

  revalidatePath("/admin/threats");
  redirect(`/admin/threats/${data.publicId}`);
}

export async function updateThreat(publicId: string, formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const { publicId: _, ...data } = threatSchema.parse({ publicId, ...raw, isActivelyExploited: raw.isActivelyExploited === "on" });

  const owaspRefs = formData.getAll("owaspRefs") as string[];
  const mitreAttackIds = formData.getAll("mitreAttackIds") as string[];

  await db.update(threat).set({ ...data, owaspRefs, mitreAttackIds, updatedAt: new Date() }).where(eq(threat.publicId, publicId));
  revalidatePath("/admin/threats");
  revalidatePath(`/admin/threats/${publicId}`);
}

export async function assignThreatStacks(
  threatId: string,
  entries: { stackId: number; severity: "critical" | "high" | "medium" | "low" | "info" }[]
) {
  await requireAdmin();
  await db.delete(threatStack).where(eq(threatStack.threatId, threatId));
  if (entries.length) {
    await db.insert(threatStack).values(
      entries.map((e) => ({ threatId, stackId: e.stackId, severity: e.severity, isMitigatedByRules: false }))
    );
  }
  revalidatePath(`/admin/threats/${threatId}`);
}

export async function assignThreatLayers(
  threatId: string,
  layers: { layerId: string; relevance: "primary" | "secondary"; rationale?: string }[]
) {
  await requireAdmin();
  await db.delete(threatLayer).where(eq(threatLayer.threatId, threatId));
  if (layers.length) {
    await db.insert(threatLayer).values(layers.map((l) => ({ threatId, ...l })));
  }
  revalidatePath(`/admin/threats/${threatId}`);
}
