const LOCAL_RP_ID = "localhost";
const LOCAL_ORIGIN = "http://localhost:3000";

export interface WebAuthnConfig {
  rpID: string;
  rpName: string;
  origin: string;
}

export function getWebAuthnConfig(): WebAuthnConfig {
  const rpID =
    process.env.WEBAUTHN_RP_ID ??
    (process.env.NODE_ENV === "production" ? undefined : LOCAL_RP_ID);
  const origin =
    process.env.WEBAUTHN_ORIGIN ??
    (process.env.NODE_ENV === "production" ? undefined : LOCAL_ORIGIN);
  const rpName = process.env.WEBAUTHN_RP_NAME ?? "AI SDLC Team 02 Todo App";

  if (!rpID || !origin) {
    throw new Error(
      "WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN must be configured in production",
    );
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error("WEBAUTHN_ORIGIN must be a valid origin URL");
  }

  const isLocalOrigin =
    parsedOrigin.hostname === "localhost" ||
    parsedOrigin.hostname === "127.0.0.1" ||
    parsedOrigin.hostname === "[::1]";
  if (
    parsedOrigin.origin !== origin ||
    (parsedOrigin.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && isLocalOrigin)) ||
    (parsedOrigin.hostname !== rpID &&
      !parsedOrigin.hostname.endsWith(`.${rpID}`))
  ) {
    throw new Error("WEBAUTHN_ORIGIN must be HTTPS and match WEBAUTHN_RP_ID");
  }

  return { rpID, rpName, origin };
}
