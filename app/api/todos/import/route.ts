import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { createTodo, todoInput } from "@/lib/todos";

const itemSchema = z.object({
  title: z.string().trim().min(1).max(500),
  priority: z.enum(["high", "medium", "low"]),
  completed: z.boolean(),
  due_date: z.string().datetime({ offset: true }).nullable(),
  is_recurring: z.boolean(),
  recurrence_pattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable(),
  reminder_minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(1440), z.literal(2880), z.literal(10080)]).nullable(),
  subtasks: z.array(z.object({ title: z.string().trim().min(1).max(500), completed: z.boolean(), position: z.number().int().nonnegative() })).max(1000),
  tags: z.array(z.object({ name: z.string().trim().min(1).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(1000),
}).superRefine((item, ctx) => {
  if (!todoInput.safeParse(item).success) ctx.addIssue({ code: "custom", message: "Invalid todo configuration" });
});
const envelope = z.object({ version: z.literal(1), todos: z.array(itemSchema).max(10000) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = envelope.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid import file" }, { status: 400 });
  const db = getDatabase();
  db.transaction(() => {
    for (const item of parsed.data.todos) {
      const todo = createTodo(session.userId, item);
      if (item.completed) db.prepare("UPDATE todos SET completed = 1 WHERE id = ? AND user_id = ?").run(todo.id, session.userId);
      for (const subtask of item.subtasks) {
        db.prepare("INSERT INTO subtasks (todo_id,title,completed,position) VALUES (?,?,?,?)")
          .run(todo.id, subtask.title, Number(subtask.completed), subtask.position);
      }
      for (const tag of item.tags) {
        let existing = db.prepare("SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE").get(session.userId, tag.name) as { id: number } | undefined;
        if (!existing) {
          const result = db.prepare("INSERT INTO tags (user_id,name,color) VALUES (?,?,?)").run(session.userId, tag.name, tag.color);
          existing = { id: Number(result.lastInsertRowid) };
        }
        db.prepare("INSERT OR IGNORE INTO todo_tags (todo_id,tag_id) VALUES (?,?)").run(todo.id, existing.id);
      }
    }
  })();
  return NextResponse.json({ imported: parsed.data.todos.length });
}
