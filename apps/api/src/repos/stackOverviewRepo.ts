import { asc, eq, sql } from "drizzle-orm";

import {
  ruleStack,
  stack,
  stackCoverageArea,
  stackFrameworkFeature,
  threat,
  threatStack,
} from "@aigently/db/schema";

import { db } from "../lib/db.js";

export async function getStackOverview(slug: string) {
  const rows = await db
    .select({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      logoPath: stack.logoPath,
      sortOrder: stack.sortOrder,
      securityGrade: stack.securityGrade,
      gradeRationale: stack.gradeRationale,
      ecosystem: stack.ecosystem,
      nvdKeywords: stack.nvdKeywords,
      osvEcosystem: stack.osvEcosystem,
    })
    .from(stack)
    .where(eq(stack.slug, slug))
    .limit(1);

  const s = rows[0];
  if (!s) return null;

  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ruleStack)
    .where(eq(ruleStack.stackId, s.id));

  const coverage = await db
    .select({
      areaName: stackCoverageArea.areaName,
      coveragePercent: stackCoverageArea.coveragePercent,
      notes: stackCoverageArea.notes,
    })
    .from(stackCoverageArea)
    .where(eq(stackCoverageArea.stackId, s.id))
    .orderBy(asc(stackCoverageArea.areaName));

  const framework = await db
    .select({
      featureName: stackFrameworkFeature.featureName,
      status: stackFrameworkFeature.status,
      notes: stackFrameworkFeature.notes,
    })
    .from(stackFrameworkFeature)
    .where(eq(stackFrameworkFeature.stackId, s.id))
    .orderBy(asc(stackFrameworkFeature.featureName));

  const matrix = await db
    .select({
      publicId: threat.publicId,
      name: threat.name,
      severity: threatStack.severity,
      isMitigatedByRules: threatStack.isMitigatedByRules,
      family: threat.family,
    })
    .from(threatStack)
    .innerJoin(threat, eq(threat.publicId, threatStack.threatId))
    .where(eq(threatStack.stackId, s.id))
    .orderBy(asc(threat.publicId));

  return {
    stack: { ...s, ruleCount: countRow?.c ?? 0 },
    coverageAreas: coverage,
    frameworkFeatures: framework,
    threatMatrix: matrix,
  };
}
