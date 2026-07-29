"use client";

import type { Settings, Trip } from "@/lib/types";

export default function PtoBar({
  settings,
  trips,
}: {
  settings: Settings;
  trips: Trip[];
}) {
  const committed = trips.reduce((sum, t) => sum + (t.pto_days ?? 0), 0);
  const remaining = settings.pto_annual - settings.pto_used - committed;
  const over = remaining < 0;

  return (
    <div className="mt-3 card rounded-lg px-3 py-2 flex justify-between font-mono text-[11px]">
      <span className="text-dim">
        PTO USED <span className="text-fg">{settings.pto_used}</span>
      </span>
      <span className="text-dim">
        COMMITTED <span className="text-cyan">{committed}</span>
      </span>
      <span className="text-dim">
        LEFT{" "}
        <span className={over ? "text-red font-bold" : "text-green"}>
          {remaining}
        </span>
        {over ? " OVER!" : ""}
      </span>
    </div>
  );
}
