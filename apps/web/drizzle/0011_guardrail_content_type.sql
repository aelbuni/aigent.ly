-- Remove layer-based composition from summarized_guardrail.
-- Guardrails are now keyed by (stack_id, content_type) instead of
-- (stack_id, layer_id, ide_slug). Layers remain as read-only taxonomy tags.

DROP INDEX IF EXISTS "summarized_guardrail_stack_layer_ide_idx";--> statement-breakpoint
TRUNCATE TABLE "summarized_guardrail";--> statement-breakpoint
ALTER TABLE "summarized_guardrail" DROP COLUMN IF EXISTS "layer_id";--> statement-breakpoint
ALTER TABLE "summarized_guardrail" DROP COLUMN IF EXISTS "ide_slug";--> statement-breakpoint
ALTER TABLE "summarized_guardrail" ADD COLUMN "content_type" text NOT NULL DEFAULT 'patterns' CHECK ("content_type" IN ('patterns', 'deps'));--> statement-breakpoint
CREATE UNIQUE INDEX "summarized_guardrail_stack_content_key" ON "summarized_guardrail" ("stack_id", "content_type");
