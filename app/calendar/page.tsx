"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Holiday, Todo } from "@/lib/db";

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month, 1)));
}

export default function CalendarPage() {
  const [offset, setOffset] = useState(0);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [todoResponse, holidayResponse] = await Promise.all([fetch("/api/todos"), fetch("/api/holidays")]);
        if (!todoResponse.ok || !holidayResponse.ok) throw new Error("Could not load calendar");
        setTodos(await todoResponse.json() as Todo[]);
        setHolidays(await holidayResponse.json() as Holiday[]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load calendar");
      }
    }
    void load();
  }, []);

  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value) - 1;
  const current = new Date(Date.UTC(year, month + offset, 1));
  const first = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1 - current.getUTCDay()));
  const last = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
  const count = Math.ceil((first.getUTCDay() + (last.getTime() - first.getTime()) / 86400000 + 1) / 7) * 7;
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getTime() + index * 86400000);
    return { date, key: date.toISOString().slice(0, 10) };
  });
  const dayFor = (todo: Todo) => todo.due_date
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(todo.due_date))
    : "";

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <Link href="/" className="text-blue-700">Back to todos</Link>
      <h1 className="text-3xl font-bold">Calendar</h1>
      {error && <p role="alert">{error}</p>}
      <div className="flex items-center gap-4">
        <button type="button" className="rounded border px-3" onClick={() => setOffset(offset - 1)}>Previous</button>
        <h2 className="text-xl">{monthLabel(current.getUTCFullYear(), current.getUTCMonth())}</h2>
        <button type="button" className="rounded border px-3" onClick={() => setOffset(offset + 1)}>Next</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="font-semibold">{day}</div>)}
        {days.map(({ date, key }) => {
          const items = todos.filter((todo) => dayFor(todo) === key);
          const holiday = holidays.find((item) => item.date === key);
          return <button type="button" key={key} className="min-h-24 rounded border p-1 text-left align-top" onClick={() => setSelected(key)}>
            <span className={date.getUTCMonth() === current.getUTCMonth() ? "font-bold" : "text-zinc-400"}>{date.getUTCDate()}</span>
            {holiday && <span className="block text-xs">{holiday.name}</span>}
            {items.slice(0, 2).map((todo) => <span className="block truncate text-xs" key={todo.id}>{todo.title}</span>)}
            {items.length > 2 && <span className="text-xs">+{items.length - 2} more</span>}
          </button>;
        })}
      </div>
      {selected && <section><h2 className="text-xl">Todos for {selected}</h2>{todos.filter((todo) => dayFor(todo) === selected).map((todo) => <p key={todo.id}>{todo.title} ({todo.priority})</p>)}</section>}
    </main>
  );
}
