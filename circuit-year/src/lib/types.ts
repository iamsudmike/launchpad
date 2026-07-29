export type EventCategory =
  | "circuit"
  | "sex_positive"
  | "fetish"
  | "cruise"
  | "pride"
  | "edm"
  | "other";

export type EventStatus =
  | "rumored"
  | "announced"
  | "on_sale"
  | "sold_out"
  | "past"
  | "cancelled";

export type Confidence = "high" | "medium" | "low";
export type RsvpState = "going" | "skip" | "undecided";

export type DeadlineKind =
  | "on_sale"
  | "book_flight"
  | "book_hotel"
  | "resale_watch"
  | "decide_by"
  | "custom";

export interface CircuitEvent {
  id: string;
  name: string;
  series: string | null;
  producer: string | null;
  city: string | null;
  country: string | null;
  airport_code: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  category: EventCategory;
  status: EventStatus;
  ticket_url: string | null;
  price_low: number | null;
  price_high: number | null;
  currency: string | null;
  description: string | null;
  source_url: string | null;
  source_type: "paste" | "crawl" | "manual" | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  confidence: Confidence;
  created_at: string;
  updated_at: string;
}

export interface Rsvp {
  event_id: string;
  state: RsvpState;
  updated_at: string;
}

export interface Trip {
  id: string;
  name: string;
  depart_date: string;
  return_date: string;
  buffer_days: number;
  pto_days: number | null;
  notes: string | null;
  event_ids: string[];
}

export interface Deadline {
  id: string;
  event_id: string | null;
  trip_id: string | null;
  kind: DeadlineKind;
  due_date: string;
  note: string | null;
  done: boolean;
}

export interface Settings {
  id: number;
  pto_annual: number;
  pto_used: number;
  home_airport: string;
  company_holidays: string[];
  taste_profile: Record<string, unknown> | null;
  ics_token: string | null;
}

export interface ExtractedEvent {
  name: string;
  series: string | null;
  producer: string | null;
  city: string | null;
  country: string | null;
  airport_code: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  category: EventCategory;
  status: EventStatus;
  ticket_url: string | null;
  price_low: number | null;
  price_high: number | null;
  currency: string | null;
  description: string | null;
  relevance_score: number;
  relevance_reason: string;
  confidence: Confidence;
}
