import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister, payCash, waitSynced } from "./helpers";

test("return: partial refund linked to the original sale, restocked, never more than sold", async ({ page }) => {
  await newBusiness(page);
  await openRegister(page);
  const stockBefore = Number((await page.locator("[data-testid=product-grid] button", { hasText: "Ceylon Black Tea" }).innerText()).match(/(-?\d+) left/)![1]);
  await addByCode(page, "4791234000011");
  await addByCode(page, "4791234000011");
  await addByCode(page, "4791234000011");
  await payCash(page);
  await page.keyboard.press("Enter");
  await waitSynced(page);
  await page.goto("/sales");
  await page.locator("a[href^='/sales/']").first().click();
  await page.getByTestId("refund-button").click();
  await page.getByLabel(/Refund quantity/).fill("1");
  await page.fill("#reason", "Damaged pack");
  await page.getByTestId("confirm-refund").click();
  await page.waitForURL(/\/sales\/.+/);
  await expect(page.getByRole("heading", { name: /Refund RF-/ })).toBeVisible();
  await expect(page.getByText(/Refund of/)).toBeVisible();
  // original now shows 1 refunded and only 2 refundable
  await page.getByRole("link", { name: /MAIN-/ }).click();
  await expect(page.getByText("1 refunded")).toBeVisible();
  await page.getByTestId("refund-button").click();
  await expect(page.getByText(/2 of 3 refundable/)).toBeVisible();
  await page.keyboard.press("Escape");
  await openRegister(page);
  // 3 sold, 1 returned to stock
  await expect(page.locator("[data-testid=product-grid] button", { hasText: "Ceylon Black Tea" })).toContainText(`${stockBefore - 2} left`);
});
