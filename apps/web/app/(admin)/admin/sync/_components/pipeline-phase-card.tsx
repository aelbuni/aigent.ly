"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PipelinePhaseCardProps {
  phase: string;
  description: string;
  status: "idle" | "running" | "success" | "needs_action" | "failed";
  metric?: string;
  warningMessage?: string;
  lastRunLabel?: string;
  triggerAction?: () => Promise<{ ok: boolean; message: string }>;
  triggerLabel?: string;
}

const STATUS_ICON: Record<PipelinePhaseCardProps["status"], React.ReactNode> = {
  idle: <Clock className="size-4 text-dark-6" />,
  running: <RefreshCw className="size-4 text-[#FFA70B] animate-spin" />,
  success: <CheckCircle2 className="size-4 text-[#219653]" />,
  needs_action: <AlertTriangle className="size-4 text-[#FFA70B]" />,
  failed: <XCircle className="size-4 text-[#D34053]" />,
};

export function PipelinePhaseCard({
  phase,
  description,
  status,
  metric,
  warningMessage,
  lastRunLabel,
  triggerAction,
  triggerLabel = "Run",
}: PipelinePhaseCardProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleTrigger() {
    if (!triggerAction) return;
    if (!window.confirm(`Trigger "${phase}"? This will run the pipeline phase.`)) return;
    startTransition(async () => {
      const res = await triggerAction();
      setResult(res);
      setTimeout(() => setResult(null), 5000);
    });
  }

  const borderClass =
    status === "failed"
      ? "border-[#D34053]/40"
      : status === "needs_action"
        ? "border-[#FFA70B]/40"
        : "border-stroke dark:border-dark-3";

  return (
    <div
      className={`rounded-[10px] border bg-white p-4 shadow-1 dark:bg-gray-dark space-y-2 ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {STATUS_ICON[status]}
          <span className="text-sm font-medium text-dark dark:text-white">
            {phase}
          </span>
        </div>
        {triggerAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTrigger}
            disabled={isPending}
            className="h-7 px-2 text-xs"
          >
            {isPending && <RefreshCw className="mr-1 size-3 animate-spin" />}
            {triggerLabel}
          </Button>
        )}
      </div>
      <p className="text-xs text-dark-6">{description}</p>
      {metric && (
        <p className="rounded bg-gray-2 px-2 py-1 font-mono text-xs text-dark dark:bg-dark-2 dark:text-white">
          {metric}
        </p>
      )}
      {warningMessage && (
        <p className="text-xs text-[#FFA70B]">{warningMessage}</p>
      )}
      {lastRunLabel && (
        <p className="text-xs text-dark-6">{lastRunLabel}</p>
      )}
      {result && (
        <p className={`mt-2 text-xs font-medium ${result.ok ? "text-[#219653]" : "text-[#D34053]"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
