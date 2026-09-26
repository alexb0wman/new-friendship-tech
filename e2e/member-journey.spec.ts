import { expect, test } from "@playwright/test";
// Local simulated journeys; real Privy and payment acceptance are separate release checks.
test("preview → simulated purchase → full city access", async ({ page }) => {
  await page.goto("/membership");
  await page.getByLabel("Switch demo account").selectOption("alex");
  await page.getByRole("button", { name: /Try a demo purchase|Simulate renewal/ }).click();
  await expect(page).toHaveURL(/\/checkout\//);
  let accountRefreshes = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/me") accountRefreshes++;
  });
  await page.getByRole("button", { name: "Complete demo purchase" }).click();
  await expect(page.getByRole("heading", { name: "You're in." })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(accountRefreshes).toBeLessThan(5);
  await page.getByRole("link", { name: "Make Tokyo yours" }).click();
  await expect(page).toHaveURL(/\/tokyo$/);
  await expect(page.locator(".place-card")).toHaveCount(24);
});
test("private account control and responsive navigation", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Switch demo account").selectOption("maya");
  const visibility = page.getByRole("checkbox", { name: /Discoverable to members/ });
  await expect(visibility).toBeChecked();
  await visibility.click();
  await expect(visibility).not.toBeChecked();
  await visibility.click();
  await expect(visibility).toBeChecked();
  const navigation = page.viewportSize()!.width < 810 ? "Mobile navigation" : "Main navigation";
  await page
    .getByRole("navigation", { name: navigation, exact: true })
    .getByRole("button", { name: "Network", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Network", exact: true })
    .getByRole("link", { name: /^People/ })
    .click();
  await expect(page).toHaveURL(/\/network$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
test("homepage navigation fits desktop and mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose city" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
