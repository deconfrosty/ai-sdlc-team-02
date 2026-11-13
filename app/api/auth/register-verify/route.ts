import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createSession, getSession } from "@/lib/auth";
import { getWebAuthnConfig } from "@/lib/auth-config";
import { registrationVerifySchema } from "@/lib/auth-requests";
import {
  authChallengeDB,
  authenticatorDB,
  userDB,
} from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = registrationVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration response" },
      { status: 400 },
    );
  }

  const { username, challengeId, response } = parsed.data;
  const challenge = authChallengeDB.consume(challengeId, "registration");
  if (!challenge || challenge.username !== username) {
    return NextResponse.json(
      { error: "Registration request expired or already used" },
      { status: 400 },
    );
  }

  let user = userDB.findByUsername(username);
  if (challenge.user_id !== null) {
    const session = await getSession();
    if (
      !session ||
      session.userId !== challenge.user_id ||
      !user ||
      user.id !== challenge.user_id
    ) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  } else if (user || (await getSession())) {
    return NextResponse.json(
      { error: "Registration is no longer available for this username" },
      { status: 409 },
    );
  }

  const { rpID, origin } = getWebAuthnConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Passkey registration could not be verified" },
      { status: 401 },
    );
  }

  if (!verification.verified) {
    return NextResponse.json(
      { error: "Passkey registration could not be verified" },
      { status: 401 },
    );
  }

  const credential = verification.registrationInfo.credential;
  const credentialRecord = {
    credential_id: credential.id,
    credential_public_key: Buffer.from(credential.publicKey),
    counter: credential.counter ?? 0,
  };

  if (challenge.user_id === null) {
    user = userDB.createWithAuthenticator(username, credentialRecord);
    if (!user) {
      return NextResponse.json(
        { error: "Username or passkey is already registered" },
        { status: 409 },
      );
    }
  } else {
    if (!user || !authenticatorDB.create(challenge.user_id, credentialRecord)) {
      return NextResponse.json(
        { error: "This passkey is already registered" },
        { status: 409 },
      );
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Account could not be loaded" }, { status: 500 });
  }
  await createSession(user);
  return NextResponse.json({ success: true });
}
