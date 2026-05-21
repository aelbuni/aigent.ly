"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { assignRuleLayers } from "@/features/admin-rules/actions/rule-actions";
import { SuggestFromThreatsButton } from "./SuggestFromThreatsButton";

interface Layer {
  id: string;
  name: string;
}

interface LayersPanelProps {
  ruleId: string;
  layers: Layer[];
  initialCheckedIds: string[];
  suggestedLayerIds: string[];
}

export function LayersPanel({ ruleId, layers, initialCheckedIds, suggestedLayerIds }: LayersPanelProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(initialCheckedIds));
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const applySuggested = (ids: string[]) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      await assignRuleLayers(ruleId, Array.from(checkedIds));
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Assigned Layers</CardTitle>
          {suggestedLayerIds.length > 0 && (
            <SuggestFromThreatsButton
              suggestedLayerIds={suggestedLayerIds}
              onApply={applySuggested}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="space-y-2">
            {layers.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <Checkbox
                  id={`layer-${l.id}`}
                  name="layerIds"
                  value={l.id}
                  checked={checkedIds.has(l.id)}
                  onCheckedChange={(checked) => toggle(l.id, checked === true)}
                />
                <Label htmlFor={`layer-${l.id}`} className="cursor-pointer">
                  {l.name}
                </Label>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save Layers"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
