import { addDays, parseDate, toDateString } from "./dates";
import type { CircuitEvent, Deadline, Trip } from "./types";

function icsDate(d: string): string {
  return d.replaceAll("-", "");
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  // RFC 5545: lines max 75 octets, continuation lines start with a space.
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
}

function vevent(fields: Record<string, string>): string {
  const lines = ["BEGIN:VEVENT"];
  for (const [k, v] of Object.entries(fields)) lines.push(fold(`${k}:${v}`));
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function buildCalendar(
  events: CircuitEvent[],
  trips: Trip[],
  deadlines: Deadline[],
  eventNames: Map<string, string>,
): string {
  const now = new Date();
  const stamp =
    now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const blocks: string[] = [];

  for (const e of events) {
    const loc = [e.venue, e.city, e.country].filter(Boolean).join(", ");
    const desc = [
      e.series ? `Series: ${e.series}` : null,
      e.producer ? `Producer: ${e.producer}` : null,
      e.status ? `Status: ${e.status}` : null,
      e.ticket_url ? `Tickets: ${e.ticket_url}` : null,
      e.description,
    ]
      .filter(Boolean)
      .join("\n");
    blocks.push(
      vevent({
        UID: `event-${e.id}@circuit-year`,
        DTSTAMP: stamp,
        "DTSTART;VALUE=DATE": icsDate(e.start_date),
        // DTEND is exclusive for all-day events.
        "DTEND;VALUE=DATE": icsDate(toDateString(addDays(parseDate(e.end_date), 1))),
        SUMMARY: esc(`${e.name}${e.airport_code ? ` · ${e.airport_code}` : ""}`),
        LOCATION: esc(loc),
        DESCRIPTION: esc(desc),
      }),
    );
  }

  for (const t of trips) {
    blocks.push(
      vevent({
        UID: `trip-${t.id}@circuit-year`,
        DTSTAMP: stamp,
        "DTSTART;VALUE=DATE": icsDate(t.depart_date),
        "DTEND;VALUE=DATE": icsDate(toDateString(addDays(parseDate(t.return_date), 1))),
        SUMMARY: esc(`TRIP: ${t.name}`),
        DESCRIPTION: esc(
          [
            t.pto_days != null ? `PTO days: ${t.pto_days}` : null,
            `Buffer days: ${t.buffer_days}`,
            t.notes,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      }),
    );
    if (t.buffer_days > 0) {
      const bufferStart = addDays(parseDate(t.return_date), -t.buffer_days + 1);
      blocks.push(
        vevent({
          UID: `trip-buffer-${t.id}@circuit-year`,
          DTSTAMP: stamp,
          "DTSTART;VALUE=DATE": icsDate(toDateString(bufferStart)),
          "DTEND;VALUE=DATE": icsDate(toDateString(addDays(parseDate(t.return_date), 1))),
          SUMMARY: esc(`Recovery: ${t.name}`),
          DESCRIPTION: esc("Recovery - do not book flights before this date"),
        }),
      );
    }
  }

  for (const d of deadlines) {
    if (d.done) continue;
    const target = d.event_id ? eventNames.get(d.event_id) : null;
    blocks.push(
      vevent({
        UID: `deadline-${d.id}@circuit-year`,
        DTSTAMP: stamp,
        "DTSTART;VALUE=DATE": icsDate(d.due_date),
        "DTEND;VALUE=DATE": icsDate(toDateString(addDays(parseDate(d.due_date), 1))),
        SUMMARY: esc(
          `DEADLINE [${d.kind}]${target ? ` ${target}` : ""}${d.note ? `: ${d.note}` : ""}`,
        ),
      }),
    );
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//circuit-year//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:The Circuit Year",
    ...blocks,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function googleCalendarLink(e: CircuitEvent): string {
  const end = toDateString(addDays(parseDate(e.end_date), 1));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.name,
    dates: `${icsDate(e.start_date)}/${icsDate(end)}`,
    location: [e.venue, e.city, e.country].filter(Boolean).join(", "),
    details: e.ticket_url ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
