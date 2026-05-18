import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "";

const pool = new pg.Pool({
  connectionString: connectionString || undefined,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });
export { pool };
export * from "./schema";
