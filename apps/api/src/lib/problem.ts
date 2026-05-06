import type { FastifyReply } from "fastify";

const PROBLEM_BASE = "https://aigently.dev/problems";

export function sendProblem(
  reply: FastifyReply,
  status: number,
  type: string,
  title: string,
  detail?: string
) {
  return reply
    .header("content-type", "application/problem+json")
    .status(status)
    .send({
      type: `${PROBLEM_BASE}/${type}`,
      title,
      status,
      ...(detail ? { detail } : {}),
    });
}

export { PROBLEM_BASE };
