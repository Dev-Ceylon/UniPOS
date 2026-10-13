import { test } from "@playwright/test";
import { expectNoA11yViolations, newBusiness, openRegister } from "./helpers";

test("WCAG 2.2 AA (axe) on register, product form and settings", async ({ page }) => {
  await newBusiness(page);
  await openRegister(page);
  await expectNoA11yViolations(page);
  await page.goto("/products/new");
  await expectNoA11yViolations(page);
  await page.goto("/settings");
  await expectNoA11yViolations(page);
  await page.goto("/sign-in");
});
