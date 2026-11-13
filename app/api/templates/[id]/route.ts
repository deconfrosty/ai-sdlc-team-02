import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid template" }, { status: 400 });
  const db = getDatabase();
  const id = Number((await context.params).id);
  const result = db.prepare("UPDATE templates SET name = ? WHERE id = ? AND user_id = ?").run(parsed.data.name, id, session.userId);
  return result.changes ? NextResponse.json(db.prepare("SELECT * FROM templates WHERE id = ?").get(id)) : NextResponse.json({ error: "Template not found" }, { status: 404 });
}

export async function DELETE(_request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const result = getDatabase().prepare("DELETE FROM templates WHERE id = ? AND user_id = ?").run(Number((await context.params).id), session.userId);
  return result.changes ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Template not found" }, { status: 404 });
}
