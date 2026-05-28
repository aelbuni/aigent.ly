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
        // Discover all stacks that have at least one rule
        const stackRows = await db
          .selectDistinct({ stackSlug: stack.slug, stackId: stack.id, stackName: stack.name })
          .from(rule)
          .innerJoin(ruleStack, eq(ruleStack.ruleId, rule.id))
          .innerJoin(stack, eq(stack.id, ruleStack.stackId));

        const CONTENT_TYPES: Array<"patterns" | "deps"> = ["patterns", "deps"];

        // Dry-count pass — determine which (stack, contentType) pairs need generation
        const now = new Date();
        let alreadyFilledCount = 0;

        // Group by stack, keeping only those that need work
        type PairMeta = { contentType: "patterns" | "deps"; stackName: string; stackId: number };
        const stackGroups = new Map<string, PairMeta[]>();

        for (const sr of stackRows) {
          for (const contentType of CONTENT_TYPES) {
            const shouldGenerate = await (async () => {
              if (mode === "all") return true;
              const [existing] = await db
                .select({ id: summarizedGuardrail.id, expiresAt: summarizedGuardrail.expiresAt })
                .from(summarizedGuardrail)
                .where(
                  and(
                    eq(summarizedGuardrail.stackId, sr.stackId),
                    eq(summarizedGuardrail.contentType, contentType)
                  )
                )
                .limit(1);
              if (mode === "empty") return !existing;
              return !existing || (existing.expiresAt !== null && existing.expiresAt < now);
            })();

            if (!shouldGenerate) { alreadyFilledCount++; continue; }

            const group = stackGroups.get(sr.stackSlug) ?? [];
            group.push({ contentType, stackName: sr.stackName, stackId: sr.stackId });
            stackGroups.set(sr.stackSlug, group);
          }
        }

        // Build a fake pairs array for the total count below
        const pairs = stackRows.flatMap((sr) => CONTENT_TYPES.map((ct) => ({ stackSlug: sr.stackSlug, contentType: ct })));

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

        // One batch per stack — runs patterns + deps rule types
        for (const [stackSlug, typeMetas] of stackGroups) {
          const stackName = typeMetas[0].stackName;
          // Map contentType → representative layer slug for the summarizer
          const layerSlugForType = (ct: "patterns" | "deps") =>
            ct === "deps" ? "dependency_supply" : "auth_session";
          const layerSlugs = typeMetas.map((m) => layerSlugForType(m.contentType));

          const onLayerComplete = (result: LayerSummaryResult) => {
            processedCount++;
            const elapsed = Date.now() - startTime;
            controller.enqueue(enc({
              type: "progress",
              index: processedCount,
              total: toProcess,
              stackSlug,
              contentType: result.layerSlug === "dependency_supply" ? "deps" : "patterns",
              stackName,
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
            // Emit error progress events for each type in this stack
            for (const meta of typeMetas) {
              processedCount++;
              controller.enqueue(enc({
                type: "progress",
                index: processedCount,
                total: toProcess,
                stackSlug,
                contentType: meta.contentType,
                stackName,
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
