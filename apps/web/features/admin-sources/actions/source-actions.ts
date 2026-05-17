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

// OWASP ref → layer slug defaults
const OWASP_TO_LAYER: Record<string, string> = {
  "A01": "authorization_access_control",
  "A02": "secrets_management",
  "A03": "input_validation_sanitization",
  "A04": "error_handling_logging",
  "A05": "supply_chain_deps",
  "A06": "supply_chain_deps",
  "A07": "authentication_session",
  "A08": "input_validation_sanitization",
  "A09": "error_handling_logging",
  "A10": "authentication_session",
  "LLM01": "ai_safety",
  "LLM02": "input_validation_sanitization",
  "LLM03": "ai_safety",
  "LLM04": "ai_safety",
  "LLM05": "authentication_session",
  "LLM06": "input_validation_sanitization",
  "LLM07": "ai_safety",
  "LLM08": "secrets_management",
  "LLM09": "supply_chain_deps",
  "LLM10": "ai_safety",
};

// Source → layer defaults
const SOURCE_TO_LAYER: Array<{ source: "nvd" | "osv" | "ghsa" | "cisa_kev" | "aigently" | "mitre_atlas" | "aigently_internal"; layerSlug: string; relevance: "primary" | "secondary" }> = [
  { source: "nvd",               layerSlug: "input_validation_sanitization", relevance: "primary" },
  { source: "nvd",               layerSlug: "authentication_session",        relevance: "secondary" },
  { source: "ghsa",              layerSlug: "supply_chain_deps",             relevance: "primary" },
  { source: "osv",               layerSlug: "supply_chain_deps",             relevance: "primary" },
  { source: "cisa_kev",          layerSlug: "authentication_session",        relevance: "primary" },
  { source: "cisa_kev",          layerSlug: "input_validation_sanitization", relevance: "secondary" },
  { source: "mitre_atlas",       layerSlug: "ai_safety",                    relevance: "primary" },
  { source: "aigently_internal", layerSlug: "authentication_session",        relevance: "primary" },
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
