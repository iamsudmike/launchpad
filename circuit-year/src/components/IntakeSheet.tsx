"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { ExtractedEvent } from "@/lib/types";
import Modal from "./Modal";

export default function IntakeSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ data: string; type: string } | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<ExtractedEvent[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  async function pickImage(file: File) {
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    setImage({ data: btoa(binary), type: file.type });
    setImageName(file.name);
  }

  async function extract() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("not signed in");

      const trimmed = text.trim();
      const isUrl = /^https?:\/\/\S+$/.test(trimmed);
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: isUrl ? undefined : trimmed || undefined,
          url: isUrl ? trimmed : undefined,
          imageBase64: image?.data,
          imageMediaType: image?.type,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "extraction failed");
      const events = json.events as ExtractedEvent[];
      if (!events?.length) throw new Error("no events found in that");
      setFound(events);
      setSourceUrl(json.source_url ?? null);
      setSelected(new Set(events.map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!found) return;
    setBusy(true);
    setError(null);
    const rows = found
      .filter((_, i) => selected.has(i))
      .map((e) => ({
        ...e,
        source_url: sourceUrl,
        source_type: "paste" as const,
      }));
    const { data, error } = await getSupabase()
      .from("events")
      .insert(rows)
      .select("id");
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data?.length) {
      await getSupabase()
        .from("rsvps")
        .upsert(
          data.map((r) => ({ event_id: r.id, state: "undecided" })),
          { onConflict: "event_id" },
        );
    }
    onSaved();
  }

  return (
    <Modal title="PASTE INTAKE" onClose={onClose}>
      {!found ? (
        <div className="flex flex-col gap-3">
          <textarea
            rows={6}
            placeholder="Paste a URL, flyer text, Instagram caption, anything with event info in it."
            className="card rounded-lg px-3 py-2 text-sm outline-none focus:border-magenta w-full"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <label className="card rounded-lg px-3 py-2 text-xs text-dim cursor-pointer">
            {imageName ? `FLYER: ${imageName}` : "+ ATTACH FLYER SCREENSHOT"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pickImage(file);
              }}
            />
          </label>
          {error && <p className="font-mono text-xs text-red">{error}</p>}
          <button
            onClick={extract}
            disabled={busy || (!text.trim() && !image)}
            className="rounded-lg bg-magenta text-bg font-mono text-sm font-bold py-3 disabled:opacity-50"
          >
            {busy ? "EXTRACTING..." : "EXTRACT WITH AI"}
          </button>
          <p className="font-mono text-[10px] text-dim">
            Nothing saves until you confirm on the next step.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] tracking-widest text-dim">
            FOUND {found.length}. UNCHECK ANY YOU DO NOT WANT.
          </p>
          {found.map((e, i) => (
            <label
              key={i}
              className={`card rounded-lg p-3 flex gap-3 cursor-pointer ${
                selected.has(i) ? "border-green/50" : "opacity-50"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                className="mt-1 accent-[#3dffa6]"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{e.name}</p>
                <p className="font-mono text-[11px] text-cyan">
                  {e.start_date}
                  {e.end_date !== e.start_date ? ` to ${e.end_date}` : ""}
                  {e.confidence !== "high" && (
                    <span className="text-amber">* {e.confidence}</span>
                  )}
                </p>
                <p className="text-xs text-dim">
                  {[e.city, e.country, e.airport_code, e.category, e.status]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs mt-1">
                  <span className="chip text-magenta border-magenta/50 mr-1.5">
                    {e.relevance_score}
                  </span>
                  <span className="text-dim">{e.relevance_reason}</span>
                </p>
              </div>
            </label>
          ))}
          {error && <p className="font-mono text-xs text-red">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={saveSelected}
              disabled={busy || selected.size === 0}
              className="flex-1 rounded-lg bg-green text-bg font-mono text-sm font-bold py-3 disabled:opacity-50"
            >
              {busy ? "..." : `ADD ${selected.size} TO BOARD`}
            </button>
            <button
              onClick={() => {
                setFound(null);
                setError(null);
              }}
              className="rounded-lg border border-line text-dim font-mono text-sm px-4"
            >
              BACK
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
