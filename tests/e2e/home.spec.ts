import { expect, test } from "@playwright/test";

test.describe("home marketing", () => {
  test("hero, personas, and stats are present", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: /Your AI coding tool writes fast/i })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Four real stories" })).toBeVisible();
    await expect(page.getByText("Apache-2.0 licensed")).toBeVisible();
    await expect(page.getByText("The job to be done")).toBeVisible();
  });
});
