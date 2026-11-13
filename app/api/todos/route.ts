import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createTodo, listTodos, todoInput } from "@/lib/todos";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(listTodos(session.userId));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = todoInput.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid todo" }, { status: 400 });
  if (parsed.data.due_date && Date.parse(parsed.data.due_date) < Date.now() + 60_000) {
    return NextResponse.json({ error: "Due date must be at least one minute in the future" }, { status: 400 });
  }
  return NextResponse.json(createTodo(session.userId, parsed.data), { status: 201 });
}
