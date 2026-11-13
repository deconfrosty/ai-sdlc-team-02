import { jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { authSessionDB, type Session, type User } from "@/lib/db";

export const SESSION_COOKIE_NAME = "todo-session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const DEVELOPMENT_SESSION_SECRET =
  "development-only-session-secret-never-use-in-production";

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  const resolvedSecret =
    secret || (process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_SESSION_SECRET);

  if (new TextEncoder().encode(resolvedSecret).byteLength < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes");
  }

  return new TextEncoder().encode(resolvedSecret);
}

export async function createSessionToken(
  user: Pick<User, "id" | "username">,
  expiresInSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomUUID())
    .setSubject(String(user.id))
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(getSessionSecret());
}

interface VerifiedSessionPayload {
  userId: number;
  username: string;
  jti: string;
  exp: number;
}

async function getVerifiedSessionPayload(
  token: string,
): Promise<VerifiedSessionPayload | null> {
  const secret = getSessionSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const userId = payload.userId;
    const username = payload.username;
    const jti = payload.jti;
    const exp = payload.exp;
    if (
      typeof userId !== "number" ||
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      typeof username !== "string" ||
      payload.sub !== String(userId) ||
      typeof jti !== "string" ||
      typeof exp !== "number"
    ) {
      return null;
    }

    return { userId, username, jti, exp };
  } catch {
    return null;
  }
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) {
    return null;
  }

  const payload = await getVerifiedSessionPayload(token);
  if (!payload || authSessionDB.isRevoked(payload.jti)) {
    return null;
  }

  return { userId: payload.userId, username: payload.username };
}

export async function revokeSessionToken(
  token: string | undefined,
): Promise<void> {
  if (!token) {
    return;
  }

  const payload = await getVerifiedSessionPayload(token);
  if (payload) {
    authSessionDB.revoke(payload.jti, payload.exp);
  }
}
