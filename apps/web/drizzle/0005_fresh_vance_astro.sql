-- Admin tables: user role, stack submissions, source/owasp layer routing

--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';

--> statement-breakpoint
CREATE TYPE "public"."stack_submission_status" AS ENUM('pending','under_review','approved','rejected','onboarding','live');

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stack_submission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submitted_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "proposed_name" text NOT NULL,
  "proposed_slug" text NOT NULL,
  "ecosystem" text,
  "description" text NOT NULL,
  "github_url" text,
  "additional_info" text,
  "status" "stack_submission_status" NOT NULL DEFAULT 'pending',
  "reviewed_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "onboarding_progress" jsonb NOT NULL DEFAULT '{}',
  "linked_stack_id" smallint REFERENCES "stack"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_layer_mapping" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" "threat_source" NOT NULL,
  "layer_id" uuid NOT NULL REFERENCES "layer"("id") ON DELETE CASCADE,
  "relevance" text NOT NULL DEFAULT 'primary' CHECK ("relevance" IN ('primary','secondary')),
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("source", "layer_id")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owasp_layer_mapping" (
  "id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "owasp_ref" text NOT NULL UNIQUE,
  "layer_id" uuid NOT NULL REFERENCES "layer"("id") ON DELETE CASCADE,
  "relevance" text NOT NULL DEFAULT 'primary' CHECK ("relevance" IN ('primary','secondary')),
  "is_active" boolean NOT NULL DEFAULT true
);