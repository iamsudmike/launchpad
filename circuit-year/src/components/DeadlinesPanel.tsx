"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { CircuitEvent, Deadline, DeadlineKind } from "@/lib/types";
import Modal from "./Modal";

const KINDS: DeadlineKind[] = [
  "on_sale",
  "book_flight",
  "book_hotel",
  "resale_watch",
  "decide_by",
  "custom",
];

const inputCls =
  "card rounded-lg px-3 py-2 text-sm outline-none focus:border-amber w-full";
const labelCls = "font-mono text-[10px] tracking-widest text-dim mb-1 block";

export default function DeadlinesPanel({
  deadlines,
  eventNames,
  events,
  onClose,
  onToggle,
  onChanged,
}: {
  deadlines: Deadline[];
  eventNames: Map<string, string>;
  events: CircuitEvent[];
  onClose: () => void;
  onToggle: (id: string, done: boolean) => void;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({
    kind: "custom" as DeadlineKind,
    due_date: "",
    note: "",
    event_id: "",
  });
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await getSupabase().from("deadlines").insert({
      kind: f.kind,
      due_date: f.due_date,
      note: f.note || null,
      event_id: f.event_id || null,
      done: false,
    });
    setBusy(false);
    setAdding(false);
    setF({ kind: "custom", due_date: "", note: "", event_id: "" });
    onChanged();
  }

  async function remove(id: string) {
    await getSupabase().from("deadlines").delete().eq("id", id);
    onChanged();
  }

  const pending = deadlines.filter((d) => !d.done);
  const done = deadlines.filter((d) => d.done);

  return (
    <Modal title="DEADLINES" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {adding ? (
          <form onSubmit={add} className="card rounded-lg p-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>KIND</label>
                <select
                  className={inputCls}
                  value={f.kind}
                  onChange={(e) =>
                    setF((p) => ({ ...p, kind: e.target.value as DeadlineKind }))
                  }
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>DUE</label>
                <input
                  required
                  type="date"
                  className={inputCls}
                  value={f.due_date}
                  onChange={(e) =>
                    setF((p) => ({ ...p, due_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>EVENT (OPTIONAL)</label>
              <select
                className={inputCls}
                value={f.event_id}
                onChange={(e) =>
                  setF((p) => ({ ...p, event_id: e.target.value }))
                }
              >
                <option value="">none</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>NOTE</label>
              <input
                className={inputCls}
                value={f.note}
                onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-amber text-bg font-mono text-sm font-bold py-2.5"
              >
                ADD
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-line text-dim font-mono text-sm px-4"
              >
                CANCEL
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg bg-amber text-bg font-mono text-sm font-bold py-2.5"
          >
            + NEW DEADLINE
          </button>
        )}

        {pending.map((d) => (
          <div key={d.id} className="card rounded-lg p-3 flex items-start gap-3">
            <input
              type="checkbox"
              checked={false}
              onChange={() => onToggle(d.id, true)}
              className="mt-1 accent-[#ffb84d]"
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-amber">
                {d.due_date} · {d.kind.toUpperCase()}
              </p>
              <p className="text-sm">
                {d.event_id ? eventNames.get(d.event_id) : ""}
                {d.note ? (d.event_id ? `: ${d.note}` : d.note) : ""}
              </p>
            </div>
            <button
              onClick={() => remove(d.id)}
              className="font-mono text-xs text-dim"
              aria-label="Delete deadline"
            >
              ✕
            </button>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <p className="font-mono text-[10px] tracking-widest text-dim mt-2">
              DONE
            </p>
            {done.map((d) => (
              <div
                key={d.id}
                className="card rounded-lg p-3 flex items-start gap-3 opacity-50"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => onToggle(d.id, false)}
                  className="mt-1 accent-[#3dffa6]"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-dim line-through">
                    {d.due_date} · {d.kind.toUpperCase()}
                  </p>
                  <p className="text-sm line-through">
                    {d.event_id ? eventNames.get(d.event_id) : ""}
                    {d.note ? (d.event_id ? `: ${d.note}` : d.note) : ""}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
