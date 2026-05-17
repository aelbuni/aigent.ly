import { asc, eq, sql } from "drizzle-orm";

import {
  ruleStack,
  stack,
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
    coverageAreas: [],
    frameworkFeatures: [],
    threatMatrix: matrix,
  };
}
