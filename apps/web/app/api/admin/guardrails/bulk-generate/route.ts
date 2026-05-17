import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, layer, rule, ruleLayerMap, ruleStack, stack, summarizedGuardrail } from "@/lib/db";
import { runSummarizerForStack, type LayerSummaryResult } from "@/lib/summarizer/pipeline";
import { and, eq } from "drizzle-orm";

async function requireAdmin(): Promise<boolean> {
  if (ADMIN_BYPASS) return true;
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "empty") as "empty" | "stale" | "all";
  if (!["empty", "stale", "all"].includes(mode)) {
    return new Response("Invalid mode", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = (obj: object) => `data: ${JSON.stringify(obj)}\n\n`;

      try {
        // Discover all (stack, layer) pairs that have at least one rule covering both
        const pairs = await db
          .selectDistinct({
            stackSlug: stack.slug,
            layerSlug: layer.slug,
            stackId: stack.id,
            layerId: layer.id,
            stackName: stack.name,
            layerName: layer.name,
          })
          .from(rule)
          .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
          .innerJoin(stack, eq(stack.id, ruleStack.stackId))
          .innerJoin(ruleLayerMap, eq(ruleLayerMap.ruleId, rule.id))
          .innerJoin(layer, eq(layer.id, ruleLayerMap.layerId))
          .where(eq(layer.isActive, true));

        // Dry-count pass — determine which pairs need generation
        const now = new Date();
        let alreadyFilledCount = 0;

        // Group pairs by stack, keeping only those that need work
        type PairMeta = { layerSlug: string; layerName: string; stackName: string; stackId: number; layerId: string };
        const stackGroups = new Map<string, PairMeta[]>();

        for (const pair of pairs) {
          const shouldGenerate = await (async () => {
            if (mode === "all") return true;
            const [existing] = await db
              .select({ id: summarizedGuardrail.id, expiresAt: summarizedGuardrail.expiresAt })
              .from(summarizedGuardrail)
              .where(
                and(
                  eq(summarizedGuardrail.stackId, pair.stackId),
                  eq(summarizedGuardrail.layerId, pair.layerId)
                )
              )
              .limit(1);
            if (mode === "empty") return !existing;
            return !existing || (existing.expiresAt !== null && existing.expiresAt < now);
          })();

          if (!shouldGenerate) {
            alreadyFilledCount++;
            continue;
          }

          const group = stackGroups.get(pair.stackSlug) ?? [];
          group.push({
            layerSlug: pair.layerSlug,
            layerName: pair.layerName,
            stackName: pair.stackName,
            stackId: pair.stackId,
            layerId: pair.layerId,
          });
          stackGroups.set(pair.stackSlug, group);
        }

        const toProcess = [...stackGroups.values()].reduce((sum, g) => sum + g.length, 0);

        controller.enqueue(enc({
          type: "start",
          total: pairs.length,
          toProcess,
          noRules: 0,
          alreadyFilled: alreadyFilledCount,
          stackCount: stackGroups.size,
          mode,
        }));

        if (toProcess === 0) {
          controller.enqueue(enc({
            type: "done",
            generated: 0,
            skipped: 0,
            noRules: 0,
            errors: [],
            elapsed: 0,
          }));
          controller.close();
          return;
        }

        const startTime = Date.now();
        let generated = 0;
        let processedCount = 0;
        const errors: string[] = [];

        // One LLM call per stack (batches all its layers)
        for (const [stackSlug, layerMetas] of stackGroups) {
          const layerSlugs = layerMetas.map((m) => m.layerSlug);
          const stackName = layerMetas[0].stackName;

          // Build a lookup for display names
          const layerNameBySlug = new Map(layerMetas.map((m) => [m.layerSlug, m.layerName]));

          const onLayerComplete = (result: LayerSummaryResult) => {
            processedCount++;
            const elapsed = Date.now() - startTime;
            controller.enqueue(enc({
              type: "progress",
              index: processedCount,
              total: toProcess,
              stackSlug,
              layerSlug: result.layerSlug,
              stackName,
              layerName: layerNameBySlug.get(result.layerSlug) ?? result.layerName,
              status: result.ruleCount > 0 ? "ok" : "skip",
              ruleCount: result.ruleCount,
              cacheHit: result.cacheHit,
              elapsed,
            }));
            if (result.ruleCount > 0 && !result.cacheHit) generated++;
          };

          try {
            await runSummarizerForStack(stackSlug, layerSlugs, "all", onLayerComplete, mode === "all");
          } catch (e) {
            const msg = `${stackSlug}: ${e instanceof Error ? e.message : String(e)}`;
            errors.push(msg);
            // Emit error progress events for each layer in this stack
            for (const meta of layerMetas) {
              processedCount++;
              controller.enqueue(enc({
                type: "progress",
                index: processedCount,
                total: toProcess,
                stackSlug,
                layerSlug: meta.layerSlug,
                stackName,
                layerName: meta.layerName,
                status: "error",
                ruleCount: 0,
                cacheHit: false,
                elapsed: Date.now() - startTime,
                error: msg,
              }));
            }
          }

          // Rate-limit between stack batches
          if (stackGroups.size > 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        controller.enqueue(enc({
          type: "done",
          generated,
          skipped: toProcess - generated - errors.length,
          noRules: 0,
          errors,
          elapsed: Date.now() - startTime,
        }));
      } catch (e) {
        controller.enqueue(enc({ type: "error", message: e instanceof Error ? e.message : String(e) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
