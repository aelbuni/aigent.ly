import "../lib/load-web-env";

import { pool } from "../lib/db";
import { bulkRunSummarizer } from "../lib/summarizer/pipeline";

const mode = (process.env.MODE ?? "empty") as "empty" | "stale" | "all";

if (!["empty", "stale", "all"].includes(mode)) {
  console.error(`Invalid MODE="${mode}". Use empty | stale | all`);
  process.exit(1);
}

console.log(`summarize:layers — mode=${mode}`);

const { generated, skipped, errors } = await bulkRunSummarizer(mode);

console.log(`Done: generated=${generated} skipped=${skipped} errors=${errors.length}`);
if (errors.length > 0) {
  for (const e of errors) console.error(" ✗", e);
  process.exitCode = 1;
}

await pool.end();
