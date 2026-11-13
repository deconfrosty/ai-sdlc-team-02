import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getTodo } from "@/lib/todos";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(getDatabase().prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY name").all(session.userId));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = z.object({ name: z.string().trim().min(1).max(100), todoId: z.number().int().positive() })
    .safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid template" }, { status: 400 });
  const todo = getTodo(session.userId, parsed.data.todoId);
  if (!todo) return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  const db = getDatabase();
  const result = db.prepare(`INSERT INTO templates
    (user_id,name,title_template,priority,is_recurring,recurrence_pattern,reminder_minutes,due_date_offset_minutes,subtasks_json)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(session.userId, parsed.data.name, todo.title, todo.priority, Number(todo.is_recurring),
      todo.recurrence_pattern, todo.reminder_minutes,
      todo.due_date ? Math.max(1, Math.ceil((Date.parse(todo.due_date) - Date.now()) / 60000)) : null,
      JSON.stringify((todo.subtasks ?? []).map(({ title, position }) => ({ title, position }))));
  return NextResponse.json(db.prepare("SELECT * FROM templates WHERE id = ?").get(result.lastInsertRowid), { status: 201 });
}
