"use client";

import { useEffect, useMemo, useState } from "react";
import { parseDate, today } from "@/lib/dates";
import type { CircuitEvent, RsvpState, Trip } from "@/lib/types";

interface Target {
  label: string;
  code: string | null;
  date: Date;
  eventId: string;
  live: boolean;
}

function pickTarget(
  events: CircuitEvent[],
  rsvps: Map<string, RsvpState>,
  trips: Trip[],
): Target | null {
  const now = today().getTime();
  const going = events
    .filter((e) => rsvps.get(e.id) === "going")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  // Live right now beats everything.
  const live = going.find(
    (e) =>
      parseDate(e.start_date).getTime() <= now &&
      parseDate(e.end_date).getTime() >= now,
  );
  if (live) {
    return {
      label: live.name,
      code: live.airport_code,
      date: parseDate(live.start_date),
      eventId: live.id,
      live: true,
    };
  }

  const nextEvent = going.find((e) => parseDate(e.start_date).getTime() > now);
  if (!nextEvent) return null;

  // If a trip contains the next Going event, count down to its departure.
  const trip = trips
    .filter(
      (t) =>
        t.event_ids?.includes(nextEvent.id) &&
        parseDate(t.depart_date).getTime() > now,
    )
    .sort((a, b) => a.depart_date.localeCompare(b.depart_date))[0];

  return {
    label: nextEvent.name,
    code: nextEvent.airport_code,
    date: trip ? parseDate(trip.depart_date) : parseDate(nextEvent.start_date),
    eventId: nextEvent.id,
    live: false,
  };
}

export default function CountdownHero({
  events,
  rsvps,
  trips,
  onTap,
}: {
  events: CircuitEvent[];
  rsvps: Map<string, RsvpState>;
  trips: Trip[];
  onTap: (eventId: string) => void;
}) {
  const target = useMemo(() => pickTarget(events, rsvps, trips), [events, rsvps, trips]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!target) {
    return (
      <div className="mt-4 mb-2">
        <p className="font-mono text-xs text-dim">
          NO GOING EVENTS AHEAD. GO FIND ONE.
        </p>
      </div>
    );
  }

  if (target.live) {
    return (
      <button onClick={() => onTap(target.eventId)} className="block text-left mt-4 mb-2">
        <p className="font-display text-4xl font-extrabold text-green glow-green pulse-soft">
          IT&apos;S HAPPENING
        </p>
        <p className="font-mono text-xs text-fg mt-2 tracking-widest">
          {target.label.toUpperCase()}
          {target.code ? ` · ${target.code}` : ""}
        </p>
      </button>
    );
  }

  const ms = target.date.getTime() - now;
  const days = Math.max(0, Math.floor(ms / 86400000));
  const hours = Math.max(0, Math.floor((ms % 86400000) / 3600000));
  const mins = Math.max(0, Math.floor((ms % 3600000) / 60000));
  const soon = days < 7;
  const color = soon ? "text-green glow-green" : "text-magenta glow-magenta";

  return (
    <button onClick={() => onTap(target.eventId)} className="block text-left mt-4 mb-2">
      <p
        className={`font-mono text-5xl font-bold tracking-tight ${color} ${soon ? "pulse-soft" : ""}`}
      >
        {days}
        <span className="text-2xl">d</span> {String(hours).padStart(2, "0")}
        <span className="text-2xl">h</span> {String(mins).padStart(2, "0")}
        <span className="text-2xl">m</span>
      </p>
      <p className="font-mono text-xs text-dim mt-2 tracking-widest">
        NEXT UP: {target.label.toUpperCase()}
        {target.code ? ` · ${target.code}` : ""}
      </p>
    </button>
  );
}
