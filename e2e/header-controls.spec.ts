import { expect, test } from "@playwright/test";

test.beforeAll(async ({ request }) => {
  test.setTimeout(120000);
  // Compile the homepage before measuring browser interactions on a cold dev server.
  const response = await request.get("/", { timeout: 120000 });
  expect(response.ok()).toBe(true);
});

test("a sign-in bootstrap failure can be retried from the header", async ({ page }) => {
  let failing = true;
  await page.route("**/api/auth/config", async (route) => {
    if (failing) return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    return route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".toast")).toContainText("Unable to connect to sign-in");
  failing = false;
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
});

test("header sign-in creates a session and sign-out restores guest controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("city selection updates the page and survives global navigation and reload", async ({
  page,
}) => {
  await page.goto("/tokyo");
  await page.getByRole("button", { name: "Choose city" }).click();
  const picker = page.getByRole("dialog", { name: "Where are you?" });
  await picker.getByRole("link", { name: "Paris", exact: true }).click();
  await expect(page).toHaveURL(/\/paris$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Paris");
  await expect(page.getByRole("link", { name: "Make a plan" })).toHaveAttribute(
    "href",
    "/paris/now",
  );
  await page.locator(".wordmark").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Choose city" })).toContainText("Paris");
  await expect(page.getByRole("link", { name: "Explore Paris" }).first()).toHaveAttribute(
    "href",
    "/paris",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Choose city" })).toContainText("Paris");
});

test("switching cities preserves a list section and the picker supports Escape", async ({
  page,
}) => {
  await page.goto("/tokyo/events");
  await page.getByRole("button", { name: "Choose city" }).click();
  const picker = page.getByRole("dialog", { name: "Where are you?" });
  await expect(picker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).not.toBeVisible();
  await page.getByRole("button", { name: "Choose city" }).click();
  await picker.getByRole("link", { name: "New York", exact: true }).click();
  await expect(page).toHaveURL(/\/new-york\/events$/);
  await expect(page.getByRole("button", { name: "Choose city" })).toContainText("New York");
});

test("city loading failures offer a working retry", async ({ page }) => {
  let failing = true;
  await page.route("**/api/cities", async (route) => {
    if (failing)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Cities temporarily unavailable." },
        }),
      });
    return route.continue();
  });
  await page.goto("/");
  await expect(page.getByLabel("Switch demo account")).toBeVisible();
  await page.getByRole("button", { name: "Choose city" }).click();
  const picker = page.getByRole("dialog", { name: "Where are you?" });
  await expect(picker.getByRole("alert")).toContainText("Cities temporarily unavailable.");
  failing = false;
  await picker.getByRole("button", { name: "Retry cities" }).click();
  await expect(picker.getByRole("link", { name: "Paris", exact: true })).toBeVisible();
});

test("an early sign-in click survives pending configuration", async ({ page }) => {
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route("**/api/auth/config", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  resume();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
});

test("two city tabs keep their routes without fighting over the saved preference", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    (window as unknown as Window & { cityStorageEvents: number }).cityStorageEvents = 0;
    window.addEventListener("storage", (event) => {
      if (event.key === "new-friendship:selected-city")
        (window as unknown as Window & { cityStorageEvents: number }).cityStorageEvents++;
    });
  });
  await page.goto("/tokyo");
  await expect(page.getByRole("button", { name: "Choose city" })).toContainText("Tokyo");
  const other = await context.newPage();
  await other.goto("/paris");
  await expect(other.getByRole("button", { name: "Choose city" })).toContainText("Paris");
  await expect(page.getByRole("button", { name: "Choose city" })).toContainText("Tokyo");
  // Observe the old storage feedback loop for a bounded interval.
  await page.waitForTimeout(500);
  const events = await page.evaluate(
    () => (window as unknown as Window & { cityStorageEvents: number }).cityStorageEvents,
  );
  expect(events).toBeLessThan(4);
  await page.locator(".wordmark").click();
  await expect(page.getByRole("button", { name: "Choose city" })).toContainText("Paris");
});
