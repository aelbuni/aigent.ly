import "dotenv/config";

import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";

import { sendProblem } from "./lib/problem.js";
import { registerV1Routes } from "./routes/v1.js";

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST ?? "0.0.0.0";

const app = Fastify({
  logger: true,
  genReqId: () => randomUUID(),
});

app.addHook("onRequest", async (req, reply) => {
  const id = req.id;
  reply.header("x-request-id", id);
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : true,
});

await registerV1Routes(app);

app.get("/openapi.json", async (_req, reply) => {
  return reply.type("application/json").send(app.swagger());
});

app.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  if (reply.sent) return;
  const message = err instanceof Error ? err.message : String(err);
  return sendProblem(
    reply,
    500,
    "internal-error",
    "Internal server error",
    process.env.NODE_ENV === "development" ? message : undefined
  );
});

try {
  await app.listen({ port, host });
  app.log.info(`API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
