"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, user } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  if (ADMIN_BYPASS) return null;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  return session;
}

export async function updateUserRole(userId: string, role: "admin" | "user") {
  const session = await requireAdmin();
  if (session?.user?.id === userId) {
    throw new Error("You cannot change your own role.");
  }
  await db.update(user).set({ role }).where(eq(user.id, userId));
  revalidatePath("/admin/users");
}
