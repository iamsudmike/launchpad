# The Circuit Year

Private, single-user PWA for planning a global circuit party calendar. Dark neon timeline, Going/Skip states, AI paste intake, trips with recovery buffers and PTO math, countdown hero, .ics feed for Google Calendar.

Phase 1 (this build): timeline board with RSVP states, countdown hero, event CRUD, paste intake with Claude extraction and relevance scoring, trips with buffers and PTO tracking, deadlines list, authenticated .ics feed, installable PWA with biometric app lock.

## Stack

- Next.js (App Router) PWA, deployed on Vercel
- Supabase: Postgres, RLS, Auth (single account)
- Anthropic API (claude-sonnet-4-6) for event extraction and scoring, server-side only

## Setup, start to finish

### 1. Supabase

1. Create a project at supabase.com (pick a region near you).
2. SQL Editor: run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
3. Authentication > Users > Add user: create your single account (email + strong password).
4. Authentication > Sign In / Up: disable "Allow new users to sign up".
5. Project Settings > API: copy the Project URL, anon key, and service_role key.

### 2. Deploy on Vercel

1. Import this repo into Vercel.
2. Set environment variables (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
3. Deploy. Open the URL, sign in.

### 3. Install on Android

1. Open the deployed URL in Chrome.
2. Menu > Add to Home screen > Install.
3. In the app: SETUP > ENABLE BIOMETRIC LOCK to require fingerprint on open.

### 4. Google Calendar feed

SETUP > CALENDAR FEED: copy the URL, then in Google Calendar: Settings > Add calendar > From URL. The token is revocable; REGENERATE TOKEN kills the old URL.

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

## Hardening checklist

Do all five. The app's security model assumes them.

1. **Disable signups in Supabase**: Authentication > Sign In / Up > turn off "Allow new users to sign up". Load-bearing: RLS trusts any authenticated user, and your account must be the only one that can exist. Do this right after creating your own user.
2. **Strong, unique password** on your app account. It is the front door; there is no second factor on the app itself.
3. **Turn on 2FA** on the GitHub, Vercel, and Supabase accounts. Whoever controls those consoles controls the app and the database; this is the most realistic attack path.
4. **Keep this repo private.** It holds no secrets, but the schema and seed events are themselves sensitive.
5. **Treat the calendar feed URL as a secret.** It is protected only by its unguessable token; anyone holding the exact URL can read Going events, trips, and deadlines. Revoke and regenerate it in SETUP if it ever leaks. Skipping the feed entirely is a valid choice; the app works without it.

Known residual risks, accepted by design: the .ics feed is URL-token auth because Google Calendar fetches it unauthenticated, and subscribed events get stored in your Google account; Supabase and Vercel are trusted infrastructure (encrypted at rest and in transit, not end-to-end encrypted). The biometric lock is a convenience gate, not encryption; the phone's lock screen is the real device-level protection.

## Privacy posture

- RLS on every table; anonymous access gets nothing; signups disabled so the single account is the only way in.
- No analytics, no tracking, no third-party error reporting.
- Anthropic API receives only pasted event text plus the scoring rubric. Never RSVP history, trips, or PTO data.
- The service role key and Anthropic key live only in Vercel server env vars.
- Keep this repo private.

## Repo layout

- `src/app` pages and API routes (`/api/intake` extraction, `/api/calendar/[token]` ics feed)
- `src/components` board UI
- `src/lib` supabase clients, ics builder, PTO math, scoring rubric
- `supabase/` schema migration and seed data
- `scripts/gen-icons.mjs` regenerates PWA icons, no image deps

## Roadmap

- Phase 2: deadline engine (daily GitHub Action), Web Push delivery, review queue UI
- Phase 3: iCal/API probe and fetch-extract crawler over the `sources` table
- Never: multi-user, social, public listing
