import { expect, test } from "@playwright/test";
import { addByCode, newBusiness, openRegister, payCash, waitSynced } from "./helpers";

test("offline sale is saved locally, then syncs exactly once when back online", async ({ page, context }) => {
  await newBusiness(page);
  await openRegister(page);
  await page.waitForTimeout(1500); // catalog cached in IndexedDB
  await context.setOffline(true);
  await expect(page.getByText(/Offline — sales are saved on this device/)).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await addByCode(page, "4791234000059");
    await payCash(page);
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("sync-indicator")).toContainText("3");
  await page.goto("/sales").catch(() => undefined); // navigation fails offline; stay on the register
  await context.setOffline(false);
  await page.goto("/register");
  await waitSynced(page);
  await page.goto("/sales?status=");
  await expect(page.getByRole("cell", { name: /520\.00/ })).toHaveCount(3);
  // retry does not duplicate
  await page.goto("/register");
  await page.getByTestId("sync-indicator").click();
  await page.goto("/sales");
  await expect(page.getByRole("cell", { name: /520\.00/ })).toHaveCount(3);
});
