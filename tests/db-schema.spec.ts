import { expect, test } from "@playwright/test";

test("initializes the shared schema with foreign-key cascades", async () => {
  process.env.DATABASE_PATH = ":memory:";
  const { closeDatabase, getDatabase } = await import("../lib/db");
  const database = getDatabase();

  try {
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[];
    expect(tables).toHaveLength(8);
    expect(database.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);

    const userId = Number(
      database.prepare("INSERT INTO users (username) VALUES (?)").run("test-user")
        .lastInsertRowid,
    );
    const todoId = Number(
      database
        .prepare("INSERT INTO todos (user_id, title) VALUES (?, ?)")
        .run(userId, "Test cascade").lastInsertRowid,
    );
    const tagId = Number(
      database
        .prepare("INSERT INTO tags (user_id, name) VALUES (?, ?)")
        .run(userId, "test-tag").lastInsertRowid,
    );
    database
      .prepare("INSERT INTO subtasks (todo_id, title) VALUES (?, ?)")
      .run(todoId, "Child");
    database
      .prepare("INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)")
      .run(todoId, tagId);

    database.prepare("DELETE FROM todos WHERE id = ?").run(todoId);

    expect(
      database.prepare("SELECT COUNT(*) AS count FROM subtasks").get(),
    ).toEqual({ count: 0 });
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM todo_tags").get(),
    ).toEqual({ count: 0 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM tags").get()).toEqual({
      count: 1,
    });
  } finally {
    closeDatabase();
  }
});
