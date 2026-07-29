"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { formatRange } from "@/lib/dates";
import { suggestPtoDays } from "@/lib/pto";
import type { CircuitEvent, RsvpState, Settings, Trip } from "@/lib/types";
import Modal from "./Modal";

const inputCls =
  "card rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan w-full";
const labelCls = "font-mono text-[10px] tracking-widest text-dim mb-1 block";

function TripForm({
  trip,
  events,
  rsvps,
  settings,
  onDone,
}: {
  trip: Trip | null;
  events: CircuitEvent[];
  rsvps: Map<string, RsvpState>;
  settings: Settings | null;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    name: trip?.name ?? "",
    depart_date: trip?.depart_date ?? "",
    return_date: trip?.return_date ?? "",
    buffer_days: trip?.buffer_days ?? 2,
    pto_days: trip?.pto_days?.toString() ?? "",
    notes: trip?.notes ?? "",
    event_ids: new Set(trip?.event_ids ?? []),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = events.filter((e) => rsvps.get(e.id) !== "skip");

  function autoSuggest() {
    if (!f.depart_date || !f.return_date) return;
    const days = suggestPtoDays(
      f.depart_date,
      f.return_date,
      settings?.company_holidays ?? [],
    );
    setF((p) => ({ ...p, pto_days: String(days) }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const row = {
      name: f.name,
      depart_date: f.depart_date,
      return_date: f.return_date,
      buffer_days: f.buffer_days,
      pto_days: f.pto_days === "" ? null : Number(f.pto_days),
      notes: f.notes || null,
      event_ids: [...f.event_ids],
    };
    const supabase = getSupabase();
    const q = trip
      ? supabase.from("trips").update(row).eq("id", trip.id)
      : supabase.from("trips").insert(row);
    const { error } = await q;
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  async function remove() {
    if (!trip || !confirm(`Delete trip "${trip.name}"?`)) return;
    await getSupabase().from("trips").delete().eq("id", trip.id);
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>TRIP NAME</label>
        <input
          required
          className={inputCls}
          value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>DEPART</label>
          <input
            required
            type="date"
            className={inputCls}
            value={f.depart_date}
            onChange={(e) => setF((p) => ({ ...p, depart_date: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>RETURN (LAST EVENT + BUFFER)</label>
          <input
            required
            type="date"
            className={inputCls}
            value={f.return_date}
            onChange={(e) => setF((p) => ({ ...p, return_date: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>BUFFER DAYS</label>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={f.buffer_days}
            onChange={(e) =>
              setF((p) => ({ ...p, buffer_days: Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <label className={labelCls}>
            PTO DAYS{" "}
            <button
              type="button"
              onClick={autoSuggest}
              className="text-cyan underline"
            >
              auto
            </button>
          </label>
          <input
            type="number"
            step="0.5"
            min={0}
            className={inputCls}
            value={f.pto_days}
            onChange={(e) => setF((p) => ({ ...p, pto_days: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>EVENTS ON THIS TRIP</label>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto card rounded-lg p-2">
          {candidates.map((e) => (
            <label key={e.id} className="flex gap-2 items-center text-xs">
              <input
                type="checkbox"
                checked={f.event_ids.has(e.id)}
                onChange={() =>
                  setF((p) => {
                    const n = new Set(p.event_ids);
                    if (n.has(e.id)) n.delete(e.id);
                    else n.add(e.id);
                    return { ...p, event_ids: n };
                  })
                }
                className="accent-[#29e0ff]"
              />
              <span className="truncate">{e.name}</span>
              <span className="font-mono text-[10px] text-dim ml-auto shrink-0">
                {formatRange(e.start_date, e.end_date)}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>NOTES</label>
        <textarea
          rows={2}
          className={inputCls}
          value={f.notes}
          onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
        />
      </div>
      {error && <p className="font-mono text-xs text-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-cyan text-bg font-mono text-sm font-bold py-3 disabled:opacity-50"
        >
          {busy ? "..." : "SAVE TRIP"}
        </button>
        {trip && (
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red/50 text-red font-mono text-sm px-4"
          >
            DELETE
          </button>
        )}
      </div>
    </form>
  );
}

export default function TripsPanel({
  trips,
  events,
  rsvps,
  settings,
  onClose,
  onChanged,
}: {
  trips: Trip[];
  events: CircuitEvent[];
  rsvps: Map<string, RsvpState>;
  settings: Settings | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Trip | null | "new">(null);

  if (editing !== null) {
    return (
      <Modal
        title={editing === "new" ? "NEW TRIP" : "EDIT TRIP"}
        onClose={() => setEditing(null)}
      >
        <TripForm
          trip={editing === "new" ? null : editing}
          events={events}
          rsvps={rsvps}
          settings={settings}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title="TRIPS" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {trips.length === 0 && (
          <p className="font-mono text-xs text-dim">
            No trips yet. Group events into a trip to track PTO and buffers.
          </p>
        )}
        {trips.map((t) => (
          <button
            key={t.id}
            onClick={() => setEditing(t)}
            className="card rounded-lg p-3 text-left"
          >
            <div className="flex justify-between items-baseline">
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="font-mono text-[11px] text-cyan">
                {formatRange(t.depart_date, t.return_date)}
              </p>
            </div>
            <p className="font-mono text-[10px] text-dim mt-1">
              {t.event_ids?.length ?? 0} EVENTS · BUFFER {t.buffer_days}D
              {t.pto_days != null ? ` · PTO ${t.pto_days}` : ""}
            </p>
          </button>
        ))}
        <button
          onClick={() => setEditing("new")}
          className="rounded-lg bg-cyan text-bg font-mono text-sm font-bold py-3 mt-1"
        >
          + NEW TRIP
        </button>
      </div>
    </Modal>
  );
}
