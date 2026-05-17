"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { loadDefaultSourceMappings } from "@/features/admin-sources/actions/source-actions";

export function DefaultMappingsLoader() {
  const [isPending, startTransition] = useTransition();

  function handleLoad() {
    startTransition(async () => {
      await loadDefaultSourceMappings();
    });
  }

  return (
    <Button onClick={handleLoad} disabled={isPending} size="sm" variant="default">
      {isPending ? "Loading defaults…" : "Load recommended defaults"}
    </Button>
  );
}
