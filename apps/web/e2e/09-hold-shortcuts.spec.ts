import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister } from "./helpers";

test("hold and resume with keyboard shortcuts, discounts within the threshold", async ({ page }) => {
  await newBusiness(page);
  await openRegister(page);
  await addByCode(page, "4791234000011");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("F8"); // hold
  await expect(page.getByText("Scan or tap a product to start a sale")).toBeVisible();
  await addByCode(page, "4791234000059");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("F9"); // resume list
  await page.getByRole("dialog").getByRole("button", { name: "Resume" }).first().click();
  await expect(page.getByTestId("cart-lines")).toContainText("Ceylon Black Tea");
  // the sale in progress was held in turn
  await page.keyboard.press("F9");
  await expect(page.getByRole("dialog")).toContainText("Fresh Milk");
  await page.keyboard.press("Escape");
  // order discount 10%
  await page.keyboard.press("F7");
  await page.fill("#disc-value", "10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("cart-total")).toHaveText(/405\.00/);
  // above threshold (20%) is blocked for… owners have override, so allowed
  await page.keyboard.press("F4");
  await expect(page.getByRole("dialog", { name: "Payment" })).toBeVisible();
});
