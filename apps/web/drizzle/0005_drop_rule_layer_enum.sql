-- Migration 0005: Drop the legacy rule_layer enum column and type
-- Run ONLY after verifying 0004 backfill is complete in production:
--   SELECT count(*) FROM rule_layer_map WHERE layer_id IS NULL;  → must be 0
--   SELECT count(*) FROM policy_template WHERE layer_id IS NULL; → must be 0

--> statement-breakpoint
ALTER TABLE "rule_layer_map" DROP COLUMN IF EXISTS "layer";
--> statement-breakpoint
ALTER TABLE "policy_template" DROP COLUMN IF EXISTS "layer";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."rule_layer";
