import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getSession } from "@/lib/auth";
import { getWebAuthnConfig } from "@/lib/auth-config";
import { usernameSchema } from "@/lib/auth-requests";
import {
  authChallengeDB,
  authenticatorDB,
  userDB,
} from "@/lib/db";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = usernameSchema.safeParse(
    typeof body === "object" && body !== null && "username" in body
      ? body.username
      : undefined,
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid username is required" }, { status: 400 });
  }

  const username = parsed.data;
  const session = await getSession();
  const existingUser = userDB.findByUsername(username);

  if (session) {
    if (!existingUser || existingUser.id !== session.userId) {
      return NextResponse.json(
        { error: "You can only add a passkey to your current account" },
        { status: 403 },
      );
    }
  } else if (existingUser) {
    return NextResponse.json(
      { error: "Username already taken" },
      { status: 409 },
    );
  }

  const { rpID, rpName } = getWebAuthnConfig();
  const challengeId = randomUUID();
  const existingCredentials = existingUser
    ? authenticatorDB.findAllByUserId(existingUser.id)
    : [];
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    userDisplayName: username,
    userID: isoBase64URL.toBuffer(
      createHash("sha256")
        .update(`${rpID}:${username}`)
        .digest("base64url"),
    ),
    attestationType: "none",
    excludeCredentials: existingCredentials.map((credential) => ({
      id: credential.credential_id,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  authChallengeDB.save(
    {
      id: challengeId,
      username,
      kind: "registration",
      challenge: options.challenge,
      user_id: existingUser?.id ?? null,
    },
    Date.now() + CHALLENGE_TTL_MS,
  );

  return NextResponse.json({ options, challengeId });
}
