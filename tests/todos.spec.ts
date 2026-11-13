import { expect, test } from "@playwright/test";
import { createTodo, getTodo, listTodos, nextDueDate, todoInput, updateTodo } from "../lib/todos";
import { closeDatabase, getDatabase } from "../lib/db";

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
  } finally {
    closeDatabase();
  }
});
