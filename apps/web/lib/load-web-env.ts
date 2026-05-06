import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

/** Load `apps/web/.env` for scripts and any code that imports `@/lib/db` outside Next.js. */
const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(webRoot, ".env") });
