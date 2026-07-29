-- Seed data for The Circuit Year. Run once after 0001_init.sql.
-- Dates verified as of late July 2026; confidence noted per event.

insert into events (id, name, series, producer, city, country, airport_code, start_date, end_date, category, status, confidence, description, source_type) values
  ('00000000-0000-4000-8000-000000000001', 'WorldPride Amsterdam finale', 'WorldPride', null, 'Amsterdam', 'Netherlands', 'AMS', '2026-07-25', '2026-08-03', 'pride', 'on_sale', 'high', 'FunHouse, WPMF, AFTER. Closing stretch of WorldPride.', 'manual'),
  ('00000000-0000-4000-8000-000000000002', 'X-Formosa + Taiwan Pride', 'X-Formosa', null, 'Taipei', 'Taiwan', 'TPE', '2026-10-30', '2026-11-01', 'circuit', 'on_sale', 'high', 'Pride Saturday Oct 31. Ticketed.', 'manual'),
  ('00000000-0000-4000-8000-000000000003', 'EDC Thailand', 'EDC', 'Insomniac', 'Phuket', 'Thailand', 'HKT', '2026-12-18', '2026-12-20', 'edm', 'on_sale', 'high', 'Mainstream EDM. Only worth it if it chains into the WPB trip.', 'manual'),
  ('00000000-0000-4000-8000-000000000004', 'White Party Bangkok', 'White Party', null, 'Bangkok', 'Thailand', 'BKK', '2026-12-29', '2027-01-02', 'circuit', 'announced', 'medium', 'NYE flagship. Confirm dates at the August on-sale.', 'manual'),
  ('00000000-0000-4000-8000-000000000005', 'Pre-cruise Miami weekend', null, null, 'Miami', 'USA', 'MIA', '2027-03-05', '2027-03-07', 'circuit', 'announced', 'medium', 'Check whether Winter Party overlaps this weekend.', 'manual'),
  ('00000000-0000-4000-8000-000000000006', 'Atlantis Mega Caribbean', 'Atlantis', 'Atlantis Events', 'Miami', 'USA', 'MIA', '2027-03-07', '2027-03-14', 'cruise', 'on_sale', 'high', 'Allure of the Seas. Booked.', 'manual'),
  ('00000000-0000-4000-8000-000000000007', 'White Party Palm Springs', 'White Party', 'Jeffrey Sanker Presents', 'Palm Springs', 'USA', 'PSP', '2027-03-26', '2027-03-28', 'circuit', 'announced', 'high', null, 'manual'),
  ('00000000-0000-4000-8000-000000000008', 'Snax', 'Snax', 'Berghain', 'Berlin', 'Germany', 'BER', '2027-03-27', '2027-03-27', 'fetish', 'announced', 'high', 'Berghain. Same weekend as WPPS.', 'manual'),
  ('00000000-0000-4000-8000-000000000009', 'gCircuit Songkran', 'gCircuit', 'gCircuit', 'Bangkok', 'Thailand', 'BKK', '2027-04-09', '2027-04-12', 'circuit', 'announced', 'high', 'Songkran flagship.', 'manual'),
  ('00000000-0000-4000-8000-00000000000a', 'Phuket Pride extension', null, null, 'Phuket', 'Thailand', 'HKT', '2027-04-14', '2027-04-18', 'pride', 'rumored', 'low', 'Possible extension after Songkran.', 'manual'),
  ('00000000-0000-4000-8000-00000000000b', 'Circuit Festival Asia', 'Circuit Festival', 'Matinee Group', 'Pattaya', 'Thailand', 'PYX', '2027-06-04', '2027-06-06', 'circuit', 'announced', 'high', null, 'manual'),
  ('00000000-0000-4000-8000-00000000000c', 'The Cruise by La Demence', 'La Demence', 'La Demence', 'Barcelona', 'Spain', 'BCN', '2027-07-15', '2027-07-24', 'cruise', 'on_sale', 'high', 'Cabins price by category and good ones go first.', 'manual'),
  ('00000000-0000-4000-8000-00000000000d', 'Circuit Festival Barcelona', 'Circuit Festival', 'Matinee Group', 'Barcelona', 'Spain', 'BCN', '2027-08-05', '2027-08-15', 'circuit', 'announced', 'low', 'Early August window, exact dates TBC.', 'manual');

insert into rsvps (event_id, state) values
  ('00000000-0000-4000-8000-000000000001', 'going'),
  ('00000000-0000-4000-8000-000000000002', 'going'),
  ('00000000-0000-4000-8000-000000000003', 'undecided'),
  ('00000000-0000-4000-8000-000000000004', 'going'),
  ('00000000-0000-4000-8000-000000000005', 'going'),
  ('00000000-0000-4000-8000-000000000006', 'going'),
  ('00000000-0000-4000-8000-000000000007', 'skip'),
  ('00000000-0000-4000-8000-000000000008', 'skip'),
  ('00000000-0000-4000-8000-000000000009', 'going'),
  ('00000000-0000-4000-8000-00000000000a', 'undecided'),
  ('00000000-0000-4000-8000-00000000000b', 'undecided'),
  ('00000000-0000-4000-8000-00000000000c', 'undecided'),
  ('00000000-0000-4000-8000-00000000000d', 'undecided');

insert into deadlines (event_id, kind, due_date, note) values
  ('00000000-0000-4000-8000-000000000004', 'on_sale', '2026-08-15', 'WPB tickets expected on sale August 2026'),
  ('00000000-0000-4000-8000-00000000000c', 'decide_by', '2026-09-15', 'La Demence cabin decision: cabins price by category and good ones go first'),
  ('00000000-0000-4000-8000-000000000004', 'book_flight', '2026-09-30', 'Book WPB flights Sep-Oct. Return Jan 4-5, not Jan 2'),
  ('00000000-0000-4000-8000-000000000005', 'book_hotel', '2026-11-15', 'Miami hotel for pre-cruise weekend'),
  ('00000000-0000-4000-8000-000000000009', 'book_flight', '2026-12-15', 'Songkran flights');

insert into settings (id, pto_annual, pto_used, home_airport, taste_profile) values
  (1, 20, 0, 'SEA', jsonb_build_object('rubric',
$$Score each event 0-100 for this user.

Core (+heavy): circuit parties and derivatives; all-night formats (22:00 to sunrise or longer); sex-positive events with real play space (KitKat Piepshow, Snax, Headrush x Damage lineage); gay cruises (Atlantis, La Demence); large international gay gatherings.

Positive (+moderate): strong production values; iconic or twice-a-year-only events; events that chain geographically with others (shared trip = multiplier); Asia and Europe destinations; pool/beach daytime formats attached to night events.

Neutral to negative: mainstream EDM festivals (mixed straight crowd, daytime, curfew) score low unless they chain into a core trip; bar nights and small local events score low; anything requiring a dedicated long-haul flight for a single short event loses points.

Hard context: home base is Seattle (SEA). PTO is scarce; events that ride weekends, company holidays, or extend an existing trip get a bonus.

Output per event: score, one-sentence reason.$$));

insert into sources (url, name) values
  ('https://clubrapido.com', 'Rapido'),
  ('https://circuitpartyinfo.com', 'Circuit Party Info'),
  ('https://gcircuitparty.com', 'gCircuit'),
  ('https://whitepartybangkok.com', 'White Party Bangkok'),
  ('https://atlantisevents.com', 'Atlantis Events'),
  ('https://the-cruise.eu', 'La Demence Cruise'),
  ('https://circuitfestival.net', 'Circuit Festival'),
  ('https://gaytravel4u.com/top-gay-events-by-month', 'GayTravel4u monthly list');
