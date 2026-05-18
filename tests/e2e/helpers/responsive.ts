import { expect, type Page } from "@playwright/test";

/** Public marketing routes to check for layout regressions. */
export const MARKETING_PATHS = [
  "/",
  "/rules",
  "/threats",
  "/threats?page=2",
  "/explore",
  "/stacks",
  "/stacks/nextjs",
  "/layers",
  "/news",
  "/learn",
  "/composer",
  "/work-with-us",
  "/contributing",
  "/submit-stack",
  "/rules/new",
  "/demo/summarizer",
] as const;

export async function assertResponsivePage(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(res?.status(), `HTTP status for ${path}`).toBeLessThan(500);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const footer = document.querySelector(".site-ui > footer");
    const site = document.querySelector(".site-ui");

    window.scrollTo(0, doc.scrollHeight);
    const footerRect = footer?.getBoundingClientRect();

    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      siteScrollHeight: site?.scrollHeight ?? 0,
      siteOffsetHeight: site?.offsetHeight ?? 0,
      footerBottom: footerRect?.bottom ?? null,
      viewportHeight: window.innerHeight,
    };
  });

  expect(
    metrics.scrollWidth,
    `${path}: horizontal overflow (scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);

  const isScrollable = metrics.scrollHeight > metrics.viewportHeight + 16;
  if (isScrollable && metrics.footerBottom !== null) {
    expect(
      Math.abs(metrics.footerBottom - metrics.viewportHeight),
      `${path}: ghost scroll below footer (footer bottom ${metrics.footerBottom}, viewport ${metrics.viewportHeight})`,
    ).toBeLessThanOrEqual(12);
  }

  const siteGhostScroll =
    metrics.siteOffsetHeight > 0 &&
    metrics.siteScrollHeight > metrics.siteOffsetHeight + 50;
  expect(
    siteGhostScroll,
    `${path}: .site-ui scrollHeight (${metrics.siteScrollHeight}) >> offsetHeight (${metrics.siteOffsetHeight})`,
  ).toBe(false);
}
