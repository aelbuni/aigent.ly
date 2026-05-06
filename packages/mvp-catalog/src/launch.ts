/** Six launch stacks (quality-first MVP). Order = homepage / directory sort. */
export const LAUNCH_STACK_SLUGS = [
  "nextjs",
  "express",
  "fastapi",
  "nestjs",
  "nuxt",
  "react-spa",
] as const;

export type LaunchStackSlug = (typeof LAUNCH_STACK_SLUGS)[number];

/** Tier 2 — incomplete real data; shown as “coming soon” in UI. */
export const COMING_SOON_STACK_SLUGS = ["django", "rails", "go", "ios", "android"] as const;

export type ComingSoonStackSlug = (typeof COMING_SOON_STACK_SLUGS)[number];

export const ALL_CATALOG_STACK_SLUGS = [
  ...LAUNCH_STACK_SLUGS,
  ...COMING_SOON_STACK_SLUGS,
] as const;

export function isLaunchStackSlug(s: string): s is LaunchStackSlug {
  return (LAUNCH_STACK_SLUGS as readonly string[]).includes(s);
}

export function isComingSoonStackSlug(s: string): s is ComingSoonStackSlug {
  return (COMING_SOON_STACK_SLUGS as readonly string[]).includes(s);
}

/** Resolved real GHSA IDs allowed as primary keys (add when placeholders are replaced). */
export const REAL_GHSA_PUBLIC_IDS = new Set<string>([
  // e.g. "GHSA-7gfc-8cq8-jh5f" — populate when advisory IDs are verified
]);
