import { test } from "@playwright/test";

import { assertResponsivePage, MARKETING_PATHS } from "./helpers/responsive";

for (const path of MARKETING_PATHS) {
  test(`responsive layout ${path}`, async ({ page }) => {
    await assertResponsivePage(page, path);
  });
}
