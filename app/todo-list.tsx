"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Tag, Template, Todo } from "@/lib/db";
import { formatSingaporeDate } from "@/lib/timezone";
import { filterPresetsKey, filterPresetsSchema, type FilterPreset } from "@/lib/filter-presets";

function localDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(Date.parse(value) + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export default function TodoList({ userId }: { userId: number }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tagName, setTagName] = useState("");
  const [subtaskTitles, setSubtaskTitles] = useState<Record<number, string>>({});
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("medium");
  const [due, setDue] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [reminder, setReminder] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [completionFilter, setCompletionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Todo["priority"]>("medium");
  const [editDue, setEditDue] = useState("");
  const [editRecurrence, setEditRecurrence] = useState("");
  const [editReminder, setEditReminder] = useState("");
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("#3B82F6");
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/todos");
    if (!response.ok) throw new Error("Could not load todos");
    setTodos(await response.json() as Todo[]);
    const tagResponse = await fetch("/api/tags");
    if (!tagResponse.ok) throw new Error("Could not load tags");
    setTags(await tagResponse.json() as Tag[]);
    const templateResponse = await fetch("/api/templates");
    if (!templateResponse.ok) throw new Error("Could not load templates");
    setTemplates(await templateResponse.json() as Template[]);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNow(Date.now());
      void refresh().catch((cause: Error) => setError(cause.message));
      try {
        const stored = window.localStorage.getItem(`${filterPresetsKey}:${userId}`);
        if (stored) {
          const parsed = filterPresetsSchema.safeParse(JSON.parse(stored));
          if (!parsed.success) throw new Error("Saved filter presets are invalid");
          setPresets(parsed.data);
        }
      } catch {
        setError("Could not load saved filter presets");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, userId]);

  useEffect(() => {
    async function check() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        const response = await fetch("/api/notifications/check");
        if (!response.ok) throw new Error("Could not check reminders");
        const due = await response.json() as { title: string }[];
        for (const todo of due) new Notification("Todo reminder", { body: todo.title });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not check reminders");
      }
    }
    void check();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void check();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function send(path: string, method: string, body?: unknown) {
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "Request failed");
      }
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
      return false;
    }
  }

  function storePresets(next: FilterPreset[]) {
    try {
      window.localStorage.setItem(`${filterPresetsKey}:${userId}`, JSON.stringify(next));
      setPresets(next);
      setError("");
    } catch {
      setError("Could not save filter presets");
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = await send("/api/todos", "POST", {
      title, priority,
      due_date: due ? new Date(`${due}:00+08:00`).toISOString() : null,
      is_recurring: !!recurrence,
      recurrence_pattern: recurrence || null,
      reminder_minutes: reminder ? Number(reminder) : null,
    });
    if (success) {
      setTitle("");
      setDue("");
      setRecurrence("");
      setReminder("");
    }
  }

  const filtered = todos.filter((todo) => {
    const text = search.toLowerCase();
    const matchesText = todo.title.toLowerCase().includes(text) ||
      (todo.subtasks ?? []).some((subtask) => subtask.title.toLowerCase().includes(text));
    const day = todo.due_date ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(todo.due_date)) : "";
    return matchesText &&
      (!priorityFilter || todo.priority === priorityFilter) &&
      (!tagFilter || todo.tags?.some((tag) => tag.id === Number(tagFilter))) &&
      (!completionFilter || todo.completed === (completionFilter === "completed")) &&
      (!fromDate || (!!day && day >= fromDate)) &&
      (!toDate || (!!day && day <= toDate));
  });
  const sections = [
    { name: "Overdue", items: filtered.filter((todo) => !todo.completed && todo.due_date && Date.parse(todo.due_date) < now) },
    { name: "Pending", items: filtered.filter((todo) => !todo.completed && (!todo.due_date || Date.parse(todo.due_date) >= now)) },
    { name: "Completed", items: filtered.filter((todo) => todo.completed) },
  ];

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap gap-2" onSubmit={(event) => void create(event)}>
        <input aria-label="Todo title" className="rounded border p-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New todo" required maxLength={500} />
        <select aria-label="Priority" className="rounded border p-2" value={priority} onChange={(event) => setPriority(event.target.value as Todo["priority"])}>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <label className="text-sm">Due (Singapore) <input aria-label="Due date" className="rounded border p-2" type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /></label>
        <select aria-label="Repeat" className="rounded border p-2" value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
          <option value="">No repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
        </select>
        <select aria-label="Reminder" className="rounded border p-2" disabled={!due} value={reminder} onChange={(event) => setReminder(event.target.value)}>
          <option value="">No reminder</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="1440">1 day</option><option value="2880">2 days</option><option value="10080">1 week</option>
        </select>
        <button className="rounded bg-blue-700 px-4 py-2 text-white" type="submit">Add todo</button>
      </form>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button type="button" className="rounded border px-3 py-1" onClick={() => {
        if ("Notification" in window) void Notification.requestPermission();
        else setError("Notifications are not supported by this browser");
      }}>Enable notifications</button>
      <div className="flex flex-wrap gap-3">
        <Link className="text-blue-700" href="/api/todos/export?format=json" download>Export JSON</Link>
        <Link className="text-blue-700" href="/api/todos/export?format=csv" download>Export CSV</Link>
        <label>Import JSON <input type="file" accept="application/json,.json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void file.text().then((text) => {
            try { return send("/api/todos/import", "POST", JSON.parse(text)); }
            catch { setError("Invalid JSON file"); return false; }
          }).catch(() => setError("Could not read the file"));
          event.target.value = "";
        }} /></label>
      </div>
      <input aria-label="Search todos" className="rounded border p-2" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search todos" />
      <div className="flex flex-wrap gap-2">
        <select aria-label="Filter priority" className="rounded border p-2" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select aria-label="Filter tag" className="rounded border p-2" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
          <option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
        <select aria-label="Filter completion" className="rounded border p-2" value={completionFilter} onChange={(event) => setCompletionFilter(event.target.value)}>
          <option value="">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option>
        </select>
        <label>From <input aria-label="From date" type="date" className="rounded border p-2" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To <input aria-label="To date" type="date" className="rounded border p-2" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        const parsed = filterPresetsSchema.safeParse([...presets, {
          id: crypto.randomUUID(), name: presetName.trim(),
          filters: { search, priority: priorityFilter, tagId: tagFilter, completion: completionFilter, dueDateFrom: fromDate, dueDateTo: toDate },
          createdAt: new Date().toISOString(),
        }]);
        if (!parsed.success) { setError("Enter a valid preset name"); return; }
        storePresets(parsed.data);
        setPresetName("");
      }}>
        <input aria-label="Filter preset name" className="rounded border p-2" value={presetName} maxLength={100} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" required />
        <button className="rounded border px-3" type="submit">Save filters</button>
        {presets.map((preset) => <span className="flex gap-1" key={preset.id}>
          <button type="button" className="rounded border px-2" onClick={() => {
            const filters = preset.filters;
            setSearch(filters.search); setPriorityFilter(filters.priority); setTagFilter(filters.tagId);
            setCompletionFilter(filters.completion); setFromDate(filters.dueDateFrom); setToDate(filters.dueDateTo);
          }}>Apply {preset.name}</button>
          <button type="button" className="rounded border px-2" onClick={() => storePresets(presets.filter((item) => item.id !== preset.id))}>Delete preset {preset.name}</button>
        </span>)}
      </form>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        void send("/api/tags", "POST", { name: tagName }).then((success) => { if (success) setTagName(""); });
      }}>
        <input aria-label="Tag name" className="rounded border p-2" value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="New tag" required />
        <button className="rounded border px-3" type="submit">Create tag</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => <div key={tag.id} className="flex gap-1">
          {editingTag === tag.id ? <form className="flex gap-1" onSubmit={(event) => {
            event.preventDefault();
            void send(`/api/tags/${tag.id}`, "PUT", { name: editTagName, color: editTagColor }).then((success) => { if (success) setEditingTag(null); });
          }}>
            <input aria-label="Edit tag name" className="rounded border p-1" value={editTagName} onChange={(event) => setEditTagName(event.target.value)} required maxLength={100} />
            <input aria-label="Edit tag color" type="color" value={editTagColor} onChange={(event) => setEditTagColor(event.target.value)} />
            <button type="submit" className="rounded border px-2">Save tag</button>
            <button type="button" onClick={() => setEditingTag(null)}>Cancel</button>
          </form> : <button type="button" className="rounded border px-2" onClick={() => { setEditingTag(tag.id); setEditTagName(tag.name); setEditTagColor(tag.color); }}>Edit {tag.name}</button>}
          <button type="button" className="rounded border px-2" onClick={() => void send(`/api/tags/${tag.id}`, "DELETE")}>Delete {tag.name}</button>
        </div>)}
      </div>
      {!!templates.length && <section className="flex flex-wrap gap-2">
        <h2 className="font-semibold">Templates</h2>
        {templates.map((template) => <span key={template.id} className="flex gap-1">
          <button type="button" className="rounded border px-2" onClick={() => void send(`/api/templates/${template.id}/use`, "POST")}>Use {template.name}</button>
          <button type="button" className="rounded border px-2 text-red-700" onClick={() => void send(`/api/templates/${template.id}`, "DELETE")}>Delete template</button>
        </span>)}
      </section>}
      {sections.map((section) => (
        <section key={section.name} className="space-y-2">
          <h2 className="text-xl font-semibold">{section.name}</h2>
          {section.items.length === 0 && <p className="text-sm text-zinc-500">No todos</p>}
          {section.items.map((todo) => (
            <div className="space-y-2 rounded border p-3" key={todo.id}>
              <div className="flex flex-wrap items-center gap-3">
              <input aria-label={`Complete ${todo.title}`} type="checkbox" checked={todo.completed} onChange={(event) => void send(`/api/todos/${todo.id}`, "PUT", { completed: event.target.checked })} />
              <span className={todo.completed ? "line-through" : ""}>{todo.title}</span>
              <button type="button" className="rounded border px-2 text-sm" onClick={() => {
                setEditing(todo.id); setEditTitle(todo.title); setEditPriority(todo.priority); setEditDue(localDateTime(todo.due_date));
                setEditRecurrence(todo.is_recurring ? todo.recurrence_pattern ?? "" : ""); setEditReminder(todo.reminder_minutes?.toString() ?? "");
              }}>Edit</button>
              <span className="text-sm">{todo.priority}</span>
              {todo.due_date && <time className="text-sm" dateTime={todo.due_date}>{formatSingaporeDate(todo.due_date)}</time>}
              {todo.is_recurring && <span className="text-sm">Repeats {todo.recurrence_pattern}</span>}
              {todo.reminder_minutes && <span className="text-sm">Reminder {todo.reminder_minutes} min</span>}
              <button type="button" className="rounded border px-2 text-sm" onClick={() => void send("/api/templates", "POST", { name: todo.title, todoId: todo.id })}>Save template</button>
              <button className="ml-auto text-red-700" type="button" onClick={() => void send(`/api/todos/${todo.id}`, "DELETE")}>Delete</button>
              </div>
              {editing === todo.id && <form className="flex flex-wrap gap-2" onSubmit={(event) => {
                event.preventDefault();
                void send(`/api/todos/${todo.id}`, "PUT", {
                  title: editTitle, priority: editPriority,
                  due_date: editDue === localDateTime(todo.due_date) ? todo.due_date : editDue ? new Date(`${editDue}:00+08:00`).toISOString() : null,
                  is_recurring: !!editRecurrence, recurrence_pattern: editRecurrence || null,
                  reminder_minutes: editReminder ? Number(editReminder) : null,
                }).then((success) => { if (success) setEditing(null); });
              }}>
                <input aria-label="Edit title" className="rounded border p-1" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
                <select aria-label="Edit priority" className="rounded border p-1" value={editPriority} onChange={(event) => setEditPriority(event.target.value as Todo["priority"])}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
                <input aria-label="Edit due date (Singapore)" type="datetime-local" className="rounded border p-1" value={editDue} onChange={(event) => { setEditDue(event.target.value); if (!event.target.value) setEditReminder(""); }} />
                <select aria-label="Edit repeat" className="rounded border p-1" value={editRecurrence} onChange={(event) => setEditRecurrence(event.target.value)}>
                  <option value="">No repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select>
                <select aria-label="Edit reminder" className="rounded border p-1" disabled={!editDue} value={editReminder} onChange={(event) => setEditReminder(event.target.value)}>
                  <option value="">No reminder</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="1440">1 day</option><option value="2880">2 days</option><option value="10080">1 week</option>
                </select>
                <button type="submit" className="rounded border px-2">Save</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </form>}
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const attached = todo.tags?.some((item) => item.id === tag.id) ?? false;
                  return <button key={tag.id} type="button" className="rounded border px-2 text-sm" aria-pressed={attached} onClick={() => void send(`/api/todos/${todo.id}/tags`, attached ? "DELETE" : "POST", { tagId: tag.id })}>{attached ? "✓ " : "+ "}{tag.name}</button>;
                })}
              </div>
              {!!todo.subtasks?.length && <div>
                <p className="text-sm">{todo.subtasks.filter((item) => item.completed).length}/{todo.subtasks.length} subtasks</p>
                <progress aria-label={`Subtask progress for ${todo.title}`} value={todo.subtasks.filter((item) => item.completed).length} max={todo.subtasks.length} />
              </div>}
              {todo.subtasks?.map((subtask) => <div key={subtask.id} className="flex gap-2 text-sm">
                <input type="checkbox" aria-label={`Complete ${subtask.title}`} checked={Boolean(subtask.completed)} onChange={(event) => void send(`/api/subtasks/${subtask.id}`, "PUT", { completed: event.target.checked })} />
                <span>{subtask.title}</span><button type="button" className="text-red-700" onClick={() => void send(`/api/subtasks/${subtask.id}`, "DELETE")}>Delete subtask</button>
              </div>)}
              <form className="flex gap-2" onSubmit={(event) => {
                event.preventDefault();
                void send(`/api/todos/${todo.id}/subtasks`, "POST", { title: subtaskTitles[todo.id] ?? "" }).then((success) => {
                  if (success) setSubtaskTitles((values) => ({ ...values, [todo.id]: "" }));
                });
              }}>
                <input aria-label={`New subtask for ${todo.title}`} className="rounded border p-1 text-sm" value={subtaskTitles[todo.id] ?? ""} onChange={(event) => setSubtaskTitles((values) => ({ ...values, [todo.id]: event.target.value }))} required />
                <button className="rounded border px-2 text-sm" type="submit">Add subtask</button>
              </form>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
