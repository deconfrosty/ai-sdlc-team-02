"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getPasskeyErrorMessage } from "@/lib/auth-utils";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface OptionsResponse {
  options: Parameters<typeof startRegistration>[0]["optionsJSON"];
  challengeId: string;
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    return {
      error:
        typeof result === "object" && result !== null && "error" in result
          ? result.error
          : "The request could not be completed.",
    };
  }
  return { data: result as T };
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function register() {
    setBusy(true);
    setError("");

    try {
      const optionsResult = await postJson<OptionsResponse>(
        "/api/auth/register-options",
        { username },
      );
      if (!optionsResult.data) {
        setError(optionsResult.error ?? "Could not start passkey registration.");
        return;
      }
      const response = await startRegistration({
        optionsJSON: optionsResult.data.options,
      });
      const verifyResult = await postJson<{ success: true }>(
        "/api/auth/register-verify",
        {
          username: username.trim(),
          challengeId: optionsResult.data.challengeId,
          response,
        },
      );
      if (!verifyResult.data) {
        setError(verifyResult.error ?? "Could not verify the new passkey.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(getPasskeyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const optionsResult = await postJson<OptionsResponse>(
        "/api/auth/login-options",
        { username },
      );
      if (!optionsResult.data) {
        setError(optionsResult.error ?? "Could not start passkey sign-in.");
        return;
      }
      const response = await startAuthentication({
        optionsJSON: optionsResult.data.options,
      });
      const verifyResult = await postJson<{ success: true }>(
        "/api/auth/login-verify",
        {
          username: username.trim(),
          challengeId: optionsResult.data.challengeId,
          response,
        },
      );
      if (!verifyResult.data) {
        setError(verifyResult.error ?? "Could not verify the passkey.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(getPasskeyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          AI SDLC Team 02
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Sign in with a passkey</h1>
        <p className="text-zinc-600">
          Use a passkey stored on this device or a synced passkey from your
          password manager.
        </p>
      </header>

      <form className="space-y-4" onSubmit={(event) => void login(event)}>
        <label className="block space-y-2 text-sm font-medium" htmlFor="username">
          Username
          <input
            autoComplete="username webauthn"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base"
            id="username"
            maxLength={64}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </label>

        {error ? (
          <p aria-live="polite" className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            Sign in
          </button>
          <button
            className="rounded-md border border-zinc-300 px-4 py-2 font-semibold disabled:opacity-50"
            disabled={busy}
            onClick={() => void register()}
            type="button"
          >
            Create account with passkey
          </button>
        </div>
      </form>
    </main>
  );
}
