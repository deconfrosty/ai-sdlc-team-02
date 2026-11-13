import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const db = getDatabase();
  const now = new Date();
  const current = now.toISOString();
  const due = db.transaction(() => {
    const rows = db.prepare(`SELECT id, title, due_date FROM todos
      WHERE user_id = ? AND completed = 0 AND due_date IS NOT NULL AND reminder_minutes IS NOT NULL
      AND julianday(?) BETWEEN julianday(due_date) - reminder_minutes / 1440.0 AND julianday(due_date)
      AND last_notification_sent IS NULL`).all(session.userId, current) as { id: number; title: string; due_date: string }[];
    const mark = db.prepare("UPDATE todos SET last_notification_sent = ? WHERE id = ? AND user_id = ?");
    for (const row of rows) mark.run(current, row.id, session.userId);
    return rows;
  })();
  return NextResponse.json(due);
}
