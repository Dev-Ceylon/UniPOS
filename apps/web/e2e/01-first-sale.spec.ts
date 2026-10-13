import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister, payCash, waitSynced } from "./helpers";

test("sign-up to first sale: onboarding, scan, cash with change, synced to sales history", async ({ page }) => {
  await newBusiness(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await openRegister(page);
  const started = Date.now();
  await addByCode(page, "4791234000011"); // Ceylon Black Tea 450.00
  await addByCode(page, "4791234000011");
  await addByCode(page, "4791234000059"); // Fresh Milk 520.00
  await expect(page.getByTestId("cart-total")).toHaveText(/1,420\.00/);
  await payCash(page, "last");
  await expect(page.getByTestId("sale-change")).toBeVisible();
  // a 3-item cash sale well under the 15 s target (automation is faster than a human, but it guards regressions)
  expect(Date.now() - started).toBeLessThan(15_000);
  await page.keyboard.press("Enter");
  await waitSynced(page);
  await page.goto("/sales");
  await expect(page.getByRole("cell", { name: /1,420\.00/ }).first()).toBeVisible();
});
