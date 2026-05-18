import Anthropic from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

/**
 * Returns an Anthropic-compatible client.
 * Uses AWS Bedrock when AWS_REGION is set and credentials are resolvable
 * via the provider chain (env vars, SSO cache, instance profile, etc.).
 * Falls back to the direct Anthropic API otherwise.
 */
export async function createLLMClient(): Promise<Anthropic> {
  const { AWS_REGION } = process.env;

  if (
    AWS_REGION &&
    (process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_CONFIG_FILE)
  ) {
    const credentials = await fromNodeProviderChain()();
    return new AnthropicBedrock({
      awsRegion: AWS_REGION,
      awsAccessKey: credentials.accessKeyId,
      awsSecretKey: credentials.secretAccessKey,
      awsSessionToken: credentials.sessionToken,
    }) as unknown as Anthropic;
  }

  return new Anthropic();
}

export function detectProvider(): "bedrock" | "anthropic" {
  if (!process.env.AWS_REGION) return "anthropic";
  return process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_CONFIG_FILE
    ? "bedrock"
    : "anthropic";
}
