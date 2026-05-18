-- Migration 0008: Add quality scoring columns to summarized_guardrail
-- quality_score: 0-10 auto-computed on every insert/regenerate
-- score_override: 0-10 nullable, set by admin from evaluation UI
-- score_note: nullable text, admin note explaining override or evaluation finding

--> statement-breakpoint
ALTER TABLE "summarized_guardrail"
  ADD COLUMN "quality_score"  smallint NOT NULL DEFAULT 0,
  ADD COLUMN "score_override" smallint,
  ADD COLUMN "score_note"     text;
