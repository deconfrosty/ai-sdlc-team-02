import { expect, test } from "@playwright/test";
import {
  createSessionToken,
  revokeSessionToken,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../lib/session-token";
import {
  authenticatorDB,
  authChallengeDB,
  closeDatabase,
  userDB,
} from "../lib/db";
import { isValidAuthenticatorCounter } from "../lib/auth-utils";

test("registers, persists, adds a second passkey, signs in, and logs out", async ({
  browser,
  page,
}) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const firstAuthenticator = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );

  const username = `auth-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Create account with passkey" }).click();
  await expect(page.getByRole("heading", { name: `Welcome, ${username}` })).toBeVisible();

  const cookies = await page.context().cookies("http://localhost:3000");
  const sessionCookie = cookies.find(
    (cookie) => cookie.name === SESSION_COOKIE_NAME,
  );
  expect(sessionCookie).toBeDefined();
  const copiedSessionToken = sessionCookie?.value;
  if (!copiedSessionToken) {
    throw new Error("Session cookie was not created");
  }
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  const expectedExpiry = Date.now() / 1000 + 7 * 24 * 60 * 60;
  expect(sessionCookie?.expires).toBeGreaterThan(expectedExpiry - 5);
  expect(sessionCookie?.expires).toBeLessThan(expectedExpiry + 5);

  await page.reload();
  await expect(page.getByRole("heading", { name: `Welcome, ${username}` })).toBeVisible();
  const meResponse = await page.request.get("/api/auth/me");
  expect(meResponse.status()).toBe(200);
  expect(await meResponse.json()).toMatchObject({
    user: { username },
  });

  const persistedContext = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  const persistedPage = await persistedContext.newPage();
  await persistedPage.goto("/");
  await expect(
    persistedPage.getByRole("heading", { name: `Welcome, ${username}` }),
  ).toBeVisible();
  await persistedContext.close();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await page.context().cookies("http://localhost:3000")).some(
      (cookie) => cookie.name === SESSION_COOKIE_NAME,
    ),
  ).toBe(false);
  const replayedSession = await page.request.get("/api/auth/me", {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${copiedSessionToken}` },
  });
  expect(replayedSession.status()).toBe(401);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: `Welcome, ${username}` })).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL("/");

  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.getByRole("button", { name: "Add another passkey" }).click();
  await expect(page.getByRole("status")).toHaveText("Passkey added to your account.");

  await cdp.send("WebAuthn.removeVirtualAuthenticator", {
    authenticatorId: firstAuthenticator.authenticatorId,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: `Welcome, ${username}` })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const duplicateRegistration = await page.request.post(
    "/api/auth/register-options",
    { data: { username } },
  );
  expect(duplicateRegistration.status()).toBe(409);

  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Create account with passkey" }).click();
  await expect(page.locator("p[role='alert']")).toContainText("Username already taken");
  await expect(page).toHaveURL(/\/login$/);

  const unknownLogin = await page.request.post("/api/auth/login-options", {
    data: { username: `${username}-unknown` },
  });
  expect(unknownLogin.status()).toBe(404);

  await page.getByLabel("Username").fill(`${username}-unknown`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role='alert']")).toContainText(
    "Unable to start login for this user",
  );
  const loggedOutMeResponse = await page.request.get("/api/auth/me");
  expect(loggedOutMeResponse.status()).toBe(401);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login$/);
  await cdp.send("WebAuthn.disable");
});

test("session tokens are signed, revocable, tamper-resistant, and expire", async () => {
  const user = { id: 12, username: "session-user" };
  const token = await createSessionToken(user);
  const otherSessionToken = await createSessionToken(user);
  expect(await verifySessionToken(token)).toEqual({
    userId: user.id,
    username: user.username,
  });
  await revokeSessionToken(token);
  expect(await verifySessionToken(token)).toBeNull();
  expect(await verifySessionToken(otherSessionToken)).toEqual({
    userId: user.id,
    username: user.username,
  });
  expect(await verifySessionToken(`${token}tampered`)).toBeNull();
  expect(await verifySessionToken(await createSessionToken(user, -1))).toBeNull();
});

test("challenges expire and can only be consumed once", () => {
  const validId = crypto.randomUUID();
  const expiredId = crypto.randomUUID();

  try {
    authChallengeDB.save(
      {
        id: validId,
        username: "challenge-user",
        kind: "authentication",
        challenge: "challenge-value",
        user_id: null,
      },
      Date.now() + 10_000,
    );
    authChallengeDB.save(
      {
        id: expiredId,
        username: "challenge-user",
        kind: "registration",
        challenge: "expired-value",
        user_id: null,
      },
      Date.now() - 1,
    );

    expect(authChallengeDB.consume(validId, "authentication")?.challenge).toBe(
      "challenge-value",
    );
    expect(authChallengeDB.consume(validId, "authentication")).toBeUndefined();
    expect(authChallengeDB.consume(expiredId, "registration")).toBeUndefined();
  } finally {
    closeDatabase();
  }
});

test("authenticator counters update atomically and reject stale updates", () => {
  try {
    const user = userDB.createWithAuthenticator("counter-user", {
      credential_id: "counter-credential",
      credential_public_key: Buffer.from([1, 2, 3]),
      counter: 0,
    });
    if (!user) {
      throw new Error("Could not create test user");
    }
    const [authenticator] = authenticatorDB.findAllByUserId(user.id);
    if (!authenticator) {
      throw new Error("Could not create test authenticator");
    }
    expect(authenticator.counter).toBe(0);

    expect(authenticatorDB.updateCounter(authenticator.id, 0, 1)).toBe(true);
    expect(
      authenticatorDB.findByCredentialId("counter-credential")?.counter,
    ).toBe(1);
    expect(authenticatorDB.updateCounter(authenticator.id, 0, 2)).toBe(false);
  } finally {
    closeDatabase();
  }
});

test("authenticator counters must advance except for zero-counter authenticators", () => {
  expect(isValidAuthenticatorCounter(0, 0)).toBe(true);
  expect(isValidAuthenticatorCounter(2, 3)).toBe(true);
  expect(isValidAuthenticatorCounter(3, 3)).toBe(false);
  expect(isValidAuthenticatorCounter(3, 2)).toBe(false);
});
