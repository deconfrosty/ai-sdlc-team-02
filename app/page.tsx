import { redirect } from "next/navigation";
import AccountControls from "@/app/account-controls";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
        AI SDLC Team 02
      </p>
      <h1 className="text-4xl font-bold tracking-tight">
        Welcome, {session.username}
      </h1>
      <p className="max-w-xl text-lg text-zinc-600">
        Your account is protected with passkey authentication.
      </p>
      <AccountControls username={session.username} />
    </main>
  );
}
