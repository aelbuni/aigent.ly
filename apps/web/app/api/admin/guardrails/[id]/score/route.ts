import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, summarizedGuardrail } from "@/lib/db";
import { eq } from "drizzle-orm";

async function requireAdmin(): Promise<boolean> {
  if (ADMIN_BYPASS) return true;
  const session = await auth();
  return session?.user?.role === "admin";
}

/** PATCH /api/admin/guardrails/:id/score — update score_override and score_note only, no LLM call. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { score?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const score = typeof body.score === "number" ? Math.round(Math.min(10, Math.max(0, body.score))) : undefined;
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;

  if (score === undefined) {
    return Response.json({ error: "score must be a number 0–10" }, { status: 400 });
  }

  const updated = await db
    .update(summarizedGuardrail)
    .set({ scoreOverride: score, scoreNote: note })
    .where(eq(summarizedGuardrail.id, id))
    .returning({ id: summarizedGuardrail.id, scoreOverride: summarizedGuardrail.scoreOverride });

  if (updated.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true, id, score });
}
