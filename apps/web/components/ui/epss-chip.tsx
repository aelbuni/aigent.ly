interface EpssChipProps {
  score: number | null | undefined;
  percentile: number | null | undefined;
  size?: "sm" | "md";
}

function getEpssColorClass(score: number): string {
  if (score >= 0.7) return "bg-error text-white";
  if (score >= 0.4) return "bg-tertiary-container text-white";
  if (score >= 0.1) return "bg-primary-fixed-dim text-primary";
  return "bg-surface-container text-on-surface-variant";
}

/**
 * Displays EPSS exploit-probability as a compact pill.
 * Returns null when score is absent — no placeholder, no layout shift.
 */
export function EpssChip({ score, percentile, size = "sm" }: EpssChipProps) {
  if (score == null) return null;

  const pct = Math.round(score * 100);
  const colorClass = getEpssColorClass(score);
  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-xs";
  const tooltipText =
    percentile != null
      ? `EPSS: ${(score * 100).toFixed(1)}% probability of exploitation in the next 30 days (${Math.round(percentile * 100)}th percentile)`
      : `EPSS: ${(score * 100).toFixed(1)}% probability of exploitation in the next 30 days`;

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono-label font-semibold uppercase ${sizeClass} ${colorClass}`}
      title={tooltipText}
    >
      EPSS {pct}%
    </span>
  );
}
