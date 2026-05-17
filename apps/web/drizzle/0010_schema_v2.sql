-- Schema v2 migration
-- Pre-production reset: drop dead columns, add new ones, add indexes

-- ── DROP dead columns ──────────────────────────────────────────────────────────

ALTER TABLE "threat" DROP COLUMN IF EXISTS "details";
ALTER TABLE "rule" DROP COLUMN IF EXISTS "complexity";
ALTER TABLE "layer" DROP COLUMN IF EXISTS "public_id";
ALTER TABLE "article" DROP COLUMN IF EXISTS "body_mdx";

-- ── DROP dead tables ───────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "rule_severity_tag";
DROP TABLE IF EXISTS "stack_coverage_area";
DROP TABLE IF EXISTS "stack_framework_feature";

-- ── DROP dead enum (only safe if no columns reference it) ─────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_layer') THEN
    DROP TYPE "rule_layer";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_feature_status') THEN
    DROP TYPE "framework_feature_status";
  END IF;
END $$;

-- ── CHANGE: threat.ai_amplification text → jsonb ─────────────────────────────
-- Existing rows: attempt to cast stored text as jsonb; null out invalid JSON
UPDATE "threat"
SET "ai_amplification" = NULL
WHERE "ai_amplification" IS NOT NULL
  AND "ai_amplification"::text !~ '^[\{\[]';

ALTER TABLE "threat"
  ALTER COLUMN "ai_amplification" TYPE jsonb
  USING CASE
    WHEN "ai_amplification" IS NULL THEN NULL
    ELSE "ai_amplification"::jsonb
  END;

-- ── CHANGE: stack_submission onboarding_progress → typed bool columns ─────────

ALTER TABLE "stack_submission"
  ADD COLUMN IF NOT EXISTS "step_stack_created"   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "step_logo_uploaded"   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "step_rules_assigned"  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "step_threats_synced"  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "step_coverage_filled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "step_published"       boolean NOT NULL DEFAULT false;

-- Migrate existing onboarding_progress JSONB into typed columns
UPDATE "stack_submission"
SET
  "step_stack_created"   = COALESCE(("onboarding_progress"->>'stack_record_created')::boolean, false),
  "step_logo_uploaded"   = COALESCE(("onboarding_progress"->>'logo_uploaded')::boolean, false),
  "step_rules_assigned"  = COALESCE(("onboarding_progress"->>'rules_assigned')::boolean, false),
  "step_threats_synced"  = COALESCE(("onboarding_progress"->>'threats_synced')::boolean, false),
  "step_coverage_filled" = COALESCE(("onboarding_progress"->>'coverage_areas_filled')::boolean, false),
  "step_published"       = COALESCE(("onboarding_progress"->>'published')::boolean, false)
WHERE "onboarding_progress" IS NOT NULL
  AND "onboarding_progress" != '{}'::jsonb;

ALTER TABLE "stack_submission" DROP COLUMN IF EXISTS "onboarding_progress";

-- ── ADD: missing indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "threat_severity_idx"           ON "threat" ("severity");
CREATE INDEX IF NOT EXISTS "threat_source_idx"             ON "threat" ("source");
CREATE INDEX IF NOT EXISTS "threat_actively_exploited_idx" ON "threat" ("is_actively_exploited");
CREATE INDEX IF NOT EXISTS "threat_published_at_idx"       ON "threat" ("published_at");
CREATE INDEX IF NOT EXISTS "rule_rule_type_idx"            ON "rule" ("rule_type");
CREATE INDEX IF NOT EXISTS "rule_strength_score_idx"       ON "rule" ("strength_score");
CREATE INDEX IF NOT EXISTS "stack_catalog_status_idx"      ON "stack" ("catalog_status");
CREATE INDEX IF NOT EXISTS "summarized_guardrail_quality_score_idx" ON "summarized_guardrail" ("quality_score");
CREATE INDEX IF NOT EXISTS "summarized_guardrail_expires_at_idx"    ON "summarized_guardrail" ("expires_at");
CREATE INDEX IF NOT EXISTS "rule_threat_map_threat_id_idx"          ON "rule_threat_map" ("threat_id");
CREATE INDEX IF NOT EXISTS "threat_stack_stack_id_idx"              ON "threat_stack" ("stack_id");
CREATE INDEX IF NOT EXISTS "threat_layer_threat_id_idx"             ON "threat_layer" ("threat_id");
CREATE INDEX IF NOT EXISTS "threat_layer_layer_id_idx"              ON "threat_layer" ("layer_id");
