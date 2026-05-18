import "dotenv/config";
import { db, summarizedGuardrail, stack, layer } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

async function main() {
  try {
    const rows = await db
      .select({
        id: summarizedGuardrail.id,
        stackId: summarizedGuardrail.stackId,
        stackSlug: stack.slug,
        stackName: stack.name,
        layerId: summarizedGuardrail.layerId,
        layerSlug: layer.slug,
        layerName: layer.name,
      })
      .from(summarizedGuardrail)
      .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
      .innerJoin(layer, eq(summarizedGuardrail.layerId, layer.id))
      .orderBy(desc(summarizedGuardrail.generatedAt))
      .limit(3);
    console.log("OK, rows:", rows.length, JSON.stringify(rows[0] ?? "empty"));
  } catch (e: unknown) {
    const err = e as { message: string; cause?: { message?: string; detail?: string; code?: string } };
    console.error("error:", err.message);
    console.error("cause:", err.cause?.message, err.cause?.detail, err.cause?.code);
  }
  process.exit(0);
}
main();
