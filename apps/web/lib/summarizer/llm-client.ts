import Anthropic from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { eq } from "drizzle-orm";
import { db, llmConfig, llmTaskConfig } from "@/lib/db";
import type { LLMTask } from "@/lib/admin-queries";

const BEDROCK_MODEL_IDS: Record<string, string> = {
  "claude-sonnet-4-6": "us.anthropic.claude-sonnet-4-6",
  "claude-opus-4-7": "us.anthropic.claude-opus-4-7",
  "claude-haiku-4-5": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
};

// Per-task model defaults. Applied when no DB row exists for the task.
// threat_amplification: Haiku — high-volume loop, tiny structured output (400 tokens)
// content_ingest: Sonnet — article reading comprehension, moderate complexity
// rule_summarization: Sonnet — CVE clustering, solid reasoning without creative synthesis
// guardrail_summarization: Sonnet (dev), Opus when FEATURE_CERTIFIED_SUMMARIES=true (shipped to IDEs)
const TASK_DEFAULT_MODELS: Record<string, string> = {
  threat_amplification: "claude-haiku-4-5",
  content_ingest: "claude-sonnet-4-6",
  rule_summarization: "claude-sonnet-4-6",
  guardrail_summarization: "claude-sonnet-4-6",
};

function toBedrockModelId(model: string): string {
  return BEDROCK_MODEL_IDS[model] ?? `us.anthropic.${model}`;
}

function detectProviderFromEnv(): "bedrock" | "anthropic" {
  if (!process.env.AWS_REGION) return "anthropic";
  return process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_CONFIG_FILE
    ? "bedrock"
    : "anthropic";
}

/**
 * Returns an Anthropic-compatible client.
 * Provider is read from DB first (admin-configurable), then falls back to env var detection.
 * Credentials always come from env vars — never stored in DB.
 */
export async function createLLMClient(): Promise<Anthropic> {
  let provider: "bedrock" | "anthropic";

  try {
    const [cfg] = await db.select({ provider: llmConfig.provider }).from(llmConfig).limit(1);
    provider = (cfg?.provider as "bedrock" | "anthropic") ?? detectProviderFromEnv();
  } catch {
    provider = detectProviderFromEnv();
  }

  if (provider === "bedrock" && process.env.AWS_REGION) {
    const credentials = await fromNodeProviderChain()();
    return new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION,
      awsAccessKey: credentials.accessKeyId,
      awsSecretKey: credentials.secretAccessKey,
      awsSessionToken: credentials.sessionToken,
    }) as unknown as Anthropic;
  }

  return new Anthropic();
}

/**
 * Returns the model to use for a given task.
 * Priority: llm_task_config row → llm_config.defaultModel → env var fallback.
 */
export async function getModelForTask(task: LLMTask): Promise<string> {
  let model: string | undefined;
  let provider: "bedrock" | "anthropic" = "anthropic";

  try {
    const [taskRow, [globalRow]] = await Promise.all([
      db.select({ model: llmTaskConfig.model, enabled: llmTaskConfig.enabled })
        .from(llmTaskConfig)
        .where(eq(llmTaskConfig.task, task))
        .limit(1),
      db.select({ defaultModel: llmConfig.defaultModel, provider: llmConfig.provider }).from(llmConfig).limit(1),
    ]);

    if (taskRow[0]?.enabled && taskRow[0].model) model = taskRow[0].model;
    else if (globalRow?.defaultModel) model = globalRow.defaultModel;
    if (globalRow?.provider) provider = globalRow.provider as "bedrock" | "anthropic";
  } catch {
    // fall through to env var fallback
  }

  // Per-task default before the global env-var fallback
  model ??= TASK_DEFAULT_MODELS[task];

  // Global env-var fallback (respects certified flag for guardrail_summarization)
  if (!model) {
    model = process.env.FEATURE_CERTIFIED_SUMMARIES === "true"
      ? "claude-opus-4-7"
      : "claude-sonnet-4-6";
  }

  if (provider === "bedrock") return toBedrockModelId(model);
  return model;
}

export async function detectProvider(): Promise<"bedrock" | "anthropic"> {
  try {
    const [cfg] = await db.select({ provider: llmConfig.provider }).from(llmConfig).limit(1);
    return (cfg?.provider as "bedrock" | "anthropic") ?? detectProviderFromEnv();
  } catch {
    return detectProviderFromEnv();
  }
}
