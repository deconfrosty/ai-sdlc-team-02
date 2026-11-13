import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getTodo, todoInput, updateTodo } from "@/lib/todos";

type Context = { params: Promise<{ id: string }> };
const updateInput = z.object({ completed: z.boolean().optional() });

async function todoId(context: Context): Promise<number> {
  const id = Number((await context.params).id);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export async function GET(_request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const todo = getTodo(session.userId, await todoId(context));
  return todo ? NextResponse.json(todo) : NextResponse.json({ error: "Todo not found" }, { status: 404 });
}

export async function PUT(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = await todoId(context);
  const current = getTodo(session.userId, id);
  if (!current) return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => undefined);
  const completion = updateInput.safeParse(body);
  if (!completion.success || !body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid todo" }, { status: 400 });
  }
  const parsed = todoInput.safeParse({ ...current, ...body });
  if (!parsed.success) return NextResponse.json({ error: "Invalid todo" }, { status: 400 });
  if (parsed.data.due_date && parsed.data.due_date !== current.due_date && Date.parse(parsed.data.due_date) < Date.now() + 60_000) {
    return NextResponse.json({ error: "Due date must be at least one minute in the future" }, { status: 400 });
  }
  return NextResponse.json(updateTodo(session.userId, id, { ...parsed.data, completed: completion.data.completed ?? current.completed }));
}

export async function DELETE(_request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const result = getDatabase().prepare("DELETE FROM todos WHERE user_id = ? AND id = ?").run(session.userId, await todoId(context));
  return result.changes ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Todo not found" }, { status: 404 });
}
