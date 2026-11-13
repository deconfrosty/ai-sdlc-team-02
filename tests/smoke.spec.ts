import { expect, test } from "@playwright/test";

test("redirects unauthenticated users to passkey sign-in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in with a passkey" }),
  ).toBeVisible();
});
