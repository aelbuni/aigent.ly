"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, layer, stack, summarizedGuardrail } from "@/lib/db";
import { amplifyThreatsForLayer } from "@/lib/amplifier/pipeline";
import { summarizeRulesForStack } from "@/lib/rule-summarizer/pipeline";
import { runSummarizerForLayer } from "@/lib/summarizer/pipeline";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

/**
 * Override the quality score for a guardrail and trigger a score-guided regeneration.
 * The previous score (or override) is fed into the synthesis prompt as a feedback signal.
 */
export async function scoreAndRegenerate(
  id: string,
  overrideScore?: number,
  scoreNote?: string
) {
  await requireAdmin();

  const [row] = await db
    .select({
      id: summarizedGuardrail.id,
      stackId: summarizedGuardrail.stackId,
      contentType: summarizedGuardrail.contentType,
      qualityScore: summarizedGuardrail.qualityScore,
      stackSlug: stack.slug,
    })
    .from(summarizedGuardrail)
    .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
    .where(eq(summarizedGuardrail.id, id))
    .limit(1);

  if (!row) return;

  // Save override score and note before regenerating
  if (overrideScore !== undefined) {
    await db
      .update(summarizedGuardrail)
      .set({ scoreOverride: overrideScore, scoreNote: scoreNote ?? null })
      .where(eq(summarizedGuardrail.id, id));
  }

  // Use a representative layer slug for the summarizer call
  const layerSlug = row.contentType === "deps" ? "dependency_supply" : "auth_session";
  // Stage 1: amplify un-amplified threats linked to this rule type's rules
  await amplifyThreatsForLayer(row.stackSlug, layerSlug);
  // Stage 2: summarize any unsummarized rules for this stack
  await summarizeRulesForStack(row.stackSlug);
  // Stage 3: force-regenerate (bypass cache — rule bodies may be unchanged)
  const previousScore = overrideScore ?? row.qualityScore ?? undefined;
  await runSummarizerForLayer(row.stackSlug, layerSlug, row.contentType, previousScore, true);

  revalidatePath("/admin/guardrails");
  revalidatePath("/admin/guardrails/evaluation");
}
