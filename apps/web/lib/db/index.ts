import "../load-web-env";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "";

const pool = new pg.Pool({
  connectionString: connectionString || undefined,
  // Pool creation is deferred — error surfaces at query time, not import time
});

export const db = drizzle(pool, { schema });
export { pool };
export * from "./schema";
