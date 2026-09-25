import { expect, test } from "@playwright/test";
// Provided for the receiving build environment. Not executed by this handoff environment.
test("preview → simulated purchase → full city access", async ({ page }) => {
  await page.goto("/membership");
  await page.getByLabel("Switch demo account").selectOption("alex");
  await page.getByRole("button", { name: /Try a demo purchase|Simulate renewal/ }).click();
  await expect(page).toHaveURL(/\/checkout\//);
  await page.getByRole("button", { name: "Complete demo purchase" }).click();
  await expect(page.getByRole("heading", { name: "You're in." })).toBeVisible();
  await page.getByRole("link", { name: "Make Tokyo yours" }).click();
  await expect(page).toHaveURL(/\/tokyo$/);
  await expect(page.locator(".place-card")).toHaveCount(24);
});
test("private account control and responsive navigation", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Switch demo account").selectOption("maya");
  const visibility = page.getByRole("checkbox", { name: /Discoverable to members/ });
  await expect(visibility).toBeChecked();
  await visibility.uncheck();
  await expect(visibility).not.toBeChecked();
  await visibility.check();
  await page.getByRole("link", { name: "People", exact: true }).click();
  await expect(page).toHaveURL(/\/tokyo\/people$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
test("marketing keeps cumulative event attendance distinct from product usage", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/60K\+/).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
