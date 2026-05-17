"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, stack } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireAdmin() {
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

const stackSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  logoPath: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  catalogStatus: z.enum(["launch", "coming_soon"]),
  ecosystem: z.string().optional(),
  securityGrade: z.string().optional(),
  gradeRationale: z.string().optional(),
  osvEcosystem: z.string().optional(),
  nvdKeywords: z.array(z.string()).optional(),
});

export async function createStack(formData: FormData) {
  await requireAdmin();
  const data = stackSchema.parse(Object.fromEntries(formData));
  const [created] = await db.insert(stack).values(data).returning({ id: stack.id });
  revalidatePath("/admin/stacks");
  redirect(`/admin/stacks/${created.id}`);
}

export async function updateStack(id: number, formData: FormData) {
  await requireAdmin();
  const data = stackSchema.parse(Object.fromEntries(formData));
  await db.update(stack).set({ ...data, }).where(eq(stack.id, id));
  revalidatePath("/admin/stacks");
  revalidatePath(`/admin/stacks/${id}`);
}

// Called via form action: deleteStack.bind(null, stackId) — _formData is supplied by the form but unused
export async function deleteStack(id: number, _formData?: FormData) {
  await requireAdmin();
  await db.delete(stack).where(eq(stack.id, id));
  revalidatePath("/admin/stacks");
  redirect("/admin/stacks");
}

