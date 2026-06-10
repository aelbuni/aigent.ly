import { asc, eq } from "drizzle-orm";

import { ide } from "@aigently/db/schema";

import { db } from "../lib/db.js";

export async function listIdes() {
  return db
    .select({
      id: ide.id,
      slug: ide.slug,
      name: ide.name,
      sortOrder: ide.sortOrder,
    })
    .from(ide)
    .orderBy(asc(ide.name));
}

export async function getIdeBySlug(slug: string) {
  const rows = await db.select().from(ide).where(eq(ide.slug, slug)).limit(1);
  return rows[0] ?? null;
}
