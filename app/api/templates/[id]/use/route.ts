import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase, type Template } from "@/lib/db";
import { createTodo } from "@/lib/todos";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const db = getDatabase();
  const template = db.prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?")
    .get(Number((await context.params).id), session.userId) as Template | undefined;
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  const subtasks = z.array(z.object({ title: z.string(), position: z.number().int() }))
    .parse(JSON.parse(template.subtasks_json ?? "[]"));
  const todo = db.transaction(() => {
    const created = createTodo(session.userId, {
      title: template.title_template,
      priority: template.priority,
      is_recurring: Boolean(template.is_recurring),
      recurrence_pattern: template.recurrence_pattern,
      reminder_minutes: template.reminder_minutes,
      due_date: template.due_date_offset_minutes === null ? null : new Date(Date.now() + template.due_date_offset_minutes * 60000).toISOString(),
    });
    const insert = db.prepare("INSERT INTO subtasks (todo_id,title,position) VALUES (?,?,?)");
    for (const subtask of subtasks) insert.run(created.id, subtask.title, subtask.position);
    return created;
  })();
  return NextResponse.json(todo, { status: 201 });
}
