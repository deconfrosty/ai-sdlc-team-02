export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

export function singaporeDate(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

export function parseCalendarMonth(value: string | null, fallback: string): string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 1000) return fallback;
  return value;
}

export function shiftCalendarMonth(value: string, offset: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  const next = date.toISOString().slice(0, 7);
  return parseCalendarMonth(next, value);
}

export function generateCalendarGrid(value: string, today: string): CalendarDay[] {
  const [year, month] = value.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = Date.UTC(year, month - 1, 1 - first.getUTCDay());
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const count = Math.ceil((first.getUTCDay() + daysInMonth) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * 86400000);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
      isToday: key === today,
      isPast: key < today,
      isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
    };
  });
}
