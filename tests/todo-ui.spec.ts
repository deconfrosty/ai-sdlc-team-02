import { expect, test } from "@playwright/test";

test("registered user creates, completes and deletes a todo with a subtask", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto("/login");
  await page.getByLabel("Username").fill(`todo-ui-${Date.now()}`);
  await page.getByRole("button", { name: "Create account with passkey" }).click();
  await expect(page.getByLabel("Todo title")).toBeVisible();
  await page.getByLabel("Todo title").fill("Test todo");
  await page.getByRole("button", { name: "Add todo" }).click();
  await expect(page.getByText("Test todo", { exact: true })).toBeVisible();
  await page.getByLabel("Tag name").fill("Work");
  await page.getByRole("button", { name: "Create tag" }).click();
  await page.getByRole("button", { name: "+ Work" }).click();
  await expect(page.getByRole("button", { name: "✓ Work" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("New subtask for Test todo").fill("Child task");
  await page.getByRole("button", { name: "Add subtask" }).click();
  await expect(page.getByText("Child task")).toBeVisible();
  await page.getByLabel("Complete Child task").click();
  await expect(page.getByText("1/1 subtasks")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Subtask progress for Test todo" })).toHaveAttribute("value", "1");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("button", { name: "Use Test todo" })).toBeVisible();
  const exported = await page.request.get("/api/todos/export?format=json");
  expect(exported.status()).toBe(200);
  const snapshot = await exported.json();
  expect(snapshot.todos).toHaveLength(1);
  expect(snapshot.todos[0].subtasks[0].title).toBe("Child task");
  expect(snapshot.todos[0].tags[0].name).toBe("Work");
  await page.getByRole("button", { name: "Edit Work" }).click();
  await page.getByLabel("Edit tag name").fill("Focus");
  await page.getByLabel("Edit tag color").fill("#ff0000");
  await page.getByRole("button", { name: "Save tag" }).click();
  await expect(page.getByRole("button", { name: "✓ Focus" })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Edit priority").selectOption("high");
  await page.getByLabel("Edit due date (Singapore)").fill("2099-12-10T09:00");
  await page.getByLabel("Edit repeat").selectOption("monthly");
  await page.getByLabel("Edit reminder").selectOption("30");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Edit title")).toHaveCount(0);
  const edited = await (await page.request.get("/api/todos")).json();
  expect(edited[0]).toMatchObject({ priority: "high", due_date: "2099-12-10T01:00:00.000Z", is_recurring: true, recurrence_pattern: "monthly", reminder_minutes: 30 });
  await page.getByLabel("Filter priority").selectOption("low");
  await page.getByLabel("Filter preset name").fill("Low priority");
  await page.getByRole("button", { name: "Save filters" }).click();
  await page.getByLabel("Filter priority").selectOption("");
  await page.reload();
  await page.getByRole("button", { name: "Apply Low priority" }).click();
  await expect(page.getByLabel("Filter priority")).toHaveValue("low");
  await expect(page.getByText("Test todo", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Delete preset Low priority" }).click();
  await page.getByLabel("Filter priority").selectOption("");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Edit repeat").selectOption("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.goto("/calendar?month=2099-12");
  await expect(page.getByRole("heading", { name: "December 2099" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2099-12-10" })).toContainText("Test todo");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/month=2100-01/);
  await expect(page.getByRole("heading", { name: "January 2100" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "December 2099" })).toBeVisible();
  await page.goto("/calendar?month=2027-02");
  await expect(page.getByRole("button", { name: "2027-02-08" })).toContainText("Chinese New Year (observed)");
  await page.getByRole("link", { name: "Back to todos" }).click();
  await expect(page.getByText("Test todo", { exact: true })).toBeVisible();
  const rejected = await page.request.post("/api/todos/import", { data: { version: 1, todos: [{ title: "" }] } });
  expect(rejected.status()).toBe(400);
  await page.getByLabel("Complete Test todo").click();
  await expect(page.getByLabel("Complete Test todo")).toBeChecked();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Test todo", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Use Test todo" }).click();
  await expect(page.getByText("Child task")).toBeVisible();
  await expect(page.getByLabel("Complete Child task")).not.toBeChecked();
  const imported = await page.request.post("/api/todos/import", { data: snapshot });
  expect(imported.status()).toBe(200);
  expect(await imported.json()).toEqual({ imported: 1 });
  const after = await page.request.get("/api/todos");
  expect((await after.json()).length).toBe(2);
});
