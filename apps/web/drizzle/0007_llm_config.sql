-- Migration 0007: LLM configuration tables
-- Stores admin-selectable provider, default model, and per-task model overrides.
-- Credentials (API keys, AWS keys) are never stored here — they stay in env vars.

--> statement-breakpoint
CREATE TYPE "public"."llm_task" AS ENUM(
  'guardrail_summarization',
  'threat_amplification',
  'rule_summarization',
  'content_ingest'
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_config" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "provider" text NOT NULL DEFAULT 'anthropic'
    CHECK ("provider" IN ('anthropic', 'bedrock')),
  "default_model" text NOT NULL DEFAULT 'claude-sonnet-4-6',
  "summarizer_enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_task_config" (
  "task" "llm_task" PRIMARY KEY,
  "model" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
-- Seed a default row so the config page always has something to display
INSERT INTO "llm_config" ("provider", "default_model", "summarizer_enabled")
VALUES ('anthropic', 'claude-sonnet-4-6', false)
ON CONFLICT DO NOTHING;

--> statement-breakpoint
-- Seed default per-task configs
INSERT INTO "llm_task_config" ("task", "model", "enabled") VALUES
  ('guardrail_summarization', 'claude-sonnet-4-6', true),
  ('threat_amplification',    'claude-sonnet-4-6', true),
  ('rule_summarization',      'claude-sonnet-4-6', true),
  ('content_ingest',          'claude-sonnet-4-6', true)
ON CONFLICT DO NOTHING;
