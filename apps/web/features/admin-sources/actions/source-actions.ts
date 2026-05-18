"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, owaspLayerMapping, sourceLayerMapping, threat, threatLayer, layer } from "@/lib/db";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assignThreatLayers } from "@/scripts/lib/assign-threat-layers";

async function requireAdmin() {
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

export async function upsertSourceMapping(
  source: string,
  layerId: string,
  relevance: "primary" | "secondary",
  notes?: string
) {
  await requireAdmin();
  await db
    .insert(sourceLayerMapping)
    .values({ source: source as "nvd" | "osv" | "ghsa" | "cisa_kev" | "aigently" | "mitre_atlas" | "aigently_internal", layerId, relevance, notes })
    .onConflictDoUpdate({
      target: [sourceLayerMapping.source, sourceLayerMapping.layerId],
      set: { relevance, notes },
    });
  revalidatePath("/admin/sources");
}

export async function deleteSourceMapping(id: string) {
  await requireAdmin();
  await db.delete(sourceLayerMapping).where(eq(sourceLayerMapping.id, id));
  revalidatePath("/admin/sources");
}

export async function toggleSourceMappingActive(id: string, isActive: boolean) {
  await requireAdmin();
  await db.update(sourceLayerMapping).set({ isActive }).where(eq(sourceLayerMapping.id, id));
  revalidatePath("/admin/sources");
}

export async function updateOwaspMapping(id: number, layerId: string, relevance: "primary" | "secondary") {
  await requireAdmin();
  await db.update(owaspLayerMapping).set({ layerId, relevance }).where(eq(owaspLayerMapping.id, id));
  revalidatePath("/admin/sources");
}

export async function toggleOwaspMappingActive(id: number, isActive: boolean) {
  await requireAdmin();
  await db.update(owaspLayerMapping).set({ isActive }).where(eq(owaspLayerMapping.id, id));
  revalidatePath("/admin/sources");
}

export async function reAssignAllThreatLayers(_formData?: FormData): Promise<void> {
  await requireAdmin();
  const threats = await db.select({ publicId: threat.publicId }).from(threat);
  const ids = threats.map((t) => t.publicId);
  await assignThreatLayers(ids);
  revalidatePath("/admin/sources");
}

// OWASP ref → layer slug defaults (slugs must match the `layer.slug` column exactly)
const OWASP_TO_LAYER: Record<string, string> = {
  "A01": "authz_access",
  "A02": "secrets_credentials",
  "A03": "input_validation",
  "A04": "observability",
  "A05": "dependency_supply",
  "A06": "dependency_supply",
  "A07": "auth_session",
  "A08": "input_validation",
  "A09": "observability",
  "A10": "auth_session",
  "LLM01": "ai_safety",
  "LLM02": "input_validation",
  "LLM03": "ai_safety",
  "LLM04": "ai_safety",
  "LLM05": "auth_session",
  "LLM06": "input_validation",
  "LLM07": "ai_safety",
  "LLM08": "secrets_credentials",
  "LLM09": "dependency_supply",
  "LLM10": "ai_safety",
};

// Source → layer defaults (slugs must match the `layer.slug` column exactly)
const SOURCE_TO_LAYER: Array<{ source: "nvd" | "osv" | "ghsa" | "cisa_kev" | "aigently" | "mitre_atlas" | "aigently_internal"; layerSlug: string; relevance: "primary" | "secondary" }> = [
  { source: "nvd",               layerSlug: "input_validation",   relevance: "primary" },
  { source: "nvd",               layerSlug: "auth_session",        relevance: "secondary" },
  { source: "ghsa",              layerSlug: "dependency_supply",   relevance: "primary" },
  { source: "osv",               layerSlug: "dependency_supply",   relevance: "primary" },
  { source: "cisa_kev",          layerSlug: "auth_session",        relevance: "primary" },
  { source: "cisa_kev",          layerSlug: "input_validation",    relevance: "secondary" },
  { source: "mitre_atlas",       layerSlug: "ai_safety",           relevance: "primary" },
  { source: "aigently_internal", layerSlug: "auth_session",        relevance: "primary" },
];

export async function loadDefaultSourceMappings(): Promise<void> {
  await requireAdmin();

  const allLayers = await db.select({ id: layer.id, slug: layer.slug }).from(layer);
  const layerBySlug = new Map(allLayers.map((l) => [l.slug, l.id]));

  // Insert source → layer mappings (skip if already exists)
  for (const mapping of SOURCE_TO_LAYER) {
    const layerId = layerBySlug.get(mapping.layerSlug);
    if (!layerId) continue;
    await db
      .insert(sourceLayerMapping)
      .values({
        source: mapping.source,
        layerId,
        relevance: mapping.relevance,
        isActive: true,
        notes: "Auto-loaded default",
      })
      .onConflictDoNothing();
  }

  // Insert OWASP → layer mappings (skip if already exists)
  for (const [owaspRef, layerSlug] of Object.entries(OWASP_TO_LAYER)) {
    const layerId = layerBySlug.get(layerSlug);
    if (!layerId) continue;
    await db
      .insert(owaspLayerMapping)
      .values({
        owaspRef,
        layerId,
        relevance: "primary",
        isActive: true,
      })
      .onConflictDoNothing();
  }

  revalidatePath("/admin/sources");
}
