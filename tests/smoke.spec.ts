import { expect, test } from "@playwright/test";

test("shows the shared project foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Todo App foundation" }),
  ).toBeVisible();
  await expect(
    page.getByText("Authentication and the 11 product features are not implemented yet."),
  ).toBeVisible();
});
