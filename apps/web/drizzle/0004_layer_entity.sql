--> statement-breakpoint
CREATE TABLE "layer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_id" text UNIQUE NOT NULL,
  "slug" text UNIQUE NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "concern_statement" text NOT NULL,
  "icon_name" text,
  "color_token" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "layer" ("public_id", "slug", "name", "description", "concern_statement", "icon_name", "color_token", "is_system", "is_active", "sort_order") VALUES
  ('layer_auth_session',     'auth_session',      'Authentication & Session',        'Prevents auth bypass, session fixation, and credential exposure',                        'preventing authentication bypass, session fixation, insecure token storage, and credential exposure',        'lock',              '--layer-auth',       true,  true,  10),
  ('layer_authz_access',     'authz_access',      'Authorization & Access Control',  'Enforces ownership checks, RLS, and privilege boundaries',                               'enforcing authorization checks, row-level security, ownership validation, and privilege separation',           'shield_person',     '--layer-authz',      true,  true,  20),
  ('layer_input_validation', 'input_validation',  'Input Validation & Sanitization', 'Prevents injection, path traversal, and malformed input exploitation',                   'preventing injection attacks, path traversal, prototype pollution, and malformed input exploitation',          'filter_alt',        '--layer-input',      true,  true,  30),
  ('layer_secrets',          'secrets_credentials','Secrets & Credentials',           'Prevents API key leakage, hardcoded credentials, and client bundle exposure',            'preventing credential leakage, hardcoded secrets, and sensitive value exposure in client bundles or logs',     'key',               '--layer-secrets',    true,  true,  40),
  ('layer_deps',             'dependency_supply', 'Dependency & Supply Chain',        'Enforces package pinning, audit hygiene, and transitive dep safety',                     'maintaining dependency hygiene, pinning package versions, and preventing compromised transitive dependencies', 'package_2',         '--layer-deps',       true,  true,  50),
  ('layer_privacy',          'data_privacy',      'Data Privacy & Compliance',        'Governs PII handling, encryption at rest, and GDPR-pattern compliance',                  'protecting personal data, enforcing encryption at rest, and preventing PII leakage in logs or responses',     'privacy_tip',       '--layer-privacy',    true,  true,  60),
  ('layer_api_security',     'api_security',      'API Security & Rate Limiting',     'Prevents abuse via throttling, CORS, versioning, and endpoint authentication',           'preventing API abuse, enforcing rate limits, securing CORS policy, and authenticating all endpoints',           'api',               '--layer-api',        false, false, 70),
  ('layer_database',         'database',          'Database Hardening',               'Enforces RLS, connection pooling, backup hygiene, and column-level encryption',          'enforcing row-level security, connection pooling, backup strategies, and preventing plaintext sensitive columns','database',         '--layer-db',         false, false, 80),
  ('layer_infrastructure',   'infrastructure',    'Infrastructure & Deployment',      'Governs CI/CD secret hygiene, IAM least-privilege, and environment isolation',           'preventing secret exposure in CI/CD, enforcing least-privilege IAM, and maintaining environment isolation',     'cloud',             '--layer-infra',      false, false, 90),
  ('layer_caching_cdn',      'caching_cdn',       'Caching & CDN',                    'Prevents cache poisoning, stale auth data, and CDN security header bypass',              'preventing cache poisoning, ensuring stale auth data is not served, and enforcing CDN security header policy',  'cached',            '--layer-cache',      false, false, 100),
  ('layer_frontend_network', 'frontend_network',  'Frontend & Network Security',      'Enforces CSP, HTTPS-only cookies, SRI, and clickjacking defenses',                       'enforcing Content Security Policy, HTTPS-only cookies, subresource integrity, and anti-clickjacking headers',   'language',          '--layer-frontend',   false, false, 110),
  ('layer_observability',    'observability',     'Observability & Incident Response','Enforces log hygiene, alerting, audit trails, and error boundary patterns',              'ensuring clean log hygiene, anomaly alerting, audit trail coverage, and proper error boundary instrumentation', 'monitoring',        '--layer-obs',        false, false, 120),
  ('layer_resilience',       'resilience',        'Resilience & Recovery',            'Governs backup strategy, failover, AZ distribution, and runbook coverage',               'enforcing backup strategies, failover configuration, multi-AZ distribution, and runbook documentation',          'health_and_safety', '--layer-resilience', false, false, 130),
  ('layer_ai_safety',        'ai_safety',         'AI & LLM Safety',                  'Defends against prompt injection, raw LLM output rendering, and context leakage',        'preventing prompt injection, validating LLM outputs before rendering, and preventing context window leakage',  'smart_toy',         '--layer-ai',         false, false, 140),
  ('layer_code_quality',     'code_quality',      'Code Quality & Patterns',          'Enforces error handling, null safety, and patterns that prevent vulnerability entry points','maintaining error handling hygiene, null safety, and structural patterns that prevent vulnerability entry',    'code',              '--layer-quality',    false, false, 150);
--> statement-breakpoint
ALTER TABLE "rule"
  ADD COLUMN "rule_type" text DEFAULT 'pattern' NOT NULL,
  ADD COLUMN "strength_score" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "rule" ADD CONSTRAINT "rule_rule_type_check"
  CHECK ("rule_type" IN ('pattern','deps','config','runtime'));
--> statement-breakpoint
ALTER TABLE "rule" ADD CONSTRAINT "rule_strength_score_check"
  CHECK ("strength_score" BETWEEN 0 AND 100);
--> statement-breakpoint
ALTER TABLE "rule_layer_map" ADD COLUMN "layer_id" uuid REFERENCES "layer"("id") ON DELETE CASCADE;
--> statement-breakpoint
UPDATE "rule_layer_map" SET "layer_id" = (SELECT "id" FROM "layer" WHERE "slug" = 'auth_session')    WHERE "layer" = 'security';
--> statement-breakpoint
UPDATE "rule_layer_map" SET "layer_id" = (SELECT "id" FROM "layer" WHERE "slug" = 'code_quality')   WHERE "layer" = 'architecture';
--> statement-breakpoint
UPDATE "rule_layer_map" SET "layer_id" = (SELECT "id" FROM "layer" WHERE "slug" = 'code_quality')   WHERE "layer" = 'code_quality';
--> statement-breakpoint
UPDATE "rule_layer_map" SET "layer_id" = (SELECT "id" FROM "layer" WHERE "slug" = 'auth_session')   WHERE "layer_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "rule_layer_map" ALTER COLUMN "layer_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "rule_layer_map" DROP CONSTRAINT IF EXISTS "rule_layer_map_pkey";
--> statement-breakpoint
ALTER TABLE "rule_layer_map" DROP CONSTRAINT IF EXISTS "rule_layer_map_rule_id_layer_pk";
--> statement-breakpoint
ALTER TABLE "rule_layer_map" ADD CONSTRAINT "rule_layer_map_pkey" PRIMARY KEY ("rule_id", "layer_id");
--> statement-breakpoint
ALTER TABLE "policy_template" ADD COLUMN "layer_id" uuid REFERENCES "layer"("id");
--> statement-breakpoint
UPDATE "policy_template" SET "layer_id" = (SELECT "id" FROM "layer" WHERE "slug" = 'auth_session')  WHERE "layer" = 'security';
--> statement-breakpoint
UPDATE "policy_template" SET "layer_id" = (SELECT "id" FROM "layer" WHERE "slug" = 'code_quality')  WHERE "layer" IN ('architecture','code_quality');
--> statement-breakpoint
UPDATE "policy_template" SET "layer_id" = (SELECT "id" FROM "layer" WHERE "slug" = 'auth_session')  WHERE "layer_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "policy_template" ALTER COLUMN "layer_id" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "threat_layer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "threat_id" text NOT NULL REFERENCES "threat"("public_id") ON DELETE CASCADE,
  "layer_id" uuid NOT NULL REFERENCES "layer"("id") ON DELETE CASCADE,
  "relevance" text DEFAULT 'primary' CHECK ("relevance" IN ('primary','secondary')),
  "rationale" text,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("threat_id", "layer_id")
);
--> statement-breakpoint
CREATE INDEX "idx_threat_layer_threat" ON "threat_layer" ("threat_id");
--> statement-breakpoint
CREATE INDEX "idx_threat_layer_layer" ON "threat_layer" ("layer_id");
--> statement-breakpoint
CREATE TABLE "summarized_guardrail" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stack_id" smallint NOT NULL REFERENCES "stack"("id"),
  "layer_id" uuid NOT NULL REFERENCES "layer"("id"),
  "ide_slug" text NOT NULL,
  "content" text NOT NULL,
  "source_rule_ids" uuid[] NOT NULL,
  "provenance" jsonb,
  "conflict_count" integer DEFAULT 0 NOT NULL,
  "cache_key" text UNIQUE NOT NULL,
  "summarizer_version" text NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_summary_stack_layer_ide" ON "summarized_guardrail" ("stack_id", "layer_id", "ide_slug");
--> statement-breakpoint
CREATE TABLE "stack_layer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stack_id" smallint NOT NULL REFERENCES "stack"("id") ON DELETE CASCADE,
  "layer_id" uuid NOT NULL REFERENCES "layer"("id") ON DELETE CASCADE,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  UNIQUE ("stack_id", "layer_id")
);
--> statement-breakpoint
INSERT INTO "stack_layer" ("stack_id", "layer_id", "is_active")
  SELECT s."id", l."id", true
  FROM "stack" s CROSS JOIN "layer" l
  WHERE l."is_system" = true AND s."catalog_status" = 'launch'
  ON CONFLICT DO NOTHING;
