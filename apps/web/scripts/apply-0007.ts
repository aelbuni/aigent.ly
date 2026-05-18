import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  const client = await pool.connect();
  try {
    console.log("Applying migration 0007: llm_config tables...");

    // Create enum
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."llm_task" AS ENUM(
          'guardrail_summarization', 'threat_amplification',
          'rule_summarization', 'content_ingest'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Create llm_config
    await client.query(`
      CREATE TABLE IF NOT EXISTS "llm_config" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "provider" text NOT NULL DEFAULT 'anthropic'
          CHECK ("provider" IN ('anthropic', 'bedrock')),
        "default_model" text NOT NULL DEFAULT 'claude-sonnet-4-6',
        "summarizer_enabled" boolean NOT NULL DEFAULT false,
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    // Create llm_task_config
    await client.query(`
      CREATE TABLE IF NOT EXISTS "llm_task_config" (
        "task" "llm_task" PRIMARY KEY,
        "model" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    // Seed defaults
    await client.query(`
      INSERT INTO "llm_config" ("provider", "default_model", "summarizer_enabled")
      VALUES ('anthropic', 'claude-sonnet-4-6', false)
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO "llm_task_config" ("task", "model", "enabled") VALUES
        ('guardrail_summarization', 'claude-sonnet-4-6', true),
        ('threat_amplification',    'claude-sonnet-4-6', true),
        ('rule_summarization',      'claude-sonnet-4-6', true),
        ('content_ingest',          'claude-sonnet-4-6', true)
      ON CONFLICT DO NOTHING
    `);

    console.log("✓ Migration 0007 applied");

    // Verify
    const cfg = await client.query('SELECT * FROM "llm_config"');
    const tasks = await client.query('SELECT * FROM "llm_task_config"');
    console.log("llm_config rows:", cfg.rows);
    console.log("llm_task_config rows:", tasks.rows.length);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error("Error:", e.message); process.exit(1); });
