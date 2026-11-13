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
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("button", { name: "Use Test todo" })).toBeVisible();
  const exported = await page.request.get("/api/todos/export?format=json");
  expect(exported.status()).toBe(200);
  const snapshot = await exported.json();
  expect(snapshot.todos).toHaveLength(1);
  expect(snapshot.todos[0].subtasks[0].title).toBe("Child task");
  expect(snapshot.todos[0].tags[0].name).toBe("Work");
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
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
});
