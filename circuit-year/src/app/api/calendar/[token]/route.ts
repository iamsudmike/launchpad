import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildCalendar } from "@/lib/ics";
import type { CircuitEvent, Deadline, Rsvp, Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-f0-9-]{36}$/.test(token)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const admin = getAdminClient();
  const { data: settings } = await admin
    .from("settings")
    .select("id")
    .eq("ics_token", token)
    .maybeSingle();
  if (!settings) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [{ data: events }, { data: rsvps }, { data: trips }, { data: deadlines }] =
    await Promise.all([
      admin.from("events").select("*"),
      admin.from("rsvps").select("*"),
      admin.from("trips").select("*"),
      admin.from("deadlines").select("*"),
    ]);

  const going = new Set(
    ((rsvps ?? []) as Rsvp[])
      .filter((r) => r.state === "going")
      .map((r) => r.event_id),
  );
  const allEvents = (events ?? []) as CircuitEvent[];
  const goingEvents = allEvents.filter((e) => going.has(e.id));
  const names = new Map(allEvents.map((e) => [e.id, e.name]));

  const ics = buildCalendar(
    goingEvents,
    (trips ?? []) as Trip[],
    (deadlines ?? []) as Deadline[],
    names,
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="circuit-year.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
