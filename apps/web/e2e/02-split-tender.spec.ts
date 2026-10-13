import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister, waitSynced } from "./helpers";

test("split tender: card + cash, change only from cash, printable receipt", async ({ page }) => {
  await newBusiness(page);
  await openRegister(page);
  await addByCode(page, "4791234000042"); // Milk powder 1,250.00
  await page.click("[data-testid=pay-button]");
  await page.click("[data-testid=tender-card]");
  await page.fill("#pay-amount", "1000");
  await page.getByLabel("Reference").fill("4242");
  await page.click("[data-testid=add-payment]");
  await expect(page.getByTestId("remaining")).toHaveText(/250\.00/);
  // card cannot overpay
  await page.click("[data-testid=tender-card]");
  await page.fill("#pay-amount", "500");
  await page.click("[data-testid=add-payment]");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(/cannot exceed/);
  await page.click("[data-testid=tender-cash]");
  await page.fill("#pay-amount", "500");
  await page.click("[data-testid=add-payment]");
  await expect(page.getByTestId("change-due")).toContainText("250.00");
  await page.click("[data-testid=complete-sale]");
  await expect(page.getByTestId("sale-change")).toContainText("250.00");
  await page.keyboard.press("Enter");
  await waitSynced(page);
  await page.goto("/sales");
  await page.locator("a[href^='/sales/']").first().click();
  await expect(page.getByText("****").or(page.getByText("4242"))).toBeVisible();
  await page.getByRole("link", { name: "Print receipt" }).click();
  await expect(page.locator(".receipt")).toContainText("Card");
  await expect(page.locator(".receipt")).toContainText("Change");
});
