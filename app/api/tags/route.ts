import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const schema = z.object({ name: z.string().trim().min(1).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3B82F6") });

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(getDatabase().prepare("SELECT * FROM tags WHERE user_id = ? ORDER BY name").all(session.userId));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const db = getDatabase();
  const result = db.prepare("INSERT INTO tags (user_id,name,color) VALUES (?,?,?) ON CONFLICT(user_id,name) DO NOTHING")
    .run(session.userId, parsed.data.name, parsed.data.color);
  if (!result.changes) return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
  return NextResponse.json(db.prepare("SELECT * FROM tags WHERE id = ?").get(result.lastInsertRowid), { status: 201 });
}
