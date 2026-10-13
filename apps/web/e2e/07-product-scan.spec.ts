import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister, payCash, waitSynced } from "./helpers";

test("create a product with a generated barcode, scan it at the register, stock ledger updates", async ({ page }) => {
  await newBusiness(page);
  await page.goto("/products/new");
  await page.fill("#name", "E2E Coconut Biscuits");
  await page.fill("#v0-sku", "E2E-BISC");
  await page.getByLabel("Generate barcode").click();
  await expect(page.locator("#v0-barcode")).toHaveValue(/^20\d{11}$/);
  const barcode = await page.locator("#v0-barcode").inputValue();
  await page.fill("#v0-price", "180");
  await page.fill("#v0-cost", "120");
  await page.fill("#v0-open", "10");
  await page.getByRole("button", { name: "Save product" }).click();
  await page.waitForURL(/\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Opening")).toBeVisible();
  await openRegister(page);
  await page.getByLabel("Refresh catalog").click();
  await page.waitForTimeout(1000);
  await addByCode(page, barcode);
  await addByCode(page, barcode);
  await expect(page.getByTestId("cart-total")).toHaveText(/360\.00/);
  await payCash(page);
  await page.keyboard.press("Enter");
  await waitSynced(page);
  await page.goto("/inventory?q=Coconut");
  await expect(page.getByRole("row", { name: /E2E Coconut Biscuits/ })).toContainText("8");
});
