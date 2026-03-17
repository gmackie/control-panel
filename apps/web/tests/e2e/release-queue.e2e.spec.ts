import { expect, test } from "@playwright/test";

test.describe("Release Queue", () => {
  test("shows the candidate-centered release queue shell", async ({ page }) => {
    await page.goto("/deployments");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/auth/signin")) {
      await expect(page).toHaveURL(/callbackUrl=%2Fdeployments/);
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await expect(
      page.getByRole("heading", { name: /Release Queue/i }),
    ).toBeVisible();
    await expect(page.getByText(/Trust/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Ready/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Blocked/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Releasing/i })).toBeVisible();
  });
});
