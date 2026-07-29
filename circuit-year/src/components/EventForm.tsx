"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { CircuitEvent, Confidence, EventCategory, EventStatus } from "@/lib/types";
import Modal from "./Modal";

const CATEGORIES: EventCategory[] = [
  "circuit",
  "sex_positive",
  "fetish",
  "cruise",
  "pride",
  "edm",
  "other",
];
const STATUSES: EventStatus[] = [
  "rumored",
  "announced",
  "on_sale",
  "sold_out",
  "past",
  "cancelled",
];
const CONFIDENCES: Confidence[] = ["high", "medium", "low"];

const inputCls =
  "card rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan w-full";
const labelCls = "font-mono text-[10px] tracking-widest text-dim mb-1 block";

export default function EventForm({
  event,
  onClose,
  onSaved,
}: {
  event: CircuitEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: event?.name ?? "",
    series: event?.series ?? "",
    producer: event?.producer ?? "",
    city: event?.city ?? "",
    country: event?.country ?? "",
    airport_code: event?.airport_code ?? "",
    venue: event?.venue ?? "",
    start_date: event?.start_date ?? "",
    end_date: event?.end_date ?? "",
    category: event?.category ?? ("circuit" as EventCategory),
    status: event?.status ?? ("announced" as EventStatus),
    ticket_url: event?.ticket_url ?? "",
    description: event?.description ?? "",
    confidence: event?.confidence ?? ("high" as Confidence),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    const row = {
      ...f,
      series: f.series || null,
      producer: f.producer || null,
      city: f.city || null,
      country: f.country || null,
      airport_code: f.airport_code ? f.airport_code.toUpperCase() : null,
      venue: f.venue || null,
      ticket_url: f.ticket_url || null,
      description: f.description || null,
      end_date: f.end_date || f.start_date,
      source_type: event ? undefined : "manual",
      updated_at: new Date().toISOString(),
    };
    const q = event
      ? supabase.from("events").update(row).eq("id", event.id)
      : supabase.from("events").insert(row);
    const { error } = await q;
    setBusy(false);
    if (error) setError(error.message);
    else onSaved();
  }

  async function remove() {
    if (!event || !confirm(`Delete "${event.name}"?`)) return;
    setBusy(true);
    await getSupabase().from("events").delete().eq("id", event.id);
    onSaved();
  }

  return (
    <Modal title={event ? "EDIT EVENT" : "NEW EVENT"} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <div>
          <label className={labelCls}>NAME</label>
          <input
            required
            className={inputCls}
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>SERIES</label>
            <input
              className={inputCls}
              value={f.series}
              onChange={(e) => set("series", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>PRODUCER</label>
            <input
              className={inputCls}
              value={f.producer}
              onChange={(e) => set("producer", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>CITY</label>
            <input
              className={inputCls}
              value={f.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>COUNTRY</label>
            <input
              className={inputCls}
              value={f.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>AIRPORT</label>
            <input
              className={`${inputCls} uppercase`}
              maxLength={3}
              value={f.airport_code}
              onChange={(e) => set("airport_code", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>VENUE</label>
          <input
            className={inputCls}
            value={f.venue}
            onChange={(e) => set("venue", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>START</label>
            <input
              required
              type="date"
              className={inputCls}
              value={f.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>END</label>
            <input
              type="date"
              className={inputCls}
              value={f.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>CATEGORY</label>
            <select
              className={inputCls}
              value={f.category}
              onChange={(e) => set("category", e.target.value as EventCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>STATUS</label>
            <select
              className={inputCls}
              value={f.status}
              onChange={(e) => set("status", e.target.value as EventStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>DATE CONF</label>
            <select
              className={inputCls}
              value={f.confidence}
              onChange={(e) => set("confidence", e.target.value as Confidence)}
            >
              {CONFIDENCES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>TICKET URL</label>
          <input
            type="url"
            className={inputCls}
            value={f.ticket_url}
            onChange={(e) => set("ticket_url", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>NOTES</label>
          <textarea
            rows={2}
            className={inputCls}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        {error && <p className="font-mono text-xs text-red">{error}</p>}
        <div className="flex gap-2 mt-1">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-magenta text-bg font-mono text-sm font-bold py-3 disabled:opacity-50"
          >
            {busy ? "..." : "SAVE"}
          </button>
          {event && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-lg border border-red/50 text-red font-mono text-sm px-4"
            >
              DELETE
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
