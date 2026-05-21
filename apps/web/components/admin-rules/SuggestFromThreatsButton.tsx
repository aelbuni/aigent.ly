"use client";

import { Button } from "@/components/ui/button";

interface SuggestFromThreatsButtonProps {
  suggestedLayerIds: string[];
  onApply: (ids: string[]) => void;
}

export function SuggestFromThreatsButton({ suggestedLayerIds, onApply }: SuggestFromThreatsButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-primary hover:text-primary/80 text-xs font-medium h-auto p-0"
      onClick={() => onApply(suggestedLayerIds)}
    >
      Suggest from threats ({suggestedLayerIds.length})
    </Button>
  );
}
