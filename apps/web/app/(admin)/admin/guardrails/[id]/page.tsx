import { AdminPageHeader } from "@/components/nextadmin/admin-page-header";
import { AdminStatusPill } from "@/components/nextadmin/admin-data-table";
import { scoreAndRegenerate } from "@/features/admin-guardrails/actions/guardrail-actions";
import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, layer, stack, summarizedGuardrail } from "@/lib/db";
import { runSummarizerForLayer } from "@/lib/summarizer/pipeline";
import { cn } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "./_copy-button";

function StarScore({ score, override }: { score: number; override?: number | null }) {
  const effective = override ?? score;
  const stars = effective > 0 ? Math.max(1, Math.round(effective / 2)) : 0;
  const colorClass =
    effective >= 7 ? "text-[#219653]"
    : effective > 0 ? "text-[#FFA70B]"
    : "text-[#D34053]";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xl leading-none", colorClass)} aria-label={`${stars} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < stars ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

async function requireAdmin() {
  "use server";
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

async function regenerateAction(id: string, stackSlug: string, layerSlug: string) {
  "use server";
  await requireAdmin();
  await db.delete(summarizedGuardrail).where(eq(summarizedGuardrail.id, id));
  await runSummarizerForLayer(stackSlug, layerSlug);
  revalidatePath("/admin/guardrails");
  revalidatePath(`/admin/guardrails/${id}`);
  redirect("/admin/guardrails");
}

async function deleteAction(id: string) {
  "use server";
  await requireAdmin();
  await db.delete(summarizedGuardrail).where(eq(summarizedGuardrail.id, id));
  revalidatePath("/admin/guardrails");
  redirect("/admin/guardrails");
}

export default async function GuardrailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await db
    .select({
      id: summarizedGuardrail.id,
      content: summarizedGuardrail.content,
      sourceRuleIds: summarizedGuardrail.sourceRuleIds,
      summarizerVersion: summarizedGuardrail.summarizerVersion,
      conflictCount: summarizedGuardrail.conflictCount,
      generatedAt: summarizedGuardrail.generatedAt,
      expiresAt: summarizedGuardrail.expiresAt,
      cacheKey: summarizedGuardrail.cacheKey,
      qualityScore: summarizedGuardrail.qualityScore,
      scoreOverride: summarizedGuardrail.scoreOverride,
      scoreNote: summarizedGuardrail.scoreNote,
      stackSlug: stack.slug,
      stackName: stack.name,
      layerSlug: layer.slug,
      layerName: layer.name,
    })
    .from(summarizedGuardrail)
    .innerJoin(stack, eq(summarizedGuardrail.stackId, stack.id))
    .innerJoin(layer, eq(summarizedGuardrail.layerId, layer.id))
    .where(eq(summarizedGuardrail.id, id))
    .limit(1);

  if (!row) notFound();

  const now = new Date();
  const isExpired = row.expiresAt && new Date(row.expiresAt) <= now;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/guardrails"
          className="text-dark-6 hover:text-primary flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to guardrails
        </Link>
      </div>

      <AdminPageHeader
        title={row.stackName}
        description={`${row.layerName} · Generated ${row.generatedAt.toLocaleString()} · v${row.summarizerVersion}`}
        action={
          <div className="flex gap-2">
            <form action={regenerateAction.bind(null, row.id, row.stackSlug, row.layerSlug)}>
              <button
                type="submit"
                className="border-stroke text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white inline-flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-sm font-medium"
              >
                <RefreshCw className="size-4" />
                Regenerate
              </button>
            </form>
            <form action={deleteAction.bind(null, row.id)}>
              <button
                type="submit"
                className="border-red text-red hover:bg-red/5 inline-flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-medium"
              >
                Delete
              </button>
            </form>
          </div>
        }
      />

      {/* Score + metadata */}
      <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Stars + numeric */}
          <div className="flex items-center gap-3">
            <StarScore score={row.qualityScore ?? 0} override={row.scoreOverride} />
            <span className="text-dark-6 text-sm tabular-nums">
              {(row.scoreOverride ?? row.qualityScore ?? 0)}/10
              {row.scoreOverride != null && <span className="ml-1 text-xs opacity-60">(override)</span>}
            </span>
          </div>
          {/* Status + meta pills */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <AdminStatusPill status={isExpired ? "expired" : "active"} />
            {row.conflictCount > 0 && (
              <span className="text-dark-6">{row.conflictCount} conflict{row.conflictCount !== 1 ? "s" : ""} resolved</span>
            )}
            <span className="text-dark-6">{row.sourceRuleIds.length} source rule{row.sourceRuleIds.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Score note */}
        {row.scoreNote && (
          <p className="text-xs italic text-dark-6 border-l-2 border-stroke pl-3 dark:border-dark-3">
            {row.scoreNote}
          </p>
        )}

        {/* Re-score & guided regeneration */}
        <form
          action={async (fd: FormData) => {
            "use server";
            const scoreVal = fd.get("overrideScore");
            const noteVal = fd.get("scoreNote");
            const parsed = scoreVal ? Number(scoreVal) : undefined;
            await scoreAndRegenerate(
              row.id,
              parsed !== undefined && !isNaN(parsed) ? parsed : undefined,
              noteVal ? String(noteVal) : undefined
            );
            redirect(`/admin/guardrails/${row.id}`);
          }}
          className="flex flex-wrap items-end gap-3 border-t border-stroke pt-4 dark:border-dark-3"
        >
          <div className="space-y-1">
            <label className="text-dark-6 text-xs font-medium">Override score (0–10)</label>
            <input
              type="number"
              name="overrideScore"
              min="0"
              max="10"
              defaultValue={row.scoreOverride ?? ""}
              placeholder="0–10"
              className="h-9 w-20 rounded border border-stroke bg-gray-2 px-2 text-sm text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            />
          </div>
          <div className="flex-1 space-y-1 min-w-[180px]">
            <label className="text-dark-6 text-xs font-medium">Note (optional)</label>
            <input
              type="text"
              name="scoreNote"
              defaultValue={row.scoreNote ?? ""}
              placeholder="e.g. Too generic, missing CWE refs"
              className="h-9 w-full rounded border border-stroke bg-gray-2 px-2 text-sm text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="bg-primary hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded px-4 text-sm font-medium text-white"
          >
            <RefreshCw className="size-3.5" />
            Re-score &amp; Regenerate
          </button>
        </form>
      </div>

      {/* Content panel */}
      <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex items-center justify-between border-b border-stroke px-5 py-3 dark:border-dark-3">
          <span className="text-dark text-sm font-medium dark:text-white">Guardrail content</span>
          <CopyButton content={row.content} />
        </div>
        <div className="p-5">
          <pre className="text-dark dark:text-white whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
            {row.content}
          </pre>
        </div>
      </div>

      {/* Source rules */}
      {row.sourceRuleIds.length > 0 && (
        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="text-dark mb-3 text-sm font-semibold dark:text-white">
            Source rule IDs ({row.sourceRuleIds.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {row.sourceRuleIds.map((ruleId) => (
              <code
                key={ruleId}
                className="bg-gray-2 dark:bg-dark-2 text-dark-6 rounded px-2 py-0.5 font-mono text-xs"
              >
                {ruleId}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
