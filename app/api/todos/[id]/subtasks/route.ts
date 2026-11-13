import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = Number((await context.params).id);
  const parsed = z.object({ title: z.string().trim().min(1).max(500) }).safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subtask" }, { status: 400 });
  const db = getDatabase();
  const exists = db.prepare("SELECT 1 FROM todos WHERE id = ? AND user_id = ?").get(id, session.userId);
  if (!exists) return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  const result = db.prepare("INSERT INTO subtasks (todo_id,title,position) VALUES (?,?,(SELECT COALESCE(MAX(position)+1,0) FROM subtasks WHERE todo_id = ?))")
    .run(id, parsed.data.title, id);
  return NextResponse.json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(result.lastInsertRowid), { status: 201 });
}
