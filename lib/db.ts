import Database from "better-sqlite3";
import path from "node:path";
import { singaporeHolidays } from "@/lib/holidays";

export type Priority = "high" | "medium" | "low";
export type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: Buffer;
  counter: number;
  created_at: string;
}

export interface AuthChallenge {
  id: string;
  username: string;
  kind: "registration" | "authentication";
  challenge: string;
  user_id: number | null;
  expires_at: number;
}

export interface Session {
  userId: number;
  username: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: ReminderMinutes | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  subtasks?: Subtask[];
  tags?: Tag[];
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: ReminderMinutes | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    credential_public_key BLOB NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_authenticators_user_id
    ON authenticators(user_id);

  CREATE TABLE IF NOT EXISTS auth_challenges (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('registration', 'authentication')),
    challenge TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at
    ON auth_challenges(expires_at);

  CREATE TABLE IF NOT EXISTS revoked_auth_sessions (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_revoked_auth_sessions_expires_at
    ON revoked_auth_sessions(expires_at);

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium'
      CHECK (priority IN ('high', 'medium', 'low')),
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT
      CHECK (recurrence_pattern IS NULL OR recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
    reminder_minutes INTEGER
      CHECK (reminder_minutes IS NULL OR reminder_minutes IN (15, 30, 60, 120, 1440, 2880, 10080)),
    last_notification_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    title_template TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium'
      CHECK (priority IN ('high', 'medium', 'low')),
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT
      CHECK (recurrence_pattern IS NULL OR recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
    reminder_minutes INTEGER
      CHECK (reminder_minutes IS NULL OR reminder_minutes IN (15, 30, 60, 120, 1440, 2880, 10080)),
    due_date_offset_minutes INTEGER,
    subtasks_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

let database: Database.Database | undefined;

export function getDatabase(): Database.Database {
  if (!database) {
    const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "todos.db");
    database = new Database(databasePath);
    database.pragma("foreign_keys = ON");
    database.exec(schema);
    const insertHoliday = database.prepare("INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)");
    database.transaction(() => {
      for (const [date, name] of singaporeHolidays) insertHoliday.run(date, name);
    })();
  }
  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = undefined;
}

export const userDB = {
  findByUsername(username: string): User | undefined {
    return getDatabase()
      .prepare("SELECT id, username, created_at FROM users WHERE username = ?")
      .get(username) as User | undefined;
  },

  findById(id: number): User | undefined {
    return getDatabase()
      .prepare("SELECT id, username, created_at FROM users WHERE id = ?")
      .get(id) as User | undefined;
  },

  createWithAuthenticator(
    username: string,
    credential: Omit<Authenticator, "id" | "user_id" | "created_at">,
  ): User | undefined {
    return getDatabase().transaction(() => {
      const insertUser = getDatabase()
        .prepare("INSERT INTO users (username) VALUES (?) ON CONFLICT(username) DO NOTHING")
        .run(username);
      if (insertUser.changes !== 1) {
        return undefined;
      }

      const user = userDB.findById(Number(insertUser.lastInsertRowid));
      if (!user) {
        throw new Error("Created user could not be loaded");
      }
      if (!authenticatorDB.create(user.id, credential)) {
        getDatabase()
          .prepare("DELETE FROM users WHERE id = ?")
          .run(user.id);
        return undefined;
      }
      return user;
    })();
  },
};

export const authenticatorDB = {
  findByCredentialId(credentialId: string): Authenticator | undefined {
    return getDatabase()
      .prepare("SELECT * FROM authenticators WHERE credential_id = ?")
      .get(credentialId) as Authenticator | undefined;
  },

  findAllByUserId(userId: number): Authenticator[] {
    return getDatabase()
      .prepare(
        "SELECT * FROM authenticators WHERE user_id = ? ORDER BY id ASC",
      )
      .all(userId) as Authenticator[];
  },

  create(
    userId: number,
    credential: Omit<Authenticator, "id" | "user_id" | "created_at">,
  ): boolean {
    const result = getDatabase()
      .prepare(
        `INSERT INTO authenticators
          (user_id, credential_id, credential_public_key, counter)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(credential_id) DO NOTHING`,
      )
      .run(
        userId,
        credential.credential_id,
        credential.credential_public_key,
        credential.counter ?? 0,
      );
    return result.changes === 1;
  },

  updateCounter(id: number, previousCounter: number, nextCounter: number): boolean {
    const result = getDatabase()
      .prepare(
        "UPDATE authenticators SET counter = ? WHERE id = ? AND counter = ?",
      )
      .run(nextCounter ?? 0, id, previousCounter ?? 0);
    return result.changes === 1;
  },
};

export const authChallengeDB = {
  save(
    challenge: Omit<AuthChallenge, "expires_at">,
    expiresAt: number,
  ): void {
    const database = getDatabase();
    database.transaction(() => {
      database
        .prepare("DELETE FROM auth_challenges WHERE expires_at <= ?")
        .run(Date.now());
      database
        .prepare(
          `INSERT INTO auth_challenges
            (id, username, kind, challenge, user_id, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          challenge.id,
          challenge.username,
          challenge.kind,
          challenge.challenge,
          challenge.user_id,
          expiresAt,
        );
    })();
  },

  consume(
    id: string,
    kind: AuthChallenge["kind"],
  ): AuthChallenge | undefined {
    const database = getDatabase();
    return database.transaction(() => {
      const row = database
        .prepare(
          `SELECT id, username, kind, challenge, user_id, expires_at
           FROM auth_challenges
           WHERE id = ? AND kind = ?`,
        )
        .get(id, kind) as AuthChallenge | undefined;

      if (!row) {
        return undefined;
      }

      database.prepare("DELETE FROM auth_challenges WHERE id = ?").run(id);
      return row.expires_at > Date.now() ? row : undefined;
    })();
  },
};

export const authSessionDB = {
  isRevoked(id: string): boolean {
    return Boolean(
      getDatabase()
        .prepare("SELECT 1 FROM revoked_auth_sessions WHERE id = ?")
        .get(id),
    );
  },

  revoke(id: string, expiresAt: number): void {
    const database = getDatabase();
    database.transaction(() => {
      database
        .prepare("DELETE FROM revoked_auth_sessions WHERE expires_at <= ?")
        .run(Math.floor(Date.now() / 1000));
      database
        .prepare(
          "INSERT OR IGNORE INTO revoked_auth_sessions (id, expires_at) VALUES (?, ?)",
        )
        .run(id, expiresAt);
    })();
  },
};
