import {
  AdminDataTable,
  AdminEmptyState,
  AdminPrimaryCell,
  AdminRowActions,
  AdminStatusPill,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
  AdminTableHeaderRow,
  AdminTableRow,
} from "@/components/nextadmin/admin-data-table";
import { AdminPageHeader } from "@/components/nextadmin/admin-page-header";
import Link from "next/link";
import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { db, layer, stack, summarizedGuardrail } from "@/lib/db";
import { listGuardrails, getGuardrailCoverage } from "@/lib/admin-queries";
import { runSummarizerForLayer } from "@/lib/summarizer/pipeline";
import { BulkGeneratePanel } from "@/features/admin-guardrails/components/bulk-generate-panel";
import { RegenRowButton } from "./_regen-row-button";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cn } from "@/lib/utils";
import { Trash2, Zap } from "lucide-react";

function StarScore({ score, override }: { score: number; override?: number | null }) {
  const effective = override ?? score;
  const stars = effective > 0 ? Math.max(1, Math.round(effective / 2)) : 0;
  const colorClass =
    effective >= 5 ? "text-[#219653]"
    : effective > 0 ? "text-[#FFA70B]"
    : effective === 0 ? "text-[#D34053]"
    : "text-dark-5 opacity-40";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-sm", colorClass)}
      title={`${effective}/10${override != null ? " (override)" : ""}`}
      aria-label={`${stars} of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < stars ? "★" : "☆"}</span>
      ))}
      {override != null && <span className="ml-0.5 text-xs opacity-60">ᵒ</span>}
    </span>
  );
}

async function requireAdmin() {
  "use server";
  if (ADMIN_BYPASS) return;
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
}

async function generateGuardrailAction(stackSlug: string, layerSlug: string) {
  "use server";
  await requireAdmin();
  await runSummarizerForLayer(stackSlug, layerSlug);
  revalidatePath("/admin/guardrails");
}


export default async function GuardrailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; stack?: string; layer?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const stackFilter = params.stack?.trim() || undefined;
  const layerFilter = params.layer?.trim() || undefined;
  const [{ rows, total }, allStacks, allLayers, coverage] = await Promise.all([
    listGuardrails({ page, perPage: 25, stackSlug: stackFilter, layerSlug: layerFilter }),
    db.select({ id: stack.id, slug: stack.slug, name: stack.name }).from(stack).orderBy(stack.sortOrder),
    db.select({ id: layer.id, slug: layer.slug, name: layer.name }).from(layer).orderBy(layer.sortOrder),
    getGuardrailCoverage(),
  ]);
  const { totalPairs, coveredPairs, coveragePct } = coverage;
  // stackSlug and layerSlug are now returned directly by listGuardrails

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Cached Guardrails"
        description={`${total} cached AI summaries`}
      />

      {/* Coverage progress bar */}
      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-dark dark:text-white">Guardrail Coverage</span>
          <span className="text-sm text-dark-6">
            {coveredPairs} / {totalPairs} pairs ({coveragePct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-3 dark:bg-dark-2">
          <div
            className="h-full rounded-full bg-[#3C50E0] transition-all"
            style={{ width: `${Math.min(100, coveragePct)}%` }}
          />
        </div>
        {coveragePct < 10 && (
          <p className="mt-2 text-xs text-[#D34053]">
            ⚠ Coverage critically low — use Bulk Generate to fill missing pairs
          </p>
        )}
      </div>

      {/* Generate on-demand form */}
      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark sm:p-6">
        <h2 className="text-dark mb-4 text-base font-semibold dark:text-white">Generate guardrail</h2>
        <form
          action={async (fd: FormData) => {
            "use server";
            const stackSlug = fd.get("stackSlug") as string;
            const layerSlug = fd.get("layerSlug") as string;
            if (stackSlug && layerSlug) await generateGuardrailAction(stackSlug, layerSlug);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="space-y-1">
            <label className="text-dark-6 text-xs font-medium">Stack</label>
            <select
              name="stackSlug"
              required
              className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-10 min-w-[160px] rounded border px-3 text-sm outline-none"
            >
              <option value="">Select stack…</option>
              {allStacks.map((s) => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-dark-6 text-xs font-medium">Layer</label>
            <select
              name="layerSlug"
              required
              className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-10 min-w-[180px] rounded border px-3 text-sm outline-none"
            >
              <option value="">Select layer…</option>
              {allLayers.map((l) => (
                <option key={l.id} value={l.slug}>{l.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-primary hover:bg-primary/90 inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-medium text-white"
          >
            <Zap className="size-4" />
            Generate
          </button>
        </form>
      </div>

      <BulkGeneratePanel />

      {/* Filter bar */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-dark-6 text-xs font-medium">Filter by stack</label>
          <select
            name="stack"
            defaultValue={stackFilter ?? ""}
            className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-9 min-w-[160px] rounded border px-3 text-sm outline-none"
          >
            <option value="">All stacks</option>
            {allStacks.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-dark-6 text-xs font-medium">Filter by layer</label>
          <select
            name="layer"
            defaultValue={layerFilter ?? ""}
            className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-9 min-w-[180px] rounded border px-3 text-sm outline-none"
          >
            <option value="">All layers</option>
            {allLayers.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="border-stroke bg-white text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white h-9 rounded border px-4 text-sm font-medium"
        >
          Filter
        </button>
        {(stackFilter || layerFilter) && (
          <Link
            href="/admin/guardrails"
            className="text-dark-6 hover:text-primary h-9 flex items-center text-sm"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Guardrails table */}
      <AdminDataTable>
        <AdminTableHeader>
          <AdminTableHeaderRow>
            <AdminTableHead>Guardrail</AdminTableHead>
            <AdminTableHead>Score</AdminTableHead>
            <AdminTableHead>Generated</AdminTableHead>
            <AdminTableHead>Expires</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead align="right">Actions</AdminTableHead>
          </AdminTableHeaderRow>
        </AdminTableHeader>
        <AdminTableBody>
          {rows.length === 0 ? (
            <AdminEmptyState colSpan={6} message="No cached guardrails. Use the form above to generate one." />
          ) : (
            rows.map((g) => {
              const isExpired = g.expiresAt && new Date(g.expiresAt) <= new Date();
              return (
                <AdminTableRow key={g.id}>
                  <AdminPrimaryCell
                    title={g.stackName}
                    subtitle={`${g.layerName} · v${g.summarizerVersion}${g.conflictCount > 0 ? ` · ${g.conflictCount} conflicts` : ""}`}
                    href={`/admin/guardrails/${g.id}`}
                  />
                  <AdminTableCell>
                    <StarScore score={g.qualityScore ?? 0} override={g.scoreOverride} />
                  </AdminTableCell>
                  <AdminTableCell>
                    <p className="text-dark text-sm dark:text-white">
                      {new Date(g.generatedAt).toLocaleString()}
                    </p>
                  </AdminTableCell>
                  <AdminTableCell>
                    {g.expiresAt ? (
                      <span className={`text-sm ${
                        new Date(g.expiresAt) < new Date()
                          ? "font-medium text-[#D34053]"
                          : "text-dark-6"
                      }`}>
                        {new Date(g.expiresAt) < new Date()
                          ? "Expired"
                          : new Date(g.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-sm text-dark-6">—</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell>
                    <AdminStatusPill status={isExpired ? "expired" : "active"} />
                  </AdminTableCell>
                  <AdminRowActions
                    extra={<RegenRowButton guardrailId={g.id} />}
                    deleteAction={
                      <form action={async () => {
                        "use server";
                        await requireAdmin();
                        await db.delete(summarizedGuardrail).where(eq(summarizedGuardrail.id, g.id));
                        revalidatePath("/admin/guardrails");
                      }}>
                        <button type="submit" className="text-dark-6 hover:text-destructive">
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete</span>
                        </button>
                      </form>
                    }
                  />
                </AdminTableRow>
              );
            })
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
