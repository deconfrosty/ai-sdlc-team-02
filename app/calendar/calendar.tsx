"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Holiday, Todo } from "@/lib/db";
import { generateCalendarGrid, parseCalendarMonth, shiftCalendarMonth, singaporeDate } from "@/lib/calendar";

export default function Calendar({ today }: { today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    function updateMonth() {
      setMonth(parseCalendarMonth(new URL(window.location.href).searchParams.get("month"), today.slice(0, 7)));
    }
    window.addEventListener("popstate", updateMonth);
    const timer = window.setTimeout(updateMonth, 0);
    return () => { window.clearTimeout(timer); window.removeEventListener("popstate", updateMonth); };
  }, [today]);

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

  function navigateMonth(offset: number) {
    const next = shiftCalendarMonth(month, offset);
    const url = new URL(window.location.href);
    url.searchParams.set("month", next);
    window.history.pushState(null, "", url);
    setMonth(next);
    setSelected("");
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  const days = generateCalendarGrid(month, today);
  const dayFor = (todo: Todo) => todo.due_date ? singaporeDate(new Date(todo.due_date)) : "";

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <Link href="/" className="text-blue-700">Back to todos</Link>
      <h1 className="text-3xl font-bold">Calendar</h1>
      {error && <p role="alert">{error}</p>}
      <div className="flex items-center gap-4">
        <button type="button" className="rounded border px-3" onClick={() => navigateMonth(-1)}>Previous</button>
        <h2 className="text-xl">{label}</h2>
        <button type="button" className="rounded border px-3" onClick={() => navigateMonth(1)}>Next</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="font-semibold">{day}</div>)}
        {days.map((day) => {
          const items = todos.filter((todo) => dayFor(todo) === day.date);
          const holiday = holidays.find((item) => item.date === day.date);
          return <button type="button" key={day.date} aria-label={day.date} aria-current={day.isToday ? "date" : undefined} className={`min-h-24 rounded border p-1 text-left align-top ${day.isWeekend ? "bg-zinc-50" : ""}`} onClick={() => setSelected(day.date)}>
            <span className={day.inMonth ? "font-bold" : "text-zinc-400"}>{day.day}</span>
            {holiday && <span className="block text-xs">{holiday.name}</span>}
            {items.slice(0, 2).map((todo) => <span className="block truncate text-xs" key={todo.id}>{todo.title} ({todo.priority})</span>)}
            {items.length > 2 && <span className="text-xs">+{items.length - 2} more</span>}
          </button>;
        })}
      </div>
      {selected && <section><h2 className="text-xl">Todos for {selected}</h2>{todos.filter((todo) => dayFor(todo) === selected).map((todo) => <p key={todo.id}>{todo.title} ({todo.priority})</p>)}</section>}
    </main>
  );
}
