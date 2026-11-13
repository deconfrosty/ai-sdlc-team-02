import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createSession } from "@/lib/auth";
import { getWebAuthnConfig } from "@/lib/auth-config";
import { authenticationVerifySchema } from "@/lib/auth-requests";
import { isValidAuthenticatorCounter } from "@/lib/auth-utils";
import { authChallengeDB, authenticatorDB, userDB } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = authenticationVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid authentication response" },
      { status: 400 },
    );
  }

  const { username, challengeId, response } = parsed.data;
  const challenge = authChallengeDB.consume(challengeId, "authentication");
  if (!challenge || challenge.username !== username || challenge.user_id === null) {
    return NextResponse.json(
      { error: "Authentication request expired or already used" },
      { status: 401 },
    );
  }

  const user = userDB.findById(challenge.user_id);
  const authenticator = authenticatorDB.findByCredentialId(response.id);
  if (
    !user ||
    user.username !== username ||
    !authenticator ||
    authenticator.user_id !== user.id
  ) {
    return NextResponse.json(
      { error: "Authenticator not recognized" },
      { status: 401 },
    );
  }

  const previousCounter = authenticator.counter ?? 0;
  const { rpID, origin } = getWebAuthnConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credential_id,
        publicKey: Uint8Array.from(authenticator.credential_public_key),
        counter: previousCounter,
      },
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Passkey authentication could not be verified" },
      { status: 401 },
    );
  }

  if (
    !verification.verified ||
    !isValidAuthenticatorCounter(
      previousCounter,
      verification.authenticationInfo.newCounter ?? 0,
    )
  ) {
    return NextResponse.json(
      { error: "Passkey authentication could not be verified" },
      { status: 401 },
    );
  }

  const newCounter = verification.authenticationInfo.newCounter ?? 0;
  if (
    !authenticatorDB.updateCounter(
      authenticator.id,
      previousCounter,
      newCounter,
    )
  ) {
    return NextResponse.json(
      { error: "Passkey authentication could not be verified" },
      { status: 401 },
    );
  }

  await createSession(user);
  return NextResponse.json({ success: true });
}
