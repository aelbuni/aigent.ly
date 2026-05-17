"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { clearZombieRuns } from "@/features/admin-sync/actions/sync-actions";

export function ClearZombieRunsButton({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition();

  function handleClear() {
    startTransition(async () => {
      await clearZombieRuns();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClear} disabled={isPending}>
      {isPending
        ? "Clearing…"
        : `Clear ${count} zombie run${count !== 1 ? "s" : ""}`}
    </Button>
  );
}
