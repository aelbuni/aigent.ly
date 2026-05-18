"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scoreAndRegenerate } from "@/features/admin-guardrails/actions/guardrail-actions";

export function RegenButton({
  guardrailId,
  defaultScore,
}: {
  guardrailId: string;
  defaultScore?: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const scoreVal = fd.get("overrideScore");
    const parsed = scoreVal ? Number(scoreVal) : undefined;
    const score = parsed !== undefined && !isNaN(parsed) ? parsed : undefined;

    startTransition(() => {
      toast.promise(
        scoreAndRegenerate(guardrailId, score).then(() => router.refresh()),
        {
          loading: "Regenerating guardrail…",
          success: "Guardrail regenerated",
          error: (err) => `Regen failed: ${err instanceof Error ? err.message : "unknown error"}`,
        }
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center justify-end gap-2">
      <input
        type="number"
        name="overrideScore"
        min="0"
        max="10"
        placeholder="0–10"
        defaultValue={defaultScore ?? ""}
        className="w-16 h-8 rounded border border-stroke bg-gray-2 px-2 text-xs text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="h-8 rounded bg-primary px-3 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Running pipeline…" : "Regen"}
      </button>
    </form>
  );
}
