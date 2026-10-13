import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "password123";

/** Create a new account and business through the real UI. */
export async function newBusiness(page: Page, opts: { type?: string; name?: string; pin?: string; demo?: boolean } = {}) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto("/sign-up");
  await page.fill("#name", "E2E Owner");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL("**/onboarding");
  await page.fill("#businessName", opts.name ?? "E2E Shop");
  if (opts.type) await page.selectOption("#businessType", opts.type);
  await page.fill("#pin", opts.pin ?? "4321");
  if (opts.demo === false) await page.getByLabel("Add demo products so I can try it now").uncheck();
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  return email;
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/dashboard|register/);
}

export async function openRegister(page: Page) {
  await page.goto("/register");
  await expect(page.locator("[data-testid=product-grid] button").first()).toBeVisible({ timeout: 30_000 });
}

/** Add a product by searching (or scanning) and pressing Enter. */
export async function addByCode(page: Page, code: string) {
  await page.fill("[data-testid=register-search]", code);
  await page.press("[data-testid=register-search]", "Enter");
}

export async function payCash(page: Page, quick: "exact" | "last" = "exact") {
  await page.click("[data-testid=pay-button]");
  const buttons = page.locator("[data-testid=quick-cash]");
  await (quick === "exact" ? buttons.first() : buttons.last()).click();
  await page.click("[data-testid=complete-sale]");
  await expect(page.getByTestId("new-sale")).toBeVisible();
}

export async function waitSynced(page: Page) {
  await expect(page.getByTestId("sync-indicator")).toHaveText(/Online/, { timeout: 30_000 });
}

export async function expectNoA11yViolations(page: Page, exclude: string[] = []) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  for (const e of exclude) builder = builder.exclude(e);
  const results = await builder.analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")})`,
    ),
  ).toEqual([]);
}
