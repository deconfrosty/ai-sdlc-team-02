import { expect, test } from "@playwright/test";
import { createTodo, getTodo, listTodos, nextDueDate, todoInput, updateTodo } from "../lib/todos";
import { closeDatabase, getDatabase } from "../lib/db";
import { generateCalendarGrid, parseCalendarMonth, shiftCalendarMonth, singaporeDate } from "../lib/calendar";

test("todo ownership, updates, recurrence and cascades", () => {
  const db = getDatabase();
  try {
    const userId = Number(db.prepare("INSERT INTO users (username) VALUES (?)").run("todo-user").lastInsertRowid);
    const otherId = Number(db.prepare("INSERT INTO users (username) VALUES (?)").run("other-user").lastInsertRowid);
    const input = todoInput.parse({
      title: "Pay bill",
      priority: "high",
      due_date: "2027-01-31T02:00:00.000Z",
      is_recurring: true,
      recurrence_pattern: "monthly",
    });

    const todo = createTodo(userId, input);
    expect(listTodos(userId)).toHaveLength(1);
    expect(getTodo(otherId, todo.id)).toBeUndefined();
    expect(updateTodo(otherId, todo.id, { ...input, completed: true })).toBeUndefined();
    expect(updateTodo(userId, todo.id, { ...input, completed: true })?.completed).toBe(true);
    const next = listTodos(userId).find((item) => item.id !== todo.id);
    expect(next?.due_date).toBe("2027-02-28T02:00:00.000Z");
    db.prepare("DELETE FROM todos WHERE user_id = ? AND id = ?").run(userId, todo.id);
    expect(listTodos(userId)).toHaveLength(1);
    expect(todoInput.safeParse({ title: " ", is_recurring: true }).success).toBe(false);
    expect(nextDueDate("2028-02-29T02:00:00.000Z", "yearly")).toBe("2029-02-28T02:00:00.000Z");
    expect(nextDueDate("2027-02-28T17:00:00.000Z", "monthly")).toBe("2027-03-31T17:00:00.000Z");
    expect(nextDueDate("2028-02-28T17:00:00.000Z", "yearly")).toBe("2029-02-27T17:00:00.000Z");
  } finally {
    closeDatabase();
  }
});

test("calendar months and grid use Singapore calendar dates", () => {
  expect(singaporeDate(new Date("2026-03-31T16:30:00Z"))).toBe("2026-04-01");
  expect(parseCalendarMonth("2026-13", "2026-04")).toBe("2026-04");
  expect(parseCalendarMonth("2026-02", "2026-04")).toBe("2026-02");
  expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
  const days = generateCalendarGrid("2026-02", "2026-02-01");
  expect(days).toHaveLength(28);
  expect(days[0]).toMatchObject({ date: "2026-02-01", isToday: true, isWeekend: true, inMonth: true });
  const march = generateCalendarGrid("2026-03", "2026-03-15");
  expect(march).toHaveLength(35);
  expect(march.at(-1)).toMatchObject({ date: "2026-04-04", inMonth: false });
});

test("calendar seeds Singapore holiday dates", () => {
  const db = getDatabase();
  try {
    expect(db.prepare("SELECT name FROM holidays WHERE date = ?").get("2026-06-01")).toEqual({ name: "Vesak Day (observed)" });
    expect(db.prepare("SELECT name FROM holidays WHERE date = ?").get("2027-02-08")).toEqual({ name: "Chinese New Year (observed)" });
  } finally {
    closeDatabase();
  }
});
