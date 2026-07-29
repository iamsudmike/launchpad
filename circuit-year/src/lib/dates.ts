// All event/trip dates are date-only strings (YYYY-MM-DD) interpreted in the
// device's local timezone.

export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export function monthKey(d: string): string {
  return d.slice(0, 7); // YYYY-MM
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  const sm = MONTHS[s.getMonth()];
  const em = MONTHS[e.getMonth()];
  if (start === end) return `${sm} ${s.getDate()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${sm} ${s.getDate()}-${e.getDate()}`;
  }
  return `${sm} ${s.getDate()} - ${em} ${e.getDate()}`;
}

export function formatFull(d: string): string {
  const x = parseDate(d);
  return `${MONTHS[x.getMonth()]} ${x.getDate()} ${x.getFullYear()}`;
}
