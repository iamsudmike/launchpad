"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { parseDate, today } from "@/lib/dates";
import type {
  CircuitEvent,
  Deadline,
  Rsvp,
  RsvpState,
  Settings,
  Trip,
} from "@/lib/types";
import CountdownHero from "./CountdownHero";
import PtoBar from "./PtoBar";
import Timeline from "./Timeline";
import EventForm from "./EventForm";
import IntakeSheet from "./IntakeSheet";
import TripsPanel from "./TripsPanel";
import DeadlinesPanel from "./DeadlinesPanel";
import SettingsPanel from "./SettingsPanel";

type Panel =
  | { kind: "none" }
  | { kind: "intake" }
  | { kind: "event"; event: CircuitEvent | null }
  | { kind: "trips" }
  | { kind: "deadlines" }
  | { kind: "settings" };

export default function Board() {
  const [events, setEvents] = useState<CircuitEvent[]>([]);
  const [rsvps, setRsvps] = useState<Map<string, RsvpState>>(new Map());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>({ kind: "none" });

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    const [ev, rs, tr, dl, st] = await Promise.all([
      supabase.from("events").select("*").order("start_date"),
      supabase.from("rsvps").select("*"),
      supabase.from("trips").select("*").order("depart_date"),
      supabase.from("deadlines").select("*").order("due_date"),
      supabase.from("settings").select("*").limit(1).maybeSingle(),
    ]);
    setEvents((ev.data ?? []) as CircuitEvent[]);
    setRsvps(
      new Map(((rs.data ?? []) as Rsvp[]).map((r) => [r.event_id, r.state])),
    );
    setTrips((tr.data ?? []) as Trip[]);
    setDeadlines((dl.data ?? []) as Deadline[]);
    setSettings((st.data as Settings) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data load happens in the promise callbacks, not synchronously.
    queueMicrotask(() => void refresh());
  }, [refresh]);

  async function setRsvp(eventId: string, state: RsvpState) {
    setRsvps((m) => new Map(m).set(eventId, state));
    await getSupabase()
      .from("rsvps")
      .upsert(
        { event_id: eventId, state, updated_at: new Date().toISOString() },
        { onConflict: "event_id" },
      );
  }

  async function toggleDeadline(id: string, done: boolean) {
    setDeadlines((ds) => ds.map((d) => (d.id === id ? { ...d, done } : d)));
    await getSupabase().from("deadlines").update({ done }).eq("id", id);
  }

  const upcomingDeadlines = useMemo(() => {
    const t = today().getTime();
    return deadlines
      .filter((d) => !d.done && parseDate(d.due_date).getTime() >= t - 86400000)
      .slice(0, 3);
  }, [deadlines]);

  const eventNames = useMemo(
    () => new Map(events.map((e) => [e.id, e.name])),
    [events],
  );

  if (loading) {
    return (
      <main className="flex flex-1 min-h-dvh items-center justify-center">
        <p className="font-mono text-xs text-dim pulse-soft">
          SYNCING THE YEAR...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28">
      <header className="pt-6 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-lg font-extrabold tracking-tight">
            THE CIRCUIT YEAR
          </h1>
          <button
            onClick={() => setPanel({ kind: "settings" })}
            className="font-mono text-[10px] text-dim tracking-widest"
          >
            SETUP
          </button>
        </div>
        <CountdownHero
          events={events}
          rsvps={rsvps}
          trips={trips}
          onTap={(id) => {
            document
              .getElementById(`event-${id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
        {settings && <PtoBar settings={settings} trips={trips} />}
        {upcomingDeadlines.length > 0 && (
          <button
            onClick={() => setPanel({ kind: "deadlines" })}
            className="mt-3 w-full text-left card rounded-lg px-3 py-2 border-amber/40"
          >
            {upcomingDeadlines.map((d) => (
              <p key={d.id} className="font-mono text-[11px] text-amber truncate">
                ▲ {d.due_date} · {d.kind.toUpperCase()}
                {d.event_id && eventNames.get(d.event_id)
                  ? ` · ${eventNames.get(d.event_id)}`
                  : ""}
                {d.note ? ` : ${d.note}` : ""}
              </p>
            ))}
          </button>
        )}
      </header>

      <Timeline
        events={events}
        rsvps={rsvps}
        onRsvp={setRsvp}
        onEdit={(e) => setPanel({ kind: "event", event: e })}
      />

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] font-mono text-[10px] tracking-widest">
          <button
            onClick={() => setPanel({ kind: "intake" })}
            className="px-3 py-2 text-magenta"
          >
            + PASTE
          </button>
          <button
            onClick={() => setPanel({ kind: "event", event: null })}
            className="px-3 py-2 text-cyan"
          >
            + EVENT
          </button>
          <button
            onClick={() => setPanel({ kind: "trips" })}
            className="px-3 py-2 text-fg"
          >
            TRIPS
          </button>
          <button
            onClick={() => setPanel({ kind: "deadlines" })}
            className="px-3 py-2 text-amber"
          >
            ALERTS
          </button>
        </div>
      </nav>

      {panel.kind === "intake" && (
        <IntakeSheet
          onClose={() => setPanel({ kind: "none" })}
          onSaved={() => {
            setPanel({ kind: "none" });
            void refresh();
          }}
        />
      )}
      {panel.kind === "event" && (
        <EventForm
          event={panel.event}
          onClose={() => setPanel({ kind: "none" })}
          onSaved={() => {
            setPanel({ kind: "none" });
            void refresh();
          }}
        />
      )}
      {panel.kind === "trips" && (
        <TripsPanel
          trips={trips}
          events={events}
          rsvps={rsvps}
          settings={settings}
          onClose={() => setPanel({ kind: "none" })}
          onChanged={refresh}
        />
      )}
      {panel.kind === "deadlines" && (
        <DeadlinesPanel
          deadlines={deadlines}
          eventNames={eventNames}
          events={events}
          onClose={() => setPanel({ kind: "none" })}
          onToggle={toggleDeadline}
          onChanged={refresh}
        />
      )}
      {panel.kind === "settings" && settings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setPanel({ kind: "none" })}
          onChanged={refresh}
        />
      )}
    </main>
  );
}
