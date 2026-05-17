import type { components } from "@aigently/api-client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getRuleDetailFromDb } from "@/lib/catalog-from-db";
import { RuleBodyPanel, type RuleBodyViewMode } from "@/components/rules/RuleBodyPanel";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { threatReferenceUrl } from "@/lib/threat-links";
import { getServerApiClient, tryInternal } from "@/lib/server-api";

type RuleDetail = components["schemas"]["RuleDetail"];
type RuleLinkedThreat = components["schemas"]["RuleLinkedThreat"];

export default async function RuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const viewRaw = typeof sp.view === "string" ? sp.view : Array.isArray(sp.view) ? sp.view[0] : undefined;
  const initialView: RuleBodyViewMode = viewRaw === "preview" ? "preview" : "raw";

  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const client = await getServerApiClient();
  let rule: RuleDetail | null = null;

  if (client) {
    const res = await tryInternal(
      () =>
        client.GET("/v1/rules/{ruleSlug}", {
          params: { path: { ruleSlug: decoded } },
        }),
      null
    );
    if (res?.response && res.response.status === 404) notFound();
    if (res?.data) rule = res.data;
  }

  if (!rule) {
    try {
      rule = await getRuleDetailFromDb(decoded);
    } catch {
      rule = null;
    }
  }

  if (!rule) notFound();

  const linked = (rule.linkedThreats ?? []) as RuleLinkedThreat[];

  return (
    <div className="relative mx-auto max-w-3xl px-gutter py-10">
      <div className="pointer-events-none fixed inset-0 dot-grid opacity-30" />
      <nav className="relative mb-6 font-mono-label text-on-surface-variant">
        <Link href="/rules" className="text-primary hover:underline">
          Rules
        </Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface">{rule.slug}</span>
      </nav>
      <header className="relative mb-8 border-b border-outline-variant pb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono-data text-primary">{rule.slug}</span>
          {rule.certified ? (
            <span className="rounded bg-primary-fixed px-2 py-0.5 font-mono-label text-on-primary-fixed">
              Certified
            </span>
          ) : null}
          <span className="font-mono-data text-on-surface-variant">v{rule.version}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">{rule.name}</h1>
        <p className="mt-3 text-on-surface-variant">{rule.description}</p>
        {rule.layers?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {rule.layers.map((layer) => (
              <span
                key={layer}
                className="rounded-sm border border-outline-variant bg-surface-container-low px-2 py-0.5 font-mono-label text-on-surface-variant"
              >
                {layer.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {linked.length > 0 ? (
        <section className="relative mb-10">
          <h2 className="font-mono-label mb-3 text-primary">Protects against</h2>
          <div className="flex flex-wrap gap-2">
            {linked.map((t) => {
              const href = threatReferenceUrl({
                sourceUrl: t.sourceUrl,
                cveId: t.cveId,
                publicId: t.publicId,
                externalId: t.cveId ?? t.publicId,
              });
              const label = (t.cveId ?? t.publicId).trim();
              if (!href) {
                return (
                  <span
                    key={t.publicId}
                    className="rounded border border-outline-variant bg-surface-container-low px-2 py-1 font-mono-data text-on-surface-variant"
                  >
                    {label}
                  </span>
                );
              }
              return (
                <a
                  key={t.publicId}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary-fixed-dim/15 px-2 py-1 font-mono-data text-primary hover:bg-primary-fixed-dim/25"
                >
                  {label}
                  <MaterialSymbol name="open_in_new" className="!text-sm" aria-hidden />
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="relative">
        <h2 className="font-mono-label mb-3 text-primary">Rule body</h2>
        <Suspense
          fallback={
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-outline-variant bg-surface-container-lowest p-6 font-mono-data text-sm text-on-surface">
              {rule.bodyMdx ?? "_No body stored for this rule._"}
            </pre>
          }
        >
          <RuleBodyPanel body={rule.bodyMdx ?? ""} initialView={initialView} />
        </Suspense>
      </section>
    </div>
  );
}
