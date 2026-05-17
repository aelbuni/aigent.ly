import type { Metadata } from "next";

import { MaterialSymbol } from "@/components/MaterialSymbol";
import { listArticlesFromDb, type ArticleCard } from "@/lib/catalog-from-db";

export const metadata: Metadata = {
  title: "Security News | Aigent.ly",
  description:
    "Latest security threats, breach reports, and vulnerability disclosures — curated for developers building secure AI-assisted applications.",
};

function formatDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

function extractSourceUrl(bodyMdx: string | null): string | null {
  if (!bodyMdx) return null;
  const match = bodyMdx.match(/\[.*?\]\((https?:\/\/[^)]+)\)/);
  return match?.[1] ?? null;
}

function NewsCard({ item }: { item: ArticleCard }) {
  const sourceUrl = extractSourceUrl(item.contentPath);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:border-outline hover:bg-surface-container-low">
      {/* Tags row */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono-label text-xs text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h2 className="text-base font-semibold leading-snug text-on-surface">{item.title}</h2>

      {/* Excerpt */}
      {item.excerpt && (
        <p className="text-sm leading-relaxed text-on-surface-variant">{item.excerpt}</p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        {item.publishedAt && (
          <span className="font-mono-data text-xs text-on-surface-variant">
            {formatDate(item.publishedAt)}
          </span>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono-label text-xs text-primary transition-opacity hover:opacity-75"
          >
            Read source
            <MaterialSymbol name="open_in_new" className="!text-xs" />
          </a>
        )}
      </div>
    </article>
  );
}

export default async function NewsPage() {
  let articles: ArticleCard[] = [];
  try {
    articles = await listArticlesFromDb(100);
  } catch {
    articles = [];
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Security News</h1>
        <p className="mt-2 text-on-surface-variant">
          Threat intelligence and breach reports curated from the security community.
        </p>
      </header>

      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant p-12 text-center">
          <MaterialSymbol name="newspaper" className="!text-4xl text-outline-variant" />
          <p className="mt-3 text-sm text-on-surface-variant">No news articles yet.</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Run{" "}
            <code className="rounded bg-surface-container px-1 py-0.5 font-mono-data text-xs">
              URL=https://... pnpm --filter web ingest:url
            </code>{" "}
            to add the first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
