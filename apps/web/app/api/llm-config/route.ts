import { createLLMClient, detectProvider, getModelForTask } from "@/lib/summarizer/llm-client";

export async function GET() {
  const [provider, model] = await Promise.all([
    detectProvider(),
    getModelForTask("guardrail_summarization"),
  ]);

  let connectivity: "ok" | "error" = "error";
  let latencyMs: number | null = null;
  let connectivityError: string | null = null;

  try {
    const client = await createLLMClient();
    const start = Date.now();
    await client.messages.create({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] });
    latencyMs = Date.now() - start;
    connectivity = "ok";
  } catch (e) {
    connectivityError = e instanceof Error ? e.message : String(e);
  }

  return Response.json({
    provider,
    model,
    bedrockRegion: process.env.AWS_REGION ?? null,
    ssoSession: provider === "bedrock" && !!process.env.AWS_SESSION_TOKEN,
    connectivity,
    latencyMs,
    connectivityError,
  });
}
