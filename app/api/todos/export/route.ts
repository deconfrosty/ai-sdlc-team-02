import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listTodos } from "@/lib/todos";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return NextResponse.json({ error: "Invalid export format" }, { status: 400 });
  const todos = listTodos(session.userId);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const headers = { "Content-Disposition": `attachment; filename="todos-${date}.${format}"` };
  if (format === "csv") {
    const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["ID", "Title", "Completed", "Due Date", "Priority", "Recurring", "Pattern", "Reminder"],
      ...todos.map((todo) => [todo.id, todo.title, todo.completed, todo.due_date, todo.priority, todo.is_recurring, todo.recurrence_pattern, todo.reminder_minutes])];
    return new Response(rows.map((row) => row.map(csv).join(",")).join("\r\n"), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  return NextResponse.json({
    version: 1,
    exported_at: new Date().toISOString(),
    todos: todos.map((todo) => ({
      title: todo.title, completed: todo.completed, due_date: todo.due_date, priority: todo.priority,
      is_recurring: todo.is_recurring, recurrence_pattern: todo.recurrence_pattern, reminder_minutes: todo.reminder_minutes,
      subtasks: (todo.subtasks ?? []).map(({ title, completed, position }) => ({ title, completed: Boolean(completed), position })),
      tags: (todo.tags ?? []).map(({ name, color }) => ({ name, color })),
    })),
  }, { headers });
}
