import type { Metadata } from "next";

import { listLayersWithStatsFromDb, listStacksFromDb } from "@/lib/catalog-from-db";
import { SummarizerDemo } from "./SummarizerDemo";

export const metadata: Metadata = {
  title: "Guardrail Composer Demo | Aigent.ly",
  description:
    "Pick your stack, protection layers, and IDE. Watch a canonical merged guardrail compose itself in real time.",
};

export default async function SummarizerDemoPage() {
  const [stacks, layers] = await Promise.all([
    listStacksFromDb().catch(() => []),
    listLayersWithStatsFromDb().catch(() => []),
  ]);

  const launchStacks = stacks.filter((s) => s.catalogStatus === "launch");

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">
          Guardrail Composer
        </h1>
        <p className="mt-2 text-on-surface-variant">
          Select your stack, choose protection layers, and generate a merged AI-ready guardrail.
        </p>
      </header>
      <SummarizerDemo stacks={launchStacks} layers={layers} />
    </main>
  );
}
