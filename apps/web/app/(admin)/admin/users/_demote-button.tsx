"use client";
import { useTransition } from "react";

export function DemoteButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Are you sure you want to demote this admin? This will remove their admin access.",
      )
    )
      return;
    startTransition(async () => {
      await action();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="border-stroke text-dark hover:border-primary dark:border-dark-3 rounded-sm border px-2.5 py-1 text-xs font-medium disabled:opacity-50"
    >
      {isPending ? "Demoting…" : "Demote"}
    </button>
  );
}
