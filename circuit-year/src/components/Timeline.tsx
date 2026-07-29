"use client";

import { useMemo } from "react";
import { formatRange, monthKey, monthLabel, parseDate, today } from "@/lib/dates";
import { googleCalendarLink } from "@/lib/ics";
import type { CircuitEvent, RsvpState } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  rumored: "text-dim border-line",
  announced: "text-cyan border-cyan/40",
  on_sale: "text-green border-green/40",
  sold_out: "text-amber border-amber/40",
  past: "text-dim border-line",
  cancelled: "text-red border-red/40",
};

const RSVP_STYLE: Record<RsvpState, string> = {
  going: "bg-green text-bg border-green",
  skip: "bg-transparent text-dim border-line line-through",
  undecided: "bg-transparent text-amber border-amber/50",
};

function EventCard({
  event,
  rsvp,
  onRsvp,
  onEdit,
}: {
  event: CircuitEvent;
  rsvp: RsvpState;
  onRsvp: (id: string, s: RsvpState) => void;
  onEdit: (e: CircuitEvent) => void;
}) {
  const lowConf = event.confidence !== "high";
  const isPast = parseDate(event.end_date).getTime() < today().getTime();

  return (
    <div
      id={`event-${event.id}`}
      className={`card rounded-xl p-3 ${rsvp === "going" ? "card-going" : ""} ${
        rsvp === "skip" ? "card-skip" : ""
      } ${isPast ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-cyan glow-cyan">
            {formatRange(event.start_date, event.end_date)}
            {lowConf && <span className="text-amber" title="date not confirmed">*</span>}
          </p>
          <button onClick={() => onEdit(event)} className="text-left">
            <h3 className="strikeable font-display text-sm font-semibold leading-snug mt-0.5">
              {event.name}
            </h3>
          </button>
          <p className="text-xs text-dim mt-0.5 truncate">
            {[event.series, event.producer, event.venue]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {event.airport_code && (
            <span className="chip text-magenta border-magenta/50">
              {event.airport_code}
            </span>
          )}
          {event.relevance_score != null && (
            <span
              className="chip text-fg"
              title={event.relevance_reason ?? undefined}
            >
              {event.relevance_score}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className={`chip ${STATUS_COLOR[event.status] ?? "text-dim"}`}>
          {event.status.replace("_", " ")}
        </span>
        <span className="chip text-dim">{event.category.replace("_", " ")}</span>
        {event.city && <span className="chip text-dim">{event.city}</span>}
        <span className="flex-1" />
        {event.ticket_url && (
          <a
            href={event.ticket_url}
            target="_blank"
            rel="noreferrer"
            className="chip text-cyan border-cyan/40"
          >
            TIX
          </a>
        )}
        <a
          href={googleCalendarLink(event)}
          target="_blank"
          rel="noreferrer"
          className="chip text-dim"
          title="Add to Google Calendar"
        >
          GCAL
        </a>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        {(["going", "undecided", "skip"] as RsvpState[]).map((s) => (
          <button
            key={s}
            onClick={() => onRsvp(event.id, s)}
            className={`rounded-md border font-mono text-[10px] tracking-widest py-1.5 uppercase transition-colors ${
              rsvp === s
                ? RSVP_STYLE[s]
                : "border-line text-dim hover:border-fg/40"
            }`}
          >
            {s === "undecided" ? "???" : s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Timeline({
  events,
  rsvps,
  onRsvp,
  onEdit,
}: {
  events: CircuitEvent[];
  rsvps: Map<string, RsvpState>;
  onRsvp: (id: string, s: RsvpState) => void;
  onEdit: (e: CircuitEvent) => void;
}) {
  const months = useMemo(() => {
    const byMonth = new Map<string, CircuitEvent[]>();
    for (const e of events) {
      const k = monthKey(e.start_date);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(e);
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (events.length === 0) {
    return (
      <p className="font-mono text-xs text-dim mt-10 text-center">
        EMPTY BOARD. PASTE SOMETHING.
      </p>
    );
  }

  return (
    <div className="relative mt-4 pl-5">
      <div className="rail absolute left-1 top-0 bottom-0 w-0.5 rounded-full" />
      {months.map(([key, list]) => (
        <section key={key} className="mb-6">
          <div className="sticky-month py-2 -ml-5 pl-5">
            <h2 className="font-mono text-xs tracking-[0.3em] text-dim">
              <span className="text-magenta">▸</span> {monthLabel(key)}
            </h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {list.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                rsvp={rsvps.get(e.id) ?? "undecided"}
                onRsvp={onRsvp}
                onEdit={onEdit}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
