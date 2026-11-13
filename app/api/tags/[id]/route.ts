import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = z.object({ name: z.string().trim().min(1).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const db = getDatabase();
  const id = Number((await context.params).id);
  const duplicate = db.prepare("SELECT 1 FROM tags WHERE user_id = ? AND name = ? AND id != ?").get(session.userId, parsed.data.name, id);
  if (duplicate) return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
  const result = db.prepare("UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?").run(parsed.data.name, parsed.data.color, id, session.userId);
  return result.changes ? NextResponse.json(db.prepare("SELECT * FROM tags WHERE id = ?").get(id)) : NextResponse.json({ error: "Tag not found" }, { status: 404 });
}

export async function DELETE(_request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const result = getDatabase().prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(Number((await context.params).id), session.userId);
  return result.changes ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Tag not found" }, { status: 404 });
}
