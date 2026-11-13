import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ title: z.string().trim().min(1).max(500).optional(), completed: z.boolean().optional() });

export async function PUT(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Invalid subtask" }, { status: 400 });
  const db = getDatabase();
  const id = Number((await context.params).id);
  const result = db.prepare(`UPDATE subtasks SET title = COALESCE(?, title), completed = COALESCE(?, completed)
    WHERE id = ? AND todo_id IN (SELECT id FROM todos WHERE user_id = ?)`)
    .run(parsed.data.title ?? null, parsed.data.completed === undefined ? null : Number(parsed.data.completed), id, session.userId);
  if (!result.changes) return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
  return NextResponse.json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id));
}

export async function DELETE(_request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const result = getDatabase().prepare("DELETE FROM subtasks WHERE id = ? AND todo_id IN (SELECT id FROM todos WHERE user_id = ?)")
    .run(Number((await context.params).id), session.userId);
  return result.changes ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Subtask not found" }, { status: 404 });
}
