/**
 * ============================================================
 * SCHEMA CHANGELOG v2 — packages/db/src/schema.ts
 * ============================================================
 *
 * DROPPED (dead code / overengineering):
 *  1. ruleLayerEnum           — replaced by `layer` table; never referenced
 *                               outside this file after the layer migration.
 *  2. threat.details          — never read or written in any query.
 *  3. rule.complexity         — never set by any pipeline; always null.
 *  4. ruleSeverityTag         — never inserted/queried; semantically wrong
 *                               (severity belongs to threats, not rules).
 *  5. stackCoverageArea       — pre-production overengineering; callers
 *                               (stackOverviewRepo, catalog-from-db) return [].
 *  6. stackFrameworkFeature   — same as above.
 *  7. frameworkFeatureStatusEnum — only used by stackFrameworkFeature.
 *  8. layer.publicId          — redundant with slug; slug is the stable
 *                               external identifier used by all consumers.
 *  9. article.bodyMdx         — dual storage (inline + contentPath file);
 *                               use contentPath as single source of truth.
 *
 * CHANGED:
 * 10. threat.aiAmplification  — text → jsonb. Callers that JSON.stringify()
 *                               on write or JSON.parse() on read must pass/
 *                               receive the raw object directly.
 * 11. stackSubmission         — onboardingProgress jsonb REPLACED with six
 *                               typed boolean columns: stepStackCreated,
 *                               stepLogoUploaded, stepRulesAssigned,
 *                               stepThreatsSynced, stepCoverageFilled,
 *                               stepPublished.
 * 12. syncLog.sourceSummary   → renamed to phaseSummary at the Drizzle level
 *                               (DB column name "source_summary" unchanged —
 *                               no migration needed for the column itself).
 *
 * ADDED:
 * 13. Indexes on threat(severity), threat(source), threat(is_actively_exploited),
 *     threat(published_at), rule(rule_type), rule(strength_score),
 *     stack(catalog_status), summarized_guardrail(quality_score),
 *     summarized_guardrail(expires_at), rule_threat_map(threat_id),
 *     threat_stack(stack_id).
 * ============================================================
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH  (Auth.js — unchanged; table names match @auth/drizzle-adapter)
// ─────────────────────────────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: text("role").notNull().default("user"),
});

export const account = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
);

export const session = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationToken = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);

export const authenticator = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.credentialID] }),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const threatFamilyEnum = pgEnum("threat_family", [
  "owasp_web",
  "owasp_llm",
  "mitre_atlas",
  "vibe_coding",
]);

export const severityLevelEnum = pgEnum("severity_level", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const threatSourceEnum = pgEnum("threat_source", [
  "nvd",
  "osv",
  "ghsa",
  "cisa_kev",
  "aigently",
  "mitre_atlas",
  "aigently_internal",
]);

export const stackCatalogStatusEnum = pgEnum("stack_catalog_status", [
  "launch",
  "coming_soon",
]);

export const llmTaskEnum = pgEnum("llm_task", [
  "guardrail_summarization",
  "threat_amplification",
  "rule_summarization",
  "content_ingest",
]);

export const stackSubmissionStatusEnum = pgEnum("stack_submission_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "onboarding",
  "live",
]);

// ─────────────────────────────────────────────────────────────────────────────
// CORE CATALOG ENTITIES
// ─────────────────────────────────────────────────────────────────────────────

export const stack = pgTable(
  "stack",
  {
    id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    logoPath: text("logo_path"),
    sortOrder: smallint("sort_order").notNull().default(0),
    catalogStatus: stackCatalogStatusEnum("catalog_status").notNull().default("launch"),
    securityGrade: text("security_grade"),
    gradeRationale: text("grade_rationale"),
    ecosystem: text("ecosystem"),
    nvdKeywords: text("nvd_keywords")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    osvEcosystem: text("osv_ecosystem"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    catalogStatusIdx: index("stack_catalog_status_idx").on(t.catalogStatus),
  })
);

export const ide = pgTable("ide", {
  id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * First-class security layer entity.
 * publicId DROPPED — slug is the stable external identifier used by all
 * consumers (API, snapshot importer, MCP catalog).
 */
export const layer = pgTable("layer", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  concernStatement: text("concern_statement").notNull(),
  iconName: text("icon_name"),
  colorToken: text("color_token"),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threat = pgTable(
  "threat",
  {
    publicId: text("public_id").primaryKey(),
    family: threatFamilyEnum("family").notNull(),
    name: text("name").notNull(),
    severity: severityLevelEnum("severity"),
    description: text("description"),
    /**
     * Changed from text → jsonb.
     * Callers must pass a raw object (not JSON.stringify'd string).
     * Drizzle handles serialisation automatically.
     */
    aiAmplification: jsonb("ai_amplification"),
    cveId: text("cve_id"),
    externalId: text("external_id").unique(),
    source: threatSourceEnum("source").notNull().default("aigently"),
    sourceUrl: text("source_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    mitreAttackIds: text("mitre_attack_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    owaspRefs: text("owasp_refs")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    affectedProducts: jsonb("affected_products").notNull().default({}),
    patchedVersion: text("patched_version"),
    isActivelyExploited: boolean("is_actively_exploited").notNull().default(false),
    cisaActionDue: text("cisa_action_due"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    severityIdx:          index("threat_severity_idx").on(t.severity),
    sourceIdx:            index("threat_source_idx").on(t.source),
    activelyExploitedIdx: index("threat_actively_exploited_idx").on(t.isActivelyExploited),
    publishedAtIdx:       index("threat_published_at_idx").on(t.publishedAt),
  })
);

export const rule = pgTable(
  "rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    version: text("version").notNull(),
    dateAdded: date("date_added").notNull(),
    lastUpdated: date("last_updated").notNull(),
    author: text("author").notNull(),
    certified: boolean("certified").notNull().default(false),
    lineCount: integer("line_count"),
    contentPath: text("content_path"),
    bodyMdx: text("body_mdx"),
    summaryMdx: text("summary_mdx"),
    ruleType: text("rule_type", { enum: ["pattern", "deps", "config", "runtime"] })
      .notNull()
      .default("pattern"),
    strengthScore: integer("strength_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ruleTypeIdx:      index("rule_rule_type_idx").on(t.ruleType),
    strengthScoreIdx: index("rule_strength_score_idx").on(t.strengthScore),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// JUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const ruleStack = pgTable(
  "rule_stack",
  {
    ruleId: uuid("rule_id").notNull().references(() => rule.id, { onDelete: "cascade" }),
    stackId: smallint("stack_id").notNull().references(() => stack.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.ruleId, t.stackId] }) })
);

export const ruleIde = pgTable(
  "rule_ide",
  {
    ruleId: uuid("rule_id").notNull().references(() => rule.id, { onDelete: "cascade" }),
    ideId: smallint("ide_id").notNull().references(() => ide.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.ruleId, t.ideId] }) })
);

export const ruleLayerMap = pgTable(
  "rule_layer_map",
  {
    ruleId: uuid("rule_id").notNull().references(() => rule.id, { onDelete: "cascade" }),
    layerId: uuid("layer_id").notNull().references(() => layer.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.ruleId, t.layerId] }) })
);

export const ruleThreatMap = pgTable(
  "rule_threat_map",
  {
    ruleId: uuid("rule_id").notNull().references(() => rule.id, { onDelete: "cascade" }),
    threatId: text("threat_id").notNull().references(() => threat.publicId, { onDelete: "restrict" }),
  },
  (t) => ({
    pk:          primaryKey({ columns: [t.ruleId, t.threatId] }),
    threatIdIdx: index("rule_threat_map_threat_id_idx").on(t.threatId),
  })
);

export const threatStack = pgTable(
  "threat_stack",
  {
    threatId: text("threat_id").notNull().references(() => threat.publicId, { onDelete: "cascade" }),
    stackId: smallint("stack_id").notNull().references(() => stack.id, { onDelete: "cascade" }),
    severity: severityLevelEnum("severity").notNull(),
    isMitigatedByRules: boolean("is_mitigated_by_rules").notNull().default(false),
  },
  (t) => ({
    pk:         primaryKey({ columns: [t.threatId, t.stackId] }),
    stackIdIdx: index("threat_stack_stack_id_idx").on(t.stackId),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// THREAT-LAYER ROUTING
// ─────────────────────────────────────────────────────────────────────────────

export const threatLayer = pgTable(
  "threat_layer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threatId: text("threat_id").notNull().references(() => threat.publicId, { onDelete: "cascade" }),
    layerId: uuid("layer_id").notNull().references(() => layer.id, { onDelete: "cascade" }),
    relevance: text("relevance", { enum: ["primary", "secondary"] }).default("primary"),
    rationale: text("rationale"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq:        unique().on(t.threatId, t.layerId),
    threatIdIdx: index("threat_layer_threat_id_idx").on(t.threatId),
    layerIdIdx:  index("threat_layer_layer_id_idx").on(t.layerId),
  })
);

export const sourceLayerMapping = pgTable(
  "source_layer_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: threatSourceEnum("source").notNull(),
    layerId: uuid("layer_id").notNull().references(() => layer.id, { onDelete: "cascade" }),
    relevance: text("relevance", { enum: ["primary", "secondary"] }).notNull().default("primary"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.source, t.layerId) })
);

export const owaspLayerMapping = pgTable("owasp_layer_mapping", {
  id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
  owaspRef: text("owasp_ref").notNull().unique(),
  layerId: uuid("layer_id").notNull().references(() => layer.id, { onDelete: "cascade" }),
  relevance: text("relevance", { enum: ["primary", "secondary"] }).notNull().default("primary"),
  isActive: boolean("is_active").notNull().default(true),
});

// ─────────────────────────────────────────────────────────────────────────────
// GUARDRAILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cached output of the multi-rule summarizer for a (stack, layer, ide) triple.
 * ideSlug is a soft FK to ide.slug — no hard constraint so guardrails can be
 * pre-generated before IDE rows exist.
 * sourceRuleIds stays as uuid[] — junction table overhead not justified for a
 * cache table.
 */
export const summarizedGuardrail = pgTable(
  "summarized_guardrail",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stackId: smallint("stack_id").notNull().references(() => stack.id),
    layerId: uuid("layer_id").notNull().references(() => layer.id),
    ideSlug: text("ide_slug").notNull(),
    content: text("content").notNull(),
    sourceRuleIds: uuid("source_rule_ids").array().notNull(),
    provenance: jsonb("provenance"),
    conflictCount: integer("conflict_count").notNull().default(0),
    cacheKey: text("cache_key").notNull().unique(),
    summarizerVersion: text("summarizer_version").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    qualityScore: smallint("quality_score").notNull().default(0),
    scoreOverride: smallint("score_override"),
    scoreNote: text("score_note"),
  },
  (t) => ({
    stackLayerIdeIdx:  index("summarized_guardrail_stack_layer_ide_idx").on(t.stackId, t.layerId, t.ideSlug),
    qualityScoreIdx:   index("summarized_guardrail_quality_score_idx").on(t.qualityScore),
    expiresAtIdx:      index("summarized_guardrail_expires_at_idx").on(t.expiresAt),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per sync pipeline run.
 * phaseSummary: renamed from sourceSummary at the Drizzle level only.
 * DB column name stays "source_summary" — no migration needed.
 */
export const syncLog = pgTable("sync_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  phaseSummary: jsonb("source_summary").notNull().default({}),
  coveragePercent: smallint("coverage_percent"),
  status: text("status").notNull().default("running"),
  errorMessage: text("error_message"),
});

// ─────────────────────────────────────────────────────────────────────────────
// LLM CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const llmConfig = pgTable("llm_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  provider: text("provider", { enum: ["anthropic", "bedrock"] }).notNull().default("anthropic"),
  defaultModel: text("default_model").notNull().default("claude-sonnet-4-6"),
  summarizerEnabled: boolean("summarizer_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmTaskConfig = pgTable("llm_task_config", {
  task: llmTaskEnum("task").primaryKey(),
  model: text("model").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT
// ─────────────────────────────────────────────────────────────────────────────

/** Candidate for removal in a future cleanup sprint. */
export const policyTemplate = pgTable("policy_template", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  layerId: uuid("layer_id").notNull().references(() => layer.id),
  bodyMarkdown: text("body_markdown"),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policyTemplateStack = pgTable(
  "policy_template_stack",
  {
    templateId: integer("template_id").notNull().references(() => policyTemplate.id, { onDelete: "cascade" }),
    stackId: smallint("stack_id").notNull().references(() => stack.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.templateId, t.stackId] }) })
);

/**
 * Articles / news feed.
 * bodyMdx DROPPED — use contentPath as single source of truth.
 */
export const article = pgTable("article", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  readingMinutes: smallint("reading_minutes"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  contentPath: text("content_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articleRuleMap = pgTable(
  "article_rule_map",
  {
    articleId: uuid("article_id").notNull().references(() => article.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").notNull().references(() => rule.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.articleId, t.ruleId] }) })
);

export const contentRevision = pgTable(
  "content_revision",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    gitSha: text("git_sha").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityShaUniq: uniqueIndex("content_revision_entity_sha").on(t.entityType, t.entityId, t.gitSha),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL / USAGE
// ─────────────────────────────────────────────────────────────────────────────

export const ruleReview = pgTable("rule_review", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull().references(() => rule.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  rating: smallint("rating").notNull(),
  reviewText: text("review_text").notNull(),
  ideUsed: text("ide_used").notNull(),
  stackTested: text("stack_tested").notNull(),
  helpfulCount: integer("helpful_count").notNull().default(0),
  authorHandle: text("author_handle"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ruleReviewHelpful = pgTable(
  "rule_review_helpful",
  {
    reviewId: uuid("review_id").notNull().references(() => ruleReview.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.reviewId, t.userId] }) })
);

export const articleFeedback = pgTable(
  "article_feedback",
  {
    articleId: uuid("article_id").notNull().references(() => article.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    helpful: boolean("helpful").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.articleId, t.userId] }) })
);

export const ruleUsageDaily = pgTable(
  "rule_usage_daily",
  {
    ruleId: uuid("rule_id").notNull().references(() => rule.id, { onDelete: "cascade" }),
    bucketDate: date("bucket_date").notNull(),
    copyCount: integer("copy_count").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.ruleId, t.bucketDate] }) })
);

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stack submission queue.
 * onboardingProgress jsonb REPLACED with 6 typed boolean columns.
 * updateOnboardingStep() must SET the matching column by name directly.
 */
export const stackSubmission = pgTable("stack_submission", {
  id: uuid("id").primaryKey().defaultRandom(),
  submittedBy: text("submitted_by").references(() => user.id, { onDelete: "set null" }),
  proposedName: text("proposed_name").notNull(),
  proposedSlug: text("proposed_slug").notNull(),
  ecosystem: text("ecosystem"),
  description: text("description").notNull(),
  githubUrl: text("github_url"),
  additionalInfo: text("additional_info"),
  status: stackSubmissionStatusEnum("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  stepStackCreated:   boolean("step_stack_created").notNull().default(false),
  stepLogoUploaded:   boolean("step_logo_uploaded").notNull().default(false),
  stepRulesAssigned:  boolean("step_rules_assigned").notNull().default(false),
  stepThreatsSynced:  boolean("step_threats_synced").notNull().default(false),
  stepCoverageFilled: boolean("step_coverage_filled").notNull().default(false),
  stepPublished:      boolean("step_published").notNull().default(false),
  linkedStackId: smallint("linked_stack_id").references(() => stack.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
