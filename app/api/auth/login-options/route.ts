import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getWebAuthnConfig } from "@/lib/auth-config";
import { usernameSchema } from "@/lib/auth-requests";
import { authChallengeDB, authenticatorDB, userDB } from "@/lib/db";

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
  const user = userDB.findByUsername(username);
  const authenticators = user
    ? authenticatorDB.findAllByUserId(user.id)
    : [];
  if (!user || authenticators.length === 0) {
    return NextResponse.json(
      { error: "Unable to start login for this user" },
      { status: 404 },
    );
  }

  const { rpID } = getWebAuthnConfig();
  const challengeId = randomUUID();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: authenticators.map((authenticator) => ({
      id: authenticator.credential_id,
    })),
    userVerification: "required",
  });

  authChallengeDB.save(
    {
      id: challengeId,
      username,
      kind: "authentication",
      challenge: options.challenge,
      user_id: user.id,
    },
    Date.now() + CHALLENGE_TTL_MS,
  );

  return NextResponse.json({ options, challengeId });
}
