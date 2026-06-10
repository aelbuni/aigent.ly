interface SourceChipProps {
  source: string | null | undefined;
  size?: "sm" | "md";
}

const SOURCE_CONFIG: Record<string, { label: string; className: string; tooltip: string }> = {
  cisa_kev: {
    label: "CISA KEV",
    className: "bg-error/10 text-error border-error/30",
    tooltip: "CISA Known Exploited Vulnerabilities — confirmed active exploitation. Highest priority.",
  },
  nvd: {
    label: "NVD",
    className: "bg-surface-container text-on-surface-variant border-outline-variant",
    tooltip: "NIST National Vulnerability Database — the authoritative CVE registry. Primary enrichment source.",
  },
  ghsa: {
    label: "GHSA",
    className: "bg-surface-container text-on-surface-variant border-outline-variant",
    tooltip: "GitHub Security Advisories — maintainer-reported vulnerabilities for open-source packages.",
  },
  osv: {
    label: "OSV",
    className: "bg-surface-container text-on-surface-variant border-outline-variant",
    tooltip: "Open Source Vulnerabilities — cross-ecosystem advisory database by Google.",
  },
  npm_audit: {
    label: "npm Audit",
    className: "bg-surface-container text-on-surface-variant border-outline-variant",
    tooltip: "npm Audit — package-level vulnerability data from the npm registry.",
  },
  aigently: {
    label: "Aigently",
    className: "bg-primary/10 text-primary border-primary/30",
    tooltip: "Aigently internal — curated threat not yet in a public CVE database.",
  },
  aigently_internal: {
    label: "Aigently",
    className: "bg-primary/10 text-primary border-primary/30",
    tooltip: "Aigently internal — curated threat not yet in a public CVE database.",
  },
  mitre_atlas: {
    label: "MITRE ATLAS",
    className: "bg-surface-container text-on-surface-variant border-outline-variant",
    tooltip: "MITRE ATLAS — adversarial threat landscape for AI systems.",
  },
};

/**
 * Displays the CVE source as a labeled chip with a methodology tooltip.
 * Returns null for unknown or empty sources.
 */
export function SourceChip({ source, size = "sm" }: SourceChipProps) {
  if (!source) return null;

  const cfg = SOURCE_CONFIG[source];
  if (!cfg) return null;

  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-mono-label font-semibold ${sizeClass} ${cfg.className}`}
      title={cfg.tooltip}
    >
      {cfg.label}
    </span>
  );
}
