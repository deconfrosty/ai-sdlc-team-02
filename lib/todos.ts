import { z } from "zod";
import { getDatabase, type Todo } from "@/lib/db";

export const todoInput = z.object({
  title: z.string().trim().min(1).max(500),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable().optional(),
  reminder_minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(1440), z.literal(2880), z.literal(10080)]).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.is_recurring && (!value.due_date || !value.recurrence_pattern)) {
    ctx.addIssue({ code: "custom", message: "Recurring todos require a due date and pattern" });
  }
  if (value.reminder_minutes && !value.due_date) {
    ctx.addIssue({ code: "custom", message: "Reminders require a due date" });
  }
});

export type TodoInput = z.infer<typeof todoInput>;
type TodoRow = Omit<Todo, "completed" | "is_recurring"> & {
  completed: number;
  is_recurring: number;
};

function mapTodo(row: TodoRow): Todo {
  const db = getDatabase();
  return {
    ...row,
    completed: Boolean(row.completed),
    is_recurring: Boolean(row.is_recurring),
    subtasks: db.prepare("SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position, id").all(row.id) as Todo["subtasks"],
    tags: db.prepare("SELECT tags.* FROM tags JOIN todo_tags ON tags.id = todo_tags.tag_id WHERE todo_tags.todo_id = ? ORDER BY tags.name").all(row.id) as Todo["tags"],
  };
}

export function listTodos(userId: number): Todo[] {
  const rows = getDatabase().prepare(
    `SELECT * FROM todos WHERE user_id = ?
     ORDER BY completed, CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
     due_date IS NULL, due_date, created_at DESC, id DESC`,
  ).all(userId) as TodoRow[];
  return rows.map(mapTodo);
}

export function getTodo(userId: number, id: number): Todo | undefined {
  const row = getDatabase().prepare("SELECT * FROM todos WHERE user_id = ? AND id = ?").get(userId, id) as TodoRow | undefined;
  return row ? mapTodo(row) : undefined;
}

export function createTodo(userId: number, input: TodoInput): Todo {
  const db = getDatabase();
  const result = db.prepare(
    `INSERT INTO todos (user_id,title,priority,due_date,is_recurring,recurrence_pattern,reminder_minutes)
     VALUES (?,?,?,?,?,?,?)`,
  ).run(userId, input.title, input.priority, input.due_date ?? null, Number(input.is_recurring),
    input.is_recurring ? input.recurrence_pattern ?? null : null, input.reminder_minutes ?? null);
  const todo = getTodo(userId, Number(result.lastInsertRowid));
  if (!todo) throw new Error("Created todo could not be loaded");
  return todo;
}

export function nextDueDate(value: string, pattern: NonNullable<Todo["recurrence_pattern"]>): string {
  const singaporeOffset = 8 * 60 * 60 * 1000;
  const date = new Date(Date.parse(value) + singaporeOffset);
  if (pattern === "daily" || pattern === "weekly") {
    date.setUTCDate(date.getUTCDate() + (pattern === "daily" ? 1 : 7));
  } else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    if (pattern === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCFullYear(date.getUTCFullYear() + 1);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return new Date(date.getTime() - singaporeOffset).toISOString();
}

export function updateTodo(userId: number, id: number, input: TodoInput & { completed: boolean }): Todo | undefined {
  const db = getDatabase();
  return db.transaction(() => {
    const existing = getTodo(userId, id);
    if (!existing) return undefined;
    db.prepare(`UPDATE todos SET title = ?, priority = ?, due_date = ?, is_recurring = ?,
      recurrence_pattern = ?, reminder_minutes = ?, completed = ?,
      last_notification_sent = CASE WHEN due_date IS NOT ? OR reminder_minutes IS NOT ? THEN NULL ELSE last_notification_sent END,
      updated_at = datetime('now')
      WHERE user_id = ? AND id = ?`).run(
      input.title, input.priority, input.due_date ?? null, Number(input.is_recurring),
      input.is_recurring ? input.recurrence_pattern ?? null : null, input.reminder_minutes ?? null,
      Number(input.completed), input.due_date ?? null, input.reminder_minutes ?? null, userId, id,
    );
    if (input.completed && !existing.completed && input.is_recurring && input.due_date && input.recurrence_pattern) {
      const next = createTodo(userId, { ...input, due_date: nextDueDate(input.due_date, input.recurrence_pattern) });
      db.prepare("INSERT INTO todo_tags (todo_id, tag_id) SELECT ?, tag_id FROM todo_tags WHERE todo_id = ?")
        .run(next.id, id);
    }
    return getTodo(userId, id);
  })();
}
