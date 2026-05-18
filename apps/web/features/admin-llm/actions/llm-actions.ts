"use server";

import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, llmConfig, llmTaskConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { LLMTask } from "@/lib/admin-queries";

async function requireAdmin() {
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

/** Save global LLM config (provider, default model, summarizer toggle). */
export async function saveLLMConfig(formData: FormData) {
  await requireAdmin();

  const provider = formData.get("provider") as "anthropic" | "bedrock";
  const defaultModel = formData.get("defaultModel") as string;
  const summarizerEnabled = formData.get("summarizerEnabled") === "on";

  const existing = await db.select({ id: llmConfig.id }).from(llmConfig).limit(1);

  if (existing[0]) {
    await db
      .update(llmConfig)
      .set({ provider, defaultModel, summarizerEnabled, updatedAt: new Date() })
      .where(eq(llmConfig.id, existing[0].id));
  } else {
    await db.insert(llmConfig).values({ provider, defaultModel, summarizerEnabled });
  }

  revalidatePath("/admin/llm");
}

/** Save per-task model config for all tasks at once. */
export async function saveTaskConfigs(formData: FormData) {
  await requireAdmin();

  const tasks: LLMTask[] = [
    "guardrail_summarization",
    "threat_amplification",
    "rule_summarization",
    "content_ingest",
  ];

  for (const task of tasks) {
    const model = formData.get(`model_${task}`) as string;
    const enabled = formData.get(`enabled_${task}`) === "on";
    if (!model) continue;

    await db
      .insert(llmTaskConfig)
      .values({ task, model, enabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: llmTaskConfig.task,
        set: { model, enabled, updatedAt: new Date() },
      });
  }

  revalidatePath("/admin/llm");
}
