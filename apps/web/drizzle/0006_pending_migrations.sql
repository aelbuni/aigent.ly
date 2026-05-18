-- Migration 0006: Apply pending schema changes
-- 1. Drop legacy "layer" column from rule_layer_map (migration 0005_drop_rule_layer_enum was not applied)
-- 2. Add "aigently_internal" to threat_family enum
-- 3. Drop the old rule_layer enum type if it exists

--> statement-breakpoint
-- Drop the legacy "layer" text column (was the old enum-based FK before layer entity was introduced)
ALTER TABLE "rule_layer_map" DROP COLUMN IF EXISTS "layer";

--> statement-breakpoint
-- Drop the legacy "layer" column from policy_template if it exists
ALTER TABLE "policy_template" DROP COLUMN IF EXISTS "layer";

--> statement-breakpoint
-- Drop the old rule_layer enum type if it still exists
DROP TYPE IF EXISTS "public"."rule_layer";

--> statement-breakpoint
-- Add "aigently_internal" value to threat_family enum (schema expects it, DB is missing it)
ALTER TYPE "public"."threat_family" ADD VALUE IF NOT EXISTS 'aigently_internal';
