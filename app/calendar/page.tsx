import { redirect } from "next/navigation";
import Link from "next/link";
import TodoDashboard from "@/app/todo-dashboard";
import { getSession } from "@/lib/auth";

export default async function CalendarPage() {
  if (!(await getSession())) redirect("/login");
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Todo calendar</p><h1 className="text-3xl font-bold">Calendar</h1></div>
        <Link href="/" className="rounded border px-4 py-2">Back to todos</Link>
      </header>
      <TodoDashboard calendarOnly />
    </main>
  );
}
