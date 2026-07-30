// Display formatting for message timestamps. Client-safe (no next/headers), so
// both the server data layer and Realtime-inserted messages on the client can
// use the same rules:
//   • today            → "09:14"
//   • within the week  → "Mon"
//   • older            → "12 Jul"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Short relative label for a message/thread timestamp. */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays >= 1 && diffDays < 7) return WEEKDAYS[d.getDay()];

  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
