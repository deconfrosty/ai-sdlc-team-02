"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatSingaporeDate } from "@/lib/timezone";

type Priority = "high" | "medium" | "low";
type Pattern = "daily" | "weekly" | "monthly" | "yearly";
type Tag = { id: number; name: string; color: string };
type Subtask = { id: number; title: string; completed: boolean };
type Todo = {
  id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: Pattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  subtasks: Subtask[];
  tags: Tag[];
};
type Template = { id: number; name: string };
type State = { todos: Todo[]; tags: Tag[]; templates: Template[]; holidays: { date: string; name: string }[] };

const blankState: State = { todos: [], tags: [], templates: [], holidays: [] };
const reminderChoices = [
  [15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"], [120, "2 hours"],
  [1440, "1 day"], [2880, "2 days"], [10080, "1 week"],
] as const;

export default function TodoDashboard({ calendarOnly = false }: { calendarOnly?: boolean }) {
  const [data, setData] = useState<State>(blankState);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"list" | "calendar">(calendarOnly ? "calendar" : "list");
  const [month, setMonth] = useState(() => new Date());
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [pattern, setPattern] = useState<Pattern | "">("");
  const [reminder, setReminder] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [newSubtasks, setNewSubtasks] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/todos");
    if (!response.ok) throw new Error("Could not load your todos.");
    setData((await response.json()) as State);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/todos")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your todos.");
        return await response.json() as State;
      })
      .then((result) => { if (active) setData(result); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load todos.");
      });
    return () => { active = false; };
  }, []);

  const send = useCallback(async (body: Record<string, unknown>) => {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The action failed.");
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  async function createTodo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await send({
      action: "create", title, dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      priority, isRecurring: Boolean(pattern), recurrencePattern: pattern || null,
      reminderMinutes: reminder ? Number(reminder) : null, tagIds: selectedTags,
    });
    if (ok) {
      setTitle(""); setDueDate(""); setPriority("medium"); setPattern(""); setReminder(""); setSelectedTags([]);
    }
  }

  const filtered = useMemo(() => data.todos.filter((todo) => {
    const query = search.trim().toLocaleLowerCase();
    return (!query || todo.title.toLocaleLowerCase().includes(query) || todo.tags.some((tag) => tag.name.toLocaleLowerCase().includes(query)))
      && (!priorityFilter || todo.priority === priorityFilter)
      && (!statusFilter || (statusFilter === "completed" ? todo.completed : !todo.completed))
      && (!tagFilter || todo.tags.some((tag) => tag.id === Number(tagFilter)));
  }), [data.todos, search, priorityFilter, statusFilter, tagFilter]);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const todo of data.todos) {
        if (todo.completed || !todo.due_date || !todo.reminder_minutes || todo.last_notification_sent) continue;
        const due = new Date(todo.due_date).getTime();
        if (due > now && due - now <= todo.reminder_minutes * 60_000) {
          new Notification("Todo reminder", { body: todo.title });
          void send({ action: "mark-notified", todoId: todo.id });
        }
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [data.todos, send]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setError("This browser does not support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") setError("Notification permission was not granted.");
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const payload: unknown = JSON.parse(await file.text());
      await send({ action: "import", payload });
    } catch {
      setError("Choose a valid Todo JSON backup.");
    }
  }

  function exportTodos() {
    const blob = new Blob([JSON.stringify({ version: 1, todos: data.todos }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "todos-backup.json"; link.click();
    URL.revokeObjectURL(url);
  }

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - ((monthStart.getDay() + 6) % 7));
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const todoByDate = new Map<string, Todo[]>();
  for (const todo of filtered) {
    if (!todo.due_date) continue;
    const key = new Date(todo.due_date).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
    todoByDate.set(key, [...(todoByDate.get(key) ?? []), todo]);
  }

  return (
    <section className="space-y-6">
      {!calendarOnly && (
        <form onSubmit={createTodo} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <label className="md:col-span-2">Title
            <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          <label>Due date
            <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          <label>Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="mt-1 w-full rounded border p-2">
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </label>
          <label>Repeat
            <select value={pattern} onChange={(event) => setPattern(event.target.value as Pattern | "")} className="mt-1 w-full rounded border p-2">
              <option value="">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
            </select>
          </label>
          <label>Reminder
            <select value={reminder} onChange={(event) => setReminder(event.target.value)} className="mt-1 w-full rounded border p-2">
              <option value="">None</option>{reminderChoices.map(([minutes, label]) => <option key={minutes} value={minutes}>{label} before</option>)}
            </select>
          </label>
          <fieldset className="md:col-span-2">
            <legend>Tags</legend>
            <div className="flex flex-wrap gap-3">{data.tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-1">
                <input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={() => setSelectedTags((old) => old.includes(tag.id) ? old.filter((id) => id !== tag.id) : [...old, tag.id])} />
                <span style={{ color: tag.color }}>{tag.name}</span>
              </label>
            ))}</div>
          </fieldset>
          <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Add todo</button>
        </form>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1">Search todos and tags
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded border p-2" />
        </label>
        <label>Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="mt-1 block rounded border p-2">
            <option value="">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </label>
        <label>Tag
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="mt-1 block rounded border p-2">
            <option value="">All</option>{data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </label>
        <label>Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block rounded border p-2">
            <option value="">All</option><option value="open">Open</option><option value="completed">Completed</option>
          </select>
        </label>
        <button type="button" onClick={() => setView(view === "list" ? "calendar" : "list")} className="rounded border px-3 py-2">
          {view === "list" ? "Calendar view" : "List view"}
        </button>
        <Link href="/calendar" className="rounded border px-3 py-2">Open calendar</Link>
        <button type="button" onClick={exportTodos} className="rounded border px-3 py-2">Export JSON</button>
        <label className="cursor-pointer rounded border px-3 py-2">Import JSON
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importFile(event.target.files?.[0])} />
        </label>
        <button type="button" onClick={() => void enableNotifications()} className="rounded border px-3 py-2">Enable reminders</button>
      </div>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-3">
          {view === "calendar" || calendarOnly ? (
            <section className="rounded-xl border bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded border px-3 py-1">Previous</button>
                <h2 className="text-xl font-semibold">{month.toLocaleDateString("en-SG", { month: "long", year: "numeric", timeZone: "Asia/Singapore" })}</h2>
                <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded border px-3 py-1">Next</button>
              </div>
              <div className="grid grid-cols-7 gap-px bg-zinc-200 text-sm">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="bg-zinc-50 p-2 font-semibold">{day}</div>)}
                {calendarDays.map((date) => {
                  const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
                  const dayTodos = todoByDate.get(key) ?? [];
                  const holiday = data.holidays.find((item) => item.date === key);
                  return <div key={key} className={`min-h-24 bg-white p-1 ${date.getMonth() !== month.getMonth() ? "text-zinc-400" : ""}`}>
                    <span>{date.getDate()}</span>
                    {holiday && <div className="truncate text-xs text-emerald-700" title={holiday.name}>{holiday.name}</div>}
                    {dayTodos.map((todo) => <div key={todo.id} className="truncate rounded bg-blue-100 px-1 text-xs text-blue-900" title={todo.title}>{todo.title}</div>)}
                  </div>;
                })}
              </div>
            </section>
          ) : filtered.length ? filtered.map((todo) => (
            <article key={todo.id} className={`rounded-xl border bg-white p-4 shadow-sm ${todo.completed ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start gap-3">
                <input aria-label={`Complete ${todo.title}`} type="checkbox" checked={todo.completed} onChange={(event) => void send({ action: "update", todoId: todo.id, completed: event.target.checked })} className="mt-1 size-4" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`font-semibold ${todo.completed ? "line-through" : ""}`}>{todo.title}</h2>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${todo.priority === "high" ? "bg-red-100 text-red-800" : todo.priority === "low" ? "bg-zinc-100 text-zinc-700" : "bg-amber-100 text-amber-800"}`}>{todo.priority}</span>
                    {todo.is_recurring && <span className="text-xs text-zinc-600">Repeats {todo.recurrence_pattern}</span>}
                    {todo.due_date && <time className="text-sm text-zinc-600">{formatSingaporeDate(todo.due_date)}</time>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">{todo.tags.map((tag) => <span key={tag.id} style={{ backgroundColor: `${tag.color}22`, color: tag.color }} className="rounded px-2 py-0.5 text-xs">{tag.name}</span>)}</div>
                  {todo.subtasks.map((subtask) => <label key={subtask.id} className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={subtask.completed} onChange={() => void send({ action: "subtask", subtaskAction: "update", todoId: todo.id, subtaskId: subtask.id, title: subtask.title, completed: !subtask.completed })} />
                    <span className={subtask.completed ? "line-through text-zinc-500" : ""}>{subtask.title}</span>
                    <button type="button" aria-label={`Delete ${subtask.title}`} onClick={() => void send({ action: "subtask", subtaskAction: "delete", todoId: todo.id, subtaskId: subtask.id })} className="text-zinc-500">×</button>
                  </label>)}
                  <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); const subtaskTitle = newSubtasks[todo.id]?.trim(); if (subtaskTitle) void send({ action: "subtask", subtaskAction: "create", todoId: todo.id, title: subtaskTitle }).then((ok) => { if (ok) setNewSubtasks((old) => ({ ...old, [todo.id]: "" })); }); }}>
                    <input aria-label={`New subtask for ${todo.title}`} value={newSubtasks[todo.id] ?? ""} onChange={(event) => setNewSubtasks((old) => ({ ...old, [todo.id]: event.target.value }))} placeholder="Add subtask" className="rounded border px-2 py-1 text-sm" />
                    <button className="rounded border px-2 text-sm">Add</button>
                  </form>
                  {todo.subtasks.length > 0 && <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-200"><div className="h-full bg-green-600" style={{ width: `${todo.subtasks.filter((item) => item.completed).length / todo.subtasks.length * 100}%` }} /></div>}
                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-600">Priority
                    <select value={todo.priority} onChange={(event) => void send({ action: "update", todoId: todo.id, priority: event.target.value })} className="rounded border p-1">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </label>
                  <label className="ml-3 inline-flex items-center gap-2 text-xs text-zinc-600">Tags
                    <select multiple value={todo.tags.map((tag) => String(tag.id))} onChange={(event) => void send({ action: "update", todoId: todo.id, tagIds: Array.from(event.target.selectedOptions, (option) => Number(option.value)) })} className="rounded border p-1">
                      {data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => { const name = window.prompt("Template name"); if (name?.trim()) void send({ action: "save-template", todoId: todo.id, templateName: name }); }} className="ml-3 text-xs text-blue-700 underline">Save as template</button>
                  <button type="button" onClick={() => { const nextTitle = window.prompt("Edit todo title", todo.title); if (nextTitle?.trim() && nextTitle !== todo.title) void send({ action: "update", todoId: todo.id, title: nextTitle }); }} className="ml-3 text-xs text-blue-700 underline">Edit</button>
                </div>
                <button type="button" onClick={() => void send({ action: "delete", todoId: todo.id })} className="text-sm text-red-700">Delete</button>
              </div>
            </article>
          )) : <p className="rounded-xl border bg-white p-6 text-zinc-600">No matching todos.</p>}
        </div>

        <aside className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Tags & templates</h2>
          <form onSubmit={(event) => { event.preventDefault(); if (newTag.trim()) void send({ action: "tag", title: newTag.trim(), payload: newTagColor }).then((ok) => { if (ok) setNewTag(""); }); }} className="flex gap-2">
            <input aria-label="New tag" value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="New tag" className="min-w-0 flex-1 rounded border p-2" />
            <input aria-label="Tag color" type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} className="h-10 w-10 rounded border p-1" />
            <button className="rounded border px-3">Add</button>
          </form>
          <ul className="space-y-1">{data.tags.map((tag) => <li key={tag.id} className="flex justify-between gap-2">
            <span style={{ color: tag.color }}>{tag.name}</span>
            <button type="button" aria-label={`Delete tag ${tag.name}`} onClick={() => void send({ action: "tag", todoId: tag.id })} className="text-red-700">×</button>
          </li>)}</ul>
          <h3 className="pt-3 font-semibold">Use template</h3>
          {data.templates.map((template) => <button key={template.id} type="button" onClick={() => void send({ action: "use-template", templateId: template.id })} className="block w-full rounded border px-3 py-2 text-left text-sm">{template.name}</button>)}
        </aside>
      </div>
    </section>
  );
}
