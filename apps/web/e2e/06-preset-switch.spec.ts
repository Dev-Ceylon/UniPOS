import { expect, test } from "@playwright/test";
import { newBusiness, openRegister } from "./helpers";

test("switching Retail → Restaurant preset changes nav, register layout and receipts with no code change", async ({ page }) => {
  await newBusiness(page);
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await expect(nav.getByRole("link", { name: "Kitchen display" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Transfers" })).toHaveCount(1);
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.selectOption("#preset", "restaurant");
  await page.getByTestId("apply-preset").filter({ visible: true }).click();
  await expect(page.getByText(/Switched to Restaurant/)).toBeVisible();
  await page.reload();
  await expect(nav.getByRole("link", { name: "Kitchen display" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Transfers" })).toHaveCount(0);
  await openRegister(page);
  await expect(page.getByRole("toolbar", { name: "Choose a table" })).toBeVisible();
  await page.getByRole("button", { name: /Table T1/ }).click();
  // restaurant preset asks for the number of guests
  await expect(page.getByRole("dialog", { name: "Guests" })).toBeVisible();
  await page.getByRole("dialog", { name: "Guests" }).getByRole("button", { name: "2", exact: true }).click();
  await page.locator("[data-testid=product-grid] button").first().click();
  await page.click("[data-testid=pay-button]");
  await page.locator("[data-testid=quick-cash]").first().click();
  await page.click("[data-testid=complete-sale]");
  await expect(page.locator(".receipt")).toContainText("Table");
  await expect(page.locator(".receipt")).toContainText("T1");
  // and back: modules toggle off restaurant
  await page.keyboard.press("Enter");
  await page.goto("/settings/modules", { waitUntil: "networkidle" });
  await page.getByTestId("module-restaurant").filter({ visible: true }).uncheck({ force: true });
  await page.getByTestId("save-modules").filter({ visible: true }).click();
  await expect(page.getByText("Modules updated")).toBeVisible();
  await page.reload();
  await expect(nav.getByRole("link", { name: "Kitchen display" })).toHaveCount(0);
});
