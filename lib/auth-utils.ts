export function isValidAuthenticatorCounter(
  storedCounter: number | undefined,
  newCounter: number | undefined,
): boolean {
  const stored = storedCounter ?? 0;
  const next = newCounter ?? 0;
  return (stored === 0 && next === 0) || next > stored;
}

export function isValidUsername(value: string): boolean {
  return value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

export function getPasskeyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError") {
      return "Passkey request was cancelled or timed out. You can try again.";
    }
    if (error.name === "NotSupportedError") {
      return "Your browser or device does not support passkeys.";
    }
    if (error.name === "SecurityError") {
      return "Passkeys are unavailable for this site's security configuration.";
    }
  }
  return error instanceof Error
    ? error.message
    : "Passkey request failed. Please try again.";
}
