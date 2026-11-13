import { jwtVerify, SignJWT } from "jose";
import type { Session, User } from "@/lib/db";

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
    .setSubject(String(user.id))
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) {
    return null;
  }

  const secret = getSessionSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "number" ||
      !Number.isSafeInteger(payload.userId) ||
      payload.userId < 1 ||
      typeof payload.username !== "string" ||
      payload.sub !== String(payload.userId)
    ) {
      return null;
    }

    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}
