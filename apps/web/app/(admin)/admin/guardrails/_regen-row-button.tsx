"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scoreAndRegenerate } from "@/features/admin-guardrails/actions/guardrail-actions";
import { RefreshCw } from "lucide-react";

export function RegenRowButton({ guardrailId }: { guardrailId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(() => {
      toast.promise(
        scoreAndRegenerate(guardrailId).then(() => router.refresh()),
        {
          loading: "Regenerating…",
          success: "Guardrail regenerated",
          error: (err) => `Regen failed: ${err instanceof Error ? err.message : "unknown error"}`,
        }
      );
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-dark-6 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
      title="Regenerate"
    >
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
      <span className="sr-only">Regenerate</span>
    </button>
  );
}
