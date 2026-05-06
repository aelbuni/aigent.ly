import { expect, test } from "@playwright/test";

const paths = [
  "/",
  "/rules",
  "/threats",
  "/stacks",
  "/composer",
  "/learn",
  "/work-with-us",
] as const;

test.describe("public pages", () => {
  for (const path of paths) {
    test(`${path} loads`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `HTTP status for ${path}`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      const noise = (e: string) =>
        e.includes("favicon") ||
        e.includes("Failed to load resource") ||
        e.includes("net::ERR");
      expect(errors.filter((e) => !noise(e))).toEqual([]);
    });
  }

  test("/stacks/nextjs loads or 404", async ({ page }) => {
    const res = await page.goto("/stacks/nextjs", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(500);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
