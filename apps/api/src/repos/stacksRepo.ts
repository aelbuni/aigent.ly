import { asc, eq, sql } from "drizzle-orm";

import { ruleStack, stack } from "@aigently/db/schema";

import { db } from "../lib/db.js";

function withLogoCdn(logoPath: string | null): string | null {
  const base = process.env.STACK_LOGO_CDN_BASE?.trim().replace(/\/$/, "");
  if (!base || !logoPath) return logoPath;
  if (/^https?:\/\//i.test(logoPath)) return logoPath;
  return `${base}/${logoPath.replace(/^\//, "")}`;
}

export async function listStacks() {
  const rows = await db
    .select({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      logoPath: stack.logoPath,
      sortOrder: stack.sortOrder,
      catalogStatus: stack.catalogStatus,
    })
    .from(stack)
    .orderBy(asc(stack.sortOrder), asc(stack.id));

  return rows.map((r) => ({ ...r, logoPath: withLogoCdn(r.logoPath) }));
}

export async function getStackBySlug(slug: string) {
  const rows = await db
    .select({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      logoPath: stack.logoPath,
      sortOrder: stack.sortOrder,
      catalogStatus: stack.catalogStatus,
    })
    .from(stack)
    .where(eq(stack.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const s = rows[0]!;
  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ruleStack)
    .where(eq(ruleStack.stackId, s.id));

  return {
    ...s,
    logoPath: withLogoCdn(s.logoPath),
    ruleCount: countRow?.c ?? 0,
  };
}
