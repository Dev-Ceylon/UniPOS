import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister, payCash, waitSynced } from "./helpers";

test("quick-create a customer at the register, earn points, see purchase history and reports", async ({ page }) => {
  await newBusiness(page);
  await page.goto("/settings");
  await page.getByRole("checkbox", { name: "Customers earn points on purchases" }).check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await openRegister(page);
  await page.getByRole("button", { name: /Walk-in/ }).click();
  await page.getByRole("button", { name: "New customer" }).click();
  await page.fill("#c-name", "Dilini Perera");
  await page.fill("#c-phone", "0771234567");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("button", { name: /Dilini Perera/ })).toBeVisible();
  for (let i = 0; i < 3; i++) await addByCode(page, "4791234000042"); // 3 × 1,250 = 3,750 → 3 points
  await payCash(page);
  await page.keyboard.press("Enter");
  await waitSynced(page);
  await page.goto("/customers?q=Dilini");
  await page.getByRole("link", { name: "Dilini Perera" }).click();
  await expect(page.getByText("Loyalty points")).toBeVisible();
  await expect(page.locator("text=3,750.00").first()).toBeVisible();
  await page.goto("/reports?type=products");
  await expect(page.getByRole("cell", { name: /Full Cream Milk Powder/ })).toBeVisible();
  const csv = await page.request.get("/api/v1/reports/export?type=products&format=csv");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Full Cream Milk Powder");
});
