"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, stack, stackSubmission } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  if (ADMIN_BYPASS) return null;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  return session;
}

export async function startReview(id: string) {
  await requireAdmin();
  await db.update(stackSubmission).set({ status: "under_review" }).where(eq(stackSubmission.id, id));
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${id}`);
}

export async function approveAndOnboard(id: string) {
  await requireAdmin();

  const rows = await db.select().from(stackSubmission).where(eq(stackSubmission.id, id)).limit(1);
  const sub = rows[0];
  if (!sub) return;

  // Idempotency guard: bail out if already approved or linked to a stack
  if (sub.linkedStackId) {
    revalidatePath("/admin/submissions");
    return; // Already approved and linked — idempotent
  }
  if (sub.status === "onboarding" || sub.status === "live") {
    revalidatePath("/admin/submissions");
    return; // Already past approval stage
  }

  const [newStack] = await db
    .insert(stack)
    .values({
      slug: sub.proposedSlug,
      name: sub.proposedName,
      ecosystem: sub.ecosystem,
      catalogStatus: "coming_soon",
      sortOrder: 999,
    })
    .returning({ id: stack.id });

  await db
    .update(stackSubmission)
    .set({
      status: "onboarding",
      linkedStackId: newStack.id,
      stepStackCreated: true,
      reviewedAt: new Date(),
    })
    .where(eq(stackSubmission.id, id));

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${id}`);
  redirect(`/admin/stacks/${newStack.id}`);
}

export async function rejectSubmission(id: string, reviewNotes: string) {
  await requireAdmin();
  await db
    .update(stackSubmission)
    .set({ status: "rejected", reviewNotes, reviewedAt: new Date() })
    .where(eq(stackSubmission.id, id));
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${id}`);
}

export async function updateReviewNotes(id: string, reviewNotes: string) {
  await requireAdmin();
  await db.update(stackSubmission).set({ reviewNotes }).where(eq(stackSubmission.id, id));
  revalidatePath(`/admin/submissions/${id}`);
}

const STEP_COLUMN_MAP = {
  stack_record_created:  "stepStackCreated",
  logo_uploaded:         "stepLogoUploaded",
  rules_assigned:        "stepRulesAssigned",
  threats_synced:        "stepThreatsSynced",
  coverage_areas_filled: "stepCoverageFilled",
  published:             "stepPublished",
} as const;

type StepKey = keyof typeof STEP_COLUMN_MAP;

export async function updateOnboardingStep(id: string, step: string, value: boolean) {
  await requireAdmin();

  const col = STEP_COLUMN_MAP[step as StepKey];
  if (!col) return;

  await db
    .update(stackSubmission)
    .set({ [col]: value })
    .where(eq(stackSubmission.id, id));

  // Promote to live when all steps complete
  const rows = await db
    .select({
      a: stackSubmission.stepStackCreated,
      b: stackSubmission.stepLogoUploaded,
      c: stackSubmission.stepRulesAssigned,
      d: stackSubmission.stepThreatsSynced,
      e: stackSubmission.stepCoverageFilled,
      f: stackSubmission.stepPublished,
    })
    .from(stackSubmission)
    .where(eq(stackSubmission.id, id))
    .limit(1);

  const s = rows[0];
  if (s?.a && s.b && s.c && s.d && s.e && s.f) {
    await db.update(stackSubmission).set({ status: "live" }).where(eq(stackSubmission.id, id));
  }

  revalidatePath(`/admin/submissions/${id}`);
}
