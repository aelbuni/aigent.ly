import { and, asc, eq } from "drizzle-orm";

import { policyTemplate, policyTemplateStack, stack } from "@aigently/db/schema";

import { db } from "../lib/db.js";

export async function listPolicyTemplatesForStack(stackSlug: string) {
  return db
    .select({
      id: policyTemplate.id,
      slug: policyTemplate.slug,
      name: policyTemplate.name,
      description: policyTemplate.description,
      layer: policyTemplate.layer,
      sortOrder: policyTemplate.sortOrder,
    })
    .from(policyTemplate)
    .innerJoin(policyTemplateStack, eq(policyTemplateStack.templateId, policyTemplate.id))
    .innerJoin(stack, eq(stack.id, policyTemplateStack.stackId))
    .where(eq(stack.slug, stackSlug))
    .orderBy(asc(policyTemplate.sortOrder), asc(policyTemplate.id));
}
