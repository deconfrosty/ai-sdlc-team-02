import Calendar from "@/app/calendar/calendar";
import { singaporeDate } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return <Calendar today={singaporeDate(new Date())} />;
}
