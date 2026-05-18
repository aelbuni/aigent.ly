import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { db, ide, layer, rule, ruleIde, ruleLayerMap, ruleStack, stack } from "@/lib/db";

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function createCustomRule(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const bodyMdx = String(formData.get("bodyMdx") ?? "").trim();
  const stackSlug = String(formData.get("stackSlug") ?? "").trim();
  const classification = String(formData.get("classification") ?? "patterns").trim();

  if (!name || !description || !bodyMdx || !stackSlug) {
    return;
  }

  const baseSlug = normalizeSlug(slugRaw || name);
  const finalSlug =
    classification === "deps"
      ? `${baseSlug}-security-deps-v1`
      : classification === "patterns"
        ? `${baseSlug}-security-patterns-v1`
        : baseSlug;

  const existing = await db.select({ id: rule.id }).from(rule).where(eq(rule.slug, finalSlug)).limit(1);
  if (existing[0]) {
    return;
  }

  const [stackRow] = await db.select({ id: stack.id }).from(stack).where(eq(stack.slug, stackSlug)).limit(1);
  if (!stackRow) return;

  const today = new Date().toISOString().slice(0, 10);
  const [inserted] = await db
    .insert(rule)
    .values({
      slug: finalSlug,
      name,
      description,
      version: "1.0.0",
      dateAdded: today,
      lastUpdated: today,
      author: "custom",
      certified: false,
      lineCount: bodyMdx.split("\n").length,
      bodyMdx,
    })
    .returning({ id: rule.id, slug: rule.slug });

  const ruleId = inserted!.id;
  await db.insert(ruleStack).values({ ruleId, stackId: stackRow.id }).onConflictDoNothing();

  const ides = await db.select({ id: ide.id }).from(ide);
  if (ides.length) {
    await db
      .insert(ruleIde)
      .values(ides.map((i) => ({ ruleId, ideId: i.id })))
      .onConflictDoNothing();
  }

  const authLayer = await db.select({ id: layer.id }).from(layer).where(eq(layer.slug, "auth_session")).limit(1);
  if (authLayer[0]) {
    await db.insert(ruleLayerMap).values({ ruleId, layerId: authLayer[0].id }).onConflictDoNothing();
  }

  redirect(`/rules/${encodeURIComponent(inserted!.slug)}`);
}

export default async function NewRulePage() {
  const stacks = await db
    .select({ slug: stack.slug, name: stack.name, catalogStatus: stack.catalogStatus })
    .from(stack)
    .orderBy(stack.sortOrder);
  const launchStacks = stacks.filter((s) => s.catalogStatus === "launch");

  return (
    <div className="relative mx-auto max-w-3xl px-gutter py-10">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" aria-hidden />
      <nav className="relative mb-6 font-mono-label text-on-surface-variant">
        <Link href="/rules" className="text-primary hover:underline">
          Rules
        </Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface">New custom rule</span>
      </nav>

      <header className="relative mb-8 border-b border-outline-variant pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">New custom rule</h1>
        <p className="mt-3 text-on-surface-variant">
          Create a rule that shows up in the directory. Pattern rules are safe (no dependency edits). Deps rules are
          advisory only (WARN/CONFIRM/CHECK).
        </p>
      </header>

      <form action={createCustomRule} className="relative space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="mb-2 font-mono-label text-on-surface-variant">Name</div>
            <input
              name="name"
              required
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
              placeholder="e.g. Company auth token handling"
            />
          </label>
          <label className="block">
            <div className="mb-2 font-mono-label text-on-surface-variant">Slug (optional)</div>
            <input
              name="slug"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
              placeholder="auto-derived from name"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="mb-2 font-mono-label text-on-surface-variant">Classification</div>
            <select
              name="classification"
              defaultValue="patterns"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
            >
              <option value="patterns">Pattern rule (ALWAYS/NEVER; safe)</option>
              <option value="deps">Deps rule (WARN/CONFIRM/CHECK; advisory)</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-2 font-mono-label text-on-surface-variant">Stack</div>
            <select
              name="stackSlug"
              required
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
            >
              <option value="" disabled>
                Choose a stack…
              </option>
              {launchStacks.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <div className="mb-2 font-mono-label text-on-surface-variant">Description</div>
          <input
            name="description"
            required
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
            placeholder="One sentence: what this rule enforces and why."
          />
        </label>

        <label className="block">
          <div className="mb-2 font-mono-label text-on-surface-variant">Rule body (MDX/markdown)</div>
          <textarea
            name="bodyMdx"
            required
            rows={14}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-4 font-mono-data text-sm text-on-surface outline-none focus:border-primary"
            placeholder={
              "For patterns:\n- NEVER …\n- ALWAYS …\n\nFor deps:\n- WARN …\n- CHECK …\n- CONFIRM …"
            }
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/rules"
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 font-mono-label text-on-surface-variant hover:bg-surface-container"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-mono-label text-on-primary"
          >
            <MaterialSymbol name="add" className="!text-lg" />
            Create rule
          </button>
        </div>
      </form>
    </div>
  );
}

