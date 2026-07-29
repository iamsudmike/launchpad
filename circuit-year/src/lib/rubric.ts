// Relevance scoring rubric. Seeded into settings.taste_profile and used as
// the fallback when the settings row is unavailable. Only this rubric and the
// pasted event text are ever sent to the Anthropic API: never RSVP history,
// never trip or PTO data.
export const SCORING_RUBRIC = `Score each event 0-100 for this user.

Core (+heavy): circuit parties and derivatives; all-night formats (22:00 to sunrise or longer); sex-positive events with real play space (KitKat Piepshow, Snax, Headrush x Damage lineage); gay cruises (Atlantis, La Demence); large international gay gatherings.

Positive (+moderate): strong production values; iconic or twice-a-year-only events; events that chain geographically with others (shared trip = multiplier); Asia and Europe destinations; pool/beach daytime formats attached to night events.

Neutral to negative: mainstream EDM festivals (mixed straight crowd, daytime, curfew) score low unless they chain into a core trip; bar nights and small local events score low; anything requiring a dedicated long-haul flight for a single short event loses points.

Hard context: home base is Seattle (SEA). PTO is scarce; events that ride weekends, company holidays, or extend an existing trip get a bonus.

Output per event: score, one-sentence reason.`;
