import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  getDatabase,
  type Priority,
  type RecurrencePattern,
  type ReminderMinutes,
  userDB,
} from "@/lib/db";

const prioritySchema = z.enum(["high", "medium", "low"]);
const recurrenceSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);
const reminderSchema = z.union([
  z.literal(15), z.literal(30), z.literal(60), z.literal(120),
  z.literal(1440), z.literal(2880), z.literal(10080),
]);

const requestSchema = z.object({
  action: z.enum([
    "create", "update", "delete", "subtask", "tag", "assign-tags",
    "save-template", "use-template", "import", "mark-notified",
  ]),
  todoId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
  priority: prioritySchema.optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: recurrenceSchema.nullable().optional(),
  reminderMinutes: reminderSchema.nullable().optional(),
  tagIds: z.array(z.number().int().positive()).max(50).optional(),
  subtaskId: z.number().int().positive().optional(),
  subtaskAction: z.enum(["create", "update", "delete"]).optional(),
  templateName: z.string().trim().min(1).max(100).optional(),
  templateId: z.number().int().positive().optional(),
  payload: z.unknown().optional(),
});

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function nextDueDate(value: string | null, pattern: RecurrencePattern): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Invalid due date");
  if (pattern === "daily") date.setUTCDate(date.getUTCDate() + 1);
  if (pattern === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (pattern === "monthly") {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  if (pattern === "yearly") {
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    date.setUTCMonth(month);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString();
}

export async function GET() {
  const session = await getSession();
  if (!session || !userDB.findById(session.userId)) return fail("Unauthorized", 401);

  const db = getDatabase();
  const todos = db.prepare(
    `SELECT id, title, completed, due_date, priority, is_recurring,
            recurrence_pattern, reminder_minutes, last_notification_sent,
            created_at, updated_at
     FROM todos WHERE user_id = ?
     ORDER BY completed ASC,
              CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
              due_date IS NULL, due_date ASC, created_at DESC`,
  ).all(session.userId) as Array<Record<string, unknown> & { id: number }>;

  const loadSubtasks = db.prepare(
    "SELECT id, title, completed, position FROM subtasks WHERE todo_id = ? ORDER BY position, id",
  );
  const loadTags = db.prepare(
    `SELECT tags.id, tags.name, tags.color FROM tags
     JOIN todo_tags ON todo_tags.tag_id = tags.id
     WHERE todo_tags.todo_id = ? AND tags.user_id = ? ORDER BY tags.name`,
  );
  const result = todos.map((todo) => ({
    ...todo,
    completed: Boolean(todo.completed),
    is_recurring: Boolean(todo.is_recurring),
    subtasks: loadSubtasks.all(todo.id).map((row) => {
      const item = row as { completed: number };
      return { ...item, completed: Boolean(item.completed) };
    }),
    tags: loadTags.all(todo.id, session.userId),
  }));
  const tags = db.prepare("SELECT id, name, color FROM tags WHERE user_id = ? ORDER BY name").all(session.userId);
  const templates = db.prepare(
    `SELECT id, name, description, category, title_template, priority,
            is_recurring, recurrence_pattern, reminder_minutes, subtasks_json
     FROM templates WHERE user_id = ? ORDER BY name`,
  ).all(session.userId);
  const holidays = db.prepare("SELECT date, name FROM holidays ORDER BY date").all();
  return NextResponse.json({ todos: result, tags, templates, holidays });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !userDB.findById(session.userId)) return fail("Unauthorized", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("Invalid JSON");
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid request");
  const input = parsed.data;
  const db = getDatabase();
  const todoById = (id: number) => db.prepare(
    "SELECT * FROM todos WHERE id = ? AND user_id = ?",
  ).get(id, session.userId) as (Record<string, unknown> & {
    id: number;
    title: string;
    due_date: string | null;
    priority: Priority;
    is_recurring: number;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: ReminderMinutes | null;
  }) | undefined;

  try {
    if (input.action === "create") {
      if (!input.title) return fail("A title is required");
      if (input.dueDate && Number.isNaN(new Date(input.dueDate).getTime())) return fail("Invalid due date");
      if (input.isRecurring && !input.recurrencePattern) return fail("Choose a recurrence pattern");
      const id = db.transaction(() => {
        const inserted = db.prepare(
          `INSERT INTO todos
           (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          session.userId, input.title, input.dueDate ? new Date(input.dueDate).toISOString() : null,
          input.priority ?? "medium", input.isRecurring ? 1 : 0,
          input.isRecurring ? input.recurrencePattern ?? null : null, input.reminderMinutes ?? null,
        );
        const todoId = Number(inserted.lastInsertRowid);
        for (const tagId of input.tagIds ?? []) {
          db.prepare("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) SELECT ?, id FROM tags WHERE id = ? AND user_id = ?")
            .run(todoId, tagId, session.userId);
        }
        return todoId;
      })();
      return NextResponse.json({ id }, { status: 201 });
    }

    if (input.action === "update") {
      if (!input.todoId || !todoById(input.todoId)) return fail("Todo not found", 404);
      if (input.title !== undefined && !input.title) return fail("A title is required");
      if (input.dueDate && Number.isNaN(new Date(input.dueDate).getTime())) return fail("Invalid due date");
      const current = todoById(input.todoId)!;
      const fields: string[] = [];
      const values: Array<string | number | null> = [];
      if (input.title !== undefined) { fields.push("title = ?"); values.push(input.title); }
      if (input.dueDate !== undefined) { fields.push("due_date = ?"); values.push(input.dueDate ? new Date(input.dueDate).toISOString() : null); }
      if (input.priority !== undefined) { fields.push("priority = ?"); values.push(input.priority); }
      if (input.completed !== undefined) { fields.push("completed = ?"); values.push(input.completed ? 1 : 0); }
      if (input.isRecurring !== undefined) { fields.push("is_recurring = ?"); values.push(input.isRecurring ? 1 : 0); }
      if (input.recurrencePattern !== undefined) { fields.push("recurrence_pattern = ?"); values.push(input.recurrencePattern); }
      if (input.reminderMinutes !== undefined) { fields.push("reminder_minutes = ?"); values.push(input.reminderMinutes); }
      if (input.isRecurring && input.recurrencePattern === undefined && !current.recurrence_pattern) return fail("Choose a recurrence pattern");
      if (fields.length) {
        db.transaction(() => {
          fields.push("updated_at = datetime('now')");
          db.prepare(`UPDATE todos SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`)
            .run(...values, input.todoId, session.userId);
          if (input.completed && !Boolean(current.completed) && current.is_recurring && current.recurrence_pattern) {
            const nextDate = nextDueDate(current.due_date, current.recurrence_pattern);
            const next = db.prepare(
              `INSERT INTO todos (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes)
               VALUES (?, ?, ?, ?, 1, ?, ?)`,
            ).run(session.userId, current.title, nextDate, current.priority, current.recurrence_pattern, current.reminder_minutes);
            const previousTags = db.prepare("SELECT tag_id FROM todo_tags WHERE todo_id = ?").all(input.todoId) as Array<{ tag_id: number }>;
            const copyTag = db.prepare("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)");
            for (const tag of previousTags) copyTag.run(Number(next.lastInsertRowid), tag.tag_id);
            const subtasks = db.prepare("SELECT title, position FROM subtasks WHERE todo_id = ?").all(input.todoId) as Array<{ title: string; position: number }>;
            const copySubtask = db.prepare("INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)");
            for (const subtask of subtasks) copySubtask.run(Number(next.lastInsertRowid), subtask.title, subtask.position);
          }
        })();
      }
      if (input.tagIds !== undefined) {
        db.transaction(() => {
          db.prepare("DELETE FROM todo_tags WHERE todo_id = ?").run(input.todoId);
          const add = db.prepare("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) SELECT ?, id FROM tags WHERE id = ? AND user_id = ?");
          for (const id of input.tagIds!) add.run(input.todoId, id, session.userId);
        })();
      }
      return NextResponse.json({ ok: true });
    }

    if (input.action === "delete") {
      if (!input.todoId) return fail("Todo id is required");
      const result = db.prepare("DELETE FROM todos WHERE id = ? AND user_id = ?").run(input.todoId, session.userId);
      return result.changes ? NextResponse.json({ ok: true }) : fail("Todo not found", 404);
    }

    if (input.action === "subtask") {
      if (!input.todoId || !todoById(input.todoId)) return fail("Todo not found", 404);
      if (input.subtaskAction === "create") {
        if (!input.title) return fail("A title is required");
        const position = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM subtasks WHERE todo_id = ?").get(input.todoId) as { position: number }).position;
        const result = db.prepare("INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)").run(input.todoId, input.title, position);
        return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
      }
      if (!input.subtaskId) return fail("Subtask id is required");
      if (input.subtaskAction === "delete") {
        db.prepare("DELETE FROM subtasks WHERE id = ? AND todo_id = ?").run(input.subtaskId, input.todoId);
      } else {
        if (!input.title) return fail("A title is required");
        db.prepare("UPDATE subtasks SET title = ?, completed = COALESCE(?, completed) WHERE id = ? AND todo_id = ?")
          .run(input.title, input.completed === undefined ? null : input.completed ? 1 : 0, input.subtaskId, input.todoId);
      }
      return NextResponse.json({ ok: true });
    }

    if (input.action === "tag") {
      if (input.title) {
        const color = typeof input.payload === "string" && /^#[0-9a-fA-F]{6}$/.test(input.payload) ? input.payload : "#3B82F6";
        const result = db.prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?) ON CONFLICT(user_id, name) DO NOTHING").run(session.userId, input.title, color);
        if (!result.changes) return fail("Tag name already exists", 409);
        return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
      }
      if (!input.todoId) return fail("Tag id is required");
      db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(input.todoId, session.userId);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "save-template") {
      if (!input.todoId || !input.templateName) return fail("Todo and template name are required");
      const todo = todoById(input.todoId);
      if (!todo) return fail("Todo not found", 404);
      const subtasks = db.prepare("SELECT title FROM subtasks WHERE todo_id = ? ORDER BY position").all(input.todoId);
      const result = db.prepare(
        `INSERT INTO templates (user_id, name, title_template, priority, is_recurring, recurrence_pattern, reminder_minutes, subtasks_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(session.userId, input.templateName, todo.title, todo.priority, todo.is_recurring, todo.recurrence_pattern, todo.reminder_minutes, JSON.stringify(subtasks));
      return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
    }

    if (input.action === "use-template") {
      if (!input.templateId) return fail("Template id is required");
      const template = db.prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?").get(input.templateId, session.userId) as {
        title_template: string; priority: Priority; is_recurring: number;
        recurrence_pattern: RecurrencePattern | null; reminder_minutes: ReminderMinutes | null;
        subtasks_json: string | null;
      } | undefined;
      if (!template) return fail("Template not found", 404);
      const result = db.transaction(() => {
        const inserted = db.prepare(
          `INSERT INTO todos (user_id, title, priority, is_recurring, recurrence_pattern, reminder_minutes)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(session.userId, template.title_template, template.priority, template.is_recurring, template.recurrence_pattern, template.reminder_minutes);
        const id = Number(inserted.lastInsertRowid);
        const subtasks = template.subtasks_json ? JSON.parse(template.subtasks_json) as Array<{ title: string }> : [];
        const add = db.prepare("INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)");
        subtasks.forEach((item, index) => add.run(id, item.title, index));
        return id;
      })();
      return NextResponse.json({ id: result }, { status: 201 });
    }

    if (input.action === "mark-notified") {
      if (!input.todoId || !todoById(input.todoId)) return fail("Todo not found", 404);
      db.prepare("UPDATE todos SET last_notification_sent = datetime('now') WHERE id = ? AND user_id = ?").run(input.todoId, session.userId);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "import") {
      const items = z.array(z.object({
        title: z.string().trim().min(1).max(200),
        completed: z.boolean().optional(),
        due_date: z.string().nullable().optional(),
        priority: prioritySchema.optional(),
        is_recurring: z.boolean().optional(),
        recurrence_pattern: recurrenceSchema.nullable().optional(),
        reminder_minutes: reminderSchema.nullable().optional(),
        subtasks: z.array(z.object({ title: z.string().trim().min(1).max(200), completed: z.boolean().optional() })).max(100).optional(),
        tags: z.array(z.object({ name: z.string().trim().min(1).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).max(50).optional(),
      })).max(500).safeParse((input.payload as { todos?: unknown } | undefined)?.todos);
      if (!items.success) return fail("Import file contains invalid todos");
      db.transaction(() => {
        for (const item of items.data) {
          const inserted = db.prepare(
            `INSERT INTO todos (user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(session.userId, item.title, item.completed ? 1 : 0, item.due_date ?? null, item.priority ?? "medium", item.is_recurring ? 1 : 0, item.recurrence_pattern ?? null, item.reminder_minutes ?? null);
          const id = Number(inserted.lastInsertRowid);
          for (const subtask of item.subtasks ?? []) {
            db.prepare("INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, ?, ?)").run(id, subtask.title, subtask.completed ? 1 : 0, 0);
          }
          for (const tag of item.tags ?? []) {
            db.prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?) ON CONFLICT(user_id, name) DO NOTHING").run(session.userId, tag.name, tag.color ?? "#3B82F6");
            const saved = db.prepare("SELECT id FROM tags WHERE user_id = ? AND name = ?").get(session.userId, tag.name) as { id: number };
            db.prepare("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)").run(id, saved.id);
          }
        }
      })();
      return NextResponse.json({ imported: items.data.length });
    }
    return fail("Unsupported action");
  } catch (error) {
    console.error("Todo request failed", error);
    return fail("The request could not be completed", 500);
  }
}
