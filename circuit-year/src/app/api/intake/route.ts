import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { SCORING_RUBRIC } from "@/lib/rubric";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_events",
  description: "Record every distinct party/event found in the source material.",
  input_schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            series: { type: ["string", "null"] },
            producer: { type: ["string", "null"] },
            city: { type: ["string", "null"] },
            country: { type: ["string", "null"] },
            airport_code: {
              type: ["string", "null"],
              description: "IATA code of nearest major airport",
            },
            venue: { type: ["string", "null"] },
            start_date: { type: "string", description: "YYYY-MM-DD" },
            end_date: { type: "string", description: "YYYY-MM-DD" },
            start_time: { type: ["string", "null"], description: "HH:MM 24h" },
            end_time: { type: ["string", "null"], description: "HH:MM 24h" },
            category: {
              type: "string",
              enum: [
                "circuit",
                "sex_positive",
                "fetish",
                "cruise",
                "pride",
                "edm",
                "other",
              ],
            },
            status: {
              type: "string",
              enum: [
                "rumored",
                "announced",
                "on_sale",
                "sold_out",
                "past",
                "cancelled",
              ],
            },
            ticket_url: { type: ["string", "null"] },
            price_low: { type: ["number", "null"] },
            price_high: { type: ["number", "null"] },
            currency: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            relevance_score: { type: "integer", minimum: 0, maximum: 100 },
            relevance_reason: { type: "string" },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description:
                "Date certainty. Official promoter pages: high. Aggregators or inferred dates: medium/low.",
            },
          },
          required: [
            "name",
            "start_date",
            "end_date",
            "category",
            "status",
            "relevance_score",
            "relevance_reason",
            "confidence",
          ],
        },
      },
    },
    required: ["events"],
  },
};

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "circuit-year-planner/1.0 (personal calendar app)" },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  // Crude but effective HTML-to-text for LLM consumption.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .slice(0, 60000);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = getAdminClient();
  const { data: userData, error: authError } = await admin.auth.getUser(
    auth.slice(7),
  );
  if (authError || !userData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { text, url, imageBase64, imageMediaType } = body as {
    text?: string;
    url?: string;
    imageBase64?: string;
    imageMediaType?: string;
  };

  let sourceText = text?.trim() ?? "";
  let sourceUrl: string | null = null;
  if (url) {
    try {
      sourceUrl = url;
      sourceText = `${sourceText}\n\n[Fetched from ${url}]\n${await fetchUrlText(url)}`;
    } catch {
      return NextResponse.json(
        { error: `could not fetch ${url}` },
        { status: 422 },
      );
    }
  }
  if (!sourceText && !imageBase64) {
    return NextResponse.json({ error: "nothing to extract" }, { status: 400 });
  }

  let rubric = SCORING_RUBRIC;
  try {
    const { data: settings } = await admin
      .from("settings")
      .select("taste_profile")
      .limit(1)
      .maybeSingle();
    const stored = (settings?.taste_profile as { rubric?: string })?.rubric;
    if (stored) rubric = stored;
  } catch {
    // fall back to the built-in rubric
  }

  const content: Anthropic.ContentBlockParam[] = [];
  if (imageBase64 && imageMediaType) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: imageBase64,
      },
    });
  }
  content.push({
    type: "text",
    text: `Today's date is ${new Date().toISOString().slice(0, 10)}.

Extract every distinct event from the material below (and the attached image, if any) into the record_events tool. If a date is ambiguous or looks like an aggregator placeholder, still extract it but set confidence to low or medium. Single-day events use the same start and end date.

Scoring rubric:
${rubric}

Source material:
${sourceText || "(image only)"}`,
  });

  const anthropic = new Anthropic();
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "record_events" },
      messages: [{ role: "user", content }],
    });
    const toolUse = msg.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "no events found" }, { status: 422 });
    }
    const { events } = toolUse.input as { events: unknown[] };
    return NextResponse.json({ events, source_url: sourceUrl });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "extraction failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
