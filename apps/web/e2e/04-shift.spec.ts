import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister, payCash, waitSynced } from "./helpers";

test("shift: opening float, cash out, sale, cash-up with variance", async ({ page }) => {
  await newBusiness(page);
  await page.goto("/shifts");
  await page.fill("#float", "5000");
  await page.getByRole("button", { name: "Open shift" }).click();
  await expect(page.getByText("Current shift")).toBeVisible();
  await page.getByLabel("Cash in or out").selectOption("out");
  await page.getByLabel("Amount").fill("200");
  await page.getByLabel("Reason").fill("Milk for staff");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("Milk for staff")).toBeVisible();
  await openRegister(page);
  await addByCode(page, "4791234000011"); // 450.00 cash exact
  await payCash(page);
  await page.keyboard.press("Enter");
  await waitSynced(page);
  await page.goto("/shifts", { waitUntil: "networkidle" });
  // expected = 5000 + 450 − 200 = 5250
  await expect(page.getByTestId("expected-cash").filter({ visible: true })).toHaveText(/5,250\.00/);
  await page
    .getByLabel(/Count of LKR\s5,000\.00/)
    .filter({ visible: true })
    .fill("1");
  await page
    .getByLabel(/Count of LKR\s100\.00/)
    .filter({ visible: true })
    .fill("2");
  await page.getByTestId("close-shift").filter({ visible: true }).click();
  await expect(page.getByText(/variance\s-?LKR\s?-?50\.00/i)).toBeVisible();
});
