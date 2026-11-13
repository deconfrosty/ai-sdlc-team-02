import { redirect } from "next/navigation";
import Link from "next/link";
import AccountControls from "@/app/account-controls";
import TodoList from "@/app/todo-list";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
        AI SDLC Team 02
      </p>
      <h1 className="text-4xl font-bold tracking-tight">
        Welcome, {session.username}
      </h1>
      <AccountControls username={session.username} />
      <Link className="text-blue-700" href="/calendar">Calendar</Link>
      <TodoList />
    </main>
  );
}
