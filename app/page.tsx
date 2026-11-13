import { redirect } from "next/navigation";
import AccountControls from "@/app/account-controls";
import TodoDashboard from "@/app/todo-dashboard";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">AI SDLC Team 02</p>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {session.username}</h1>
          <p className="text-zinc-600">Passkey-protected personal todos</p>
        </div>
        <AccountControls username={session.username} />
      </header>
      <TodoDashboard />
    </main>
  );
}
