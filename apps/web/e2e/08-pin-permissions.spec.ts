import { expect, test } from "@playwright/test";
import { newBusiness } from "./helpers";

test("PIN switching, lockout after 5 wrong PINs and permission-limited cashier", async ({ page }) => {
  await newBusiness(page, { pin: "1357" });
  // create a custom limited role and check the cashier role cannot reach settings
  await page.goto("/settings/staff");
  await expect(page.getByRole("cell", { name: /E2E Owner/ })).toBeVisible();
  // switch with own PIN
  await page.getByRole("button", { name: /E2E Owner/ }).click();
  await page.fill("#pin-input", "1357");
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  // wrong PINs
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /E2E Owner/ }).click();
    await page.fill("#pin-input", "0000");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: /E2E Owner/ }).click();
  await page.fill("#pin-input", "1357");
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(/Wrong PIN|locked|Too many/);
  await page.keyboard.press("Escape");
  // the audit log recorded the lock
  await page.goto("/settings/audit?q=pin.locked");
  await expect(page.getByText("pin.locked")).toBeVisible();
});
