import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };
async function change(request: Request, context: Context, add: boolean) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = z.object({ tagId: z.number().int().positive() }).safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const db = getDatabase();
  const id = Number((await context.params).id);
  if (!db.prepare("SELECT 1 FROM todos WHERE id = ? AND user_id = ?").get(id, session.userId) ||
      !db.prepare("SELECT 1 FROM tags WHERE id = ? AND user_id = ?").get(parsed.data.tagId, session.userId)) {
    return NextResponse.json({ error: "Todo or tag not found" }, { status: 404 });
  }
  if (add) db.prepare("INSERT OR IGNORE INTO todo_tags (todo_id,tag_id) VALUES (?,?)").run(id, parsed.data.tagId);
  else db.prepare("DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?").run(id, parsed.data.tagId);
  return NextResponse.json({ success: true });
}
export async function POST(request: Request, context: Context) { return change(request, context, true); }
export async function DELETE(request: Request, context: Context) { return change(request, context, false); }
