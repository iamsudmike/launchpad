"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";
import Modal from "./Modal";
import { disableWebauthn, enrollWebauthn, webauthnEnrolled } from "./AuthGate";

const inputCls =
  "card rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan w-full";
const labelCls = "font-mono text-[10px] tracking-widest text-dim mb-1 block";

export default function SettingsPanel({
  settings,
  onClose,
  onChanged,
}: {
  settings: Settings;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [f, setF] = useState({
    pto_annual: String(settings.pto_annual),
    pto_used: String(settings.pto_used),
    home_airport: settings.home_airport,
    company_holidays: (settings.company_holidays ?? []).join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(webauthnEnrolled());
  const [copied, setCopied] = useState(false);

  const feedUrl =
    typeof window !== "undefined" && settings.ics_token
      ? `${location.origin}/api/calendar/${settings.ics_token}`
      : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const holidays = f.company_holidays
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    const { error } = await getSupabase()
      .from("settings")
      .update({
        pto_annual: Number(f.pto_annual),
        pto_used: Number(f.pto_used),
        home_airport: f.home_airport.toUpperCase(),
        company_holidays: holidays,
      })
      .eq("id", settings.id);
    setBusy(false);
    if (error) setError(error.message);
    else onChanged();
  }

  async function rotateToken() {
    if (
      !confirm(
        "Regenerate the calendar feed token? The old feed URL stops working and Google Calendar must be re-subscribed.",
      )
    )
      return;
    setBusy(true);
    await getSupabase()
      .from("settings")
      .update({ ics_token: crypto.randomUUID() })
      .eq("id", settings.id);
    setBusy(false);
    onChanged();
  }

  return (
    <Modal title="SETUP" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>PTO / YEAR</label>
            <input
              type="number"
              step="0.5"
              className={inputCls}
              value={f.pto_annual}
              onChange={(e) => setF((p) => ({ ...p, pto_annual: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>PTO USED</label>
            <input
              type="number"
              step="0.5"
              className={inputCls}
              value={f.pto_used}
              onChange={(e) => setF((p) => ({ ...p, pto_used: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>HOME</label>
            <input
              maxLength={3}
              className={`${inputCls} uppercase`}
              value={f.home_airport}
              onChange={(e) =>
                setF((p) => ({ ...p, home_airport: e.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>
            COMPANY HOLIDAYS (YYYY-MM-DD, ONE PER LINE)
          </label>
          <textarea
            rows={3}
            className={inputCls}
            value={f.company_holidays}
            onChange={(e) =>
              setF((p) => ({ ...p, company_holidays: e.target.value }))
            }
          />
        </div>
        {error && <p className="font-mono text-xs text-red">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-magenta text-bg font-mono text-sm font-bold py-3 disabled:opacity-50"
        >
          {busy ? "..." : "SAVE"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        <p className="font-mono text-[10px] tracking-widest text-cyan">
          CALENDAR FEED
        </p>
        {feedUrl ? (
          <>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(feedUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="card rounded-lg px-3 py-2 text-left font-mono text-[10px] text-dim break-all"
            >
              {copied ? "COPIED" : feedUrl}
            </button>
            <p className="text-xs text-dim">
              Subscribe from Google Calendar: Settings, Add calendar, From URL.
            </p>
            <button
              onClick={rotateToken}
              className="rounded-lg border border-amber/50 text-amber font-mono text-xs py-2"
            >
              REGENERATE TOKEN (REVOKES OLD URL)
            </button>
          </>
        ) : (
          <p className="text-xs text-dim">No feed token in settings row.</p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <p className="font-mono text-[10px] tracking-widest text-cyan">
          APP LOCK
        </p>
        {bio ? (
          <button
            onClick={() => {
              disableWebauthn();
              setBio(false);
            }}
            className="rounded-lg border border-line text-dim font-mono text-xs py-2"
          >
            DISABLE BIOMETRIC LOCK
          </button>
        ) : (
          <button
            onClick={async () => {
              if (await enrollWebauthn()) setBio(true);
            }}
            className="rounded-lg border border-green/50 text-green font-mono text-xs py-2"
          >
            ENABLE BIOMETRIC LOCK (FINGERPRINT / FACE)
          </button>
        )}
        <button
          onClick={async () => {
            await getSupabase().auth.signOut();
          }}
          className="rounded-lg border border-red/50 text-red font-mono text-xs py-2"
        >
          SIGN OUT
        </button>
      </div>
    </Modal>
  );
}
