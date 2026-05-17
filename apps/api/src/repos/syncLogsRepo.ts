import { desc } from "drizzle-orm";

import { syncLog } from "@aigently/db/schema";

import { db } from "../lib/db.js";

export async function listSyncLogs(limit = 25) {
  const cap = Math.min(100, Math.max(1, limit));
  return db
    .select({
      id: syncLog.id,
      startedAt: syncLog.startedAt,
      finishedAt: syncLog.finishedAt,
      coveragePercent: syncLog.coveragePercent,
      status: syncLog.status,
      errorMessage: syncLog.errorMessage,
      phaseSummary: syncLog.phaseSummary,
    })
    .from(syncLog)
    .orderBy(desc(syncLog.id))
    .limit(cap);
}
