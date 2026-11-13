"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getPasskeyErrorMessage } from "@/lib/auth-utils";

interface RegistrationOptions {
  options: Parameters<typeof startRegistration>[0]["optionsJSON"];
  challengeId: string;
}

export default function AccountControls({ username }: { username: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function addPasskey() {
    setBusy(true);
    setMessage("");
    try {
      const optionsResponse = await fetch("/api/auth/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const optionsResult = (await optionsResponse.json()) as
        | RegistrationOptions
        | { error?: string };
      if (!optionsResponse.ok || !("options" in optionsResult)) {
        throw new Error(
          "error" in optionsResult
            ? optionsResult.error
            : "Could not start passkey registration.",
        );
      }

      const response = await startRegistration({
        optionsJSON: optionsResult.options,
      });
      const verifyResponse = await fetch("/api/auth/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          challengeId: optionsResult.challengeId,
          response,
        }),
      });
      const verifyResult = (await verifyResponse.json()) as { error?: string };
      if (!verifyResponse.ok) {
        throw new Error(verifyResult.error ?? "Could not verify the new passkey.");
      }
      setMessage("Passkey added to your account.");
    } catch (cause) {
      setMessage(getPasskeyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Could not sign out. Please try again.");
      }
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3">
      <button
        className="rounded-md border border-zinc-300 px-4 py-2 font-semibold disabled:opacity-50"
        disabled={busy}
        onClick={() => void addPasskey()}
        type="button"
      >
        Add another passkey
      </button>
      <button
        className="rounded-md bg-zinc-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
        disabled={busy}
        onClick={() => void logout()}
        type="button"
      >
        Sign out
      </button>
      {message ? (
        <p aria-live="polite" className="w-full text-sm text-zinc-600" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
