# Hong Kong Tour Comparison — Design

Date: 2026-11-12

## What this is and why

A website that gathers package-tour listings from Hong Kong tour operators into
one place, so a traveller can filter and compare them without visiting each
operator's site, and can **chain** tours: pick one tour, choose a break of a few
days, and see every tour from any operator that starts after that break.

Chaining is the distinctive feature. No operator offers it, and it is the reason
the project exists. Plain comparison is the foundation it stands on.

The owner is a student building this as a portfolio project that could later
become commercial. It must cost nothing to run for now.

## Goals

1. Nightly, automatically collect tour listings from four operators.
2. Let a visitor filter tours by destination, departure date, length, price and
   operator, and sort the results.
3. Let a visitor build a chain of two or more tours separated by a chosen gap.
4. Show each tour as a card built only from facts, linking to the operator's
   page for everything else.
5. Stay within each operator's published crawling rules.

## Non-goals (first version)

- User accounts, login, saved trips, bookings or payments.
- Attraction names on cards. Cities only.
- Seat availability or "guaranteed departure" status.
- More than one scrape per day.
- Long-term price history (only a rolling 7 days is kept).
- Operators beyond the first four (see "Operators").
- Simplified Chinese.
- Automatic suggestion of whole chains from a date range. The visitor builds the
  chain one leg at a time.
- A rule restricting the next leg by departure location (see "Chaining").

## Anti-goals

These would make the project a failure even if it works:

- Copying operators' itinerary prose or photos. Only facts are stored and shown.
- Getting around bot protection, logging in, or calling endpoints an operator's
  robots.txt disallows.
- Loading operators' sites heavily enough to be noticed.
- Showing stale data as if it were live. Every card shows when it was last
  updated.
- Implying affiliation with any operator.
- English appearing as a language choice for visitors.

## Constraints

- **Cost:** free tiers only. Vercel (hobby), Supabase (free), GitHub Actions.
- **Language:** the public site is Traditional Chinese only. English strings
  exist for the developer and are switched on by a developer-only setting
  (environment variable); there is no language switcher in the UI.
- **Legal posture:** facts only, link out for detail, obey robots.txt, slow
  request rate, an honest User-Agent that identifies the project. This has not
  been reviewed by a lawyer, and operators' terms of use have not been read;
  reading them for the four operators is a task before public launch.
- **Database is hosted**, never local-only.

## How it gets made (decided with the owner)

- **Language:** TypeScript throughout.
- **Website:** Next.js, hosted on Vercel.
- **Database:** Postgres on Supabase.
- **Scrapers:** Crawlee. A separate program from the website; it runs on a
  schedule and writes to the database. The website only reads from the database
  and never contacts operators.
- **Schedule:** one run per night via a GitHub Actions schedule, starting and
  finishing between 02:00 and 05:00 Hong Kong time. The four operators run as
  parallel jobs so the whole run fits in that window.
- **Repository:** public on GitHub, which makes the scheduled runs free.
- **No AI at runtime.** Scraping is an ordinary program.
- **Development method:** test-driven, with a task list in the repo. Scrapers
  are tested against saved copies of real operator pages.

## Operators

First version, all confirmed reachable without a browser on 2026-11-12:

| Operator | Site | What was found |
|---|---|---|
| EGL Tours 東瀛遊 | egltours.com | Sitemap (~1,200 URLs); itinerary pages at `/website/itinerary/<code>` carry the price in HTML. robots.txt disallows search-result pages and several booking paths. Only one date was visible in the raw HTML of the sample page, so departure dates may load separately; to be confirmed. |
| Jetour 捷旅 | jetour.com.hk | robots.txt allows everything. Sitemap (~1,400 URLs), tour pages at `/tour/<code>` with prices and dates in HTML. |
| Travel Expert 專業旅運 | texpert.com | Tour sitemap (117 tours) at `/sitemap/sitemap_tour_zh-hk.xml`; prices and dates in HTML. robots.txt disallows `/api/` and booking paths. |
| Big Line Holiday 大航假期 | bigline.hk | robots.txt allows everything. Sitemap (~690 URLs), tour pages at `/tour-group/<id>`; data is embedded in the page as JSON state, not plain text. |

Each operator's exact page structure still has to be studied when its scraper
is written; the notes above are from single sample pages.

**If an operator's departure dates cannot be read within the rules** (for
example EGL's turn out to come only from a disallowed endpoint), that operator
is dropped from this version and the build continues with the rest. Every tour
in the database has at least one dated departure; there is no "tour without
dates" case. Confirming this for each operator is an early investigation task,
done before its scraper is built. *(Designer's call.)*

**Terms of use:** reading the four operators' terms is an early task, done
before the nightly scrape is switched on against live sites. Scraper
development before then works from a small number of saved pages. If an
operator's terms forbid automated access, the owner decides whether to drop it
or ask permission. *(Designer's call.)*

Later, not in this version: Wing On (likely needs a real browser; its API is
disallowed), Sunflower, China Travel Service. WWPKG and Goldjoy block bots and
are excluded unless they give permission. Hong Thai, Miramar and Charming are
unverified.

## Data

What is stored per tour (facts only):

- operator, the operator's own tour code, and the URL of the operator's page
- tour title (short, as the operator names it; used for search and debugging,
  not as the card headline)
- length in days (and nights where stated)
- the ordered list of cities visited
- the countries and regions those cities belong to
- start point and end point where the operator states them; assumed Hong Kong
  when not stated
- departure dates found in the latest scrape, each with its price where the
  operator prices dates individually
- the lowest "from" price across upcoming departures
- when it was first seen and last seen

Supporting data:

- **Places list:** country → region → city, with Chinese names and alternate
  spellings. It powers the destination filter, the search bar and city
  extraction. It is hand-curated and grows over time.
- **Price snapshots:** one "from" price per tour per night, kept for 8 nights
  and then deleted, to support the 7-day comparison.
- **Scrape runs:** per operator per night: when it ran, how many tours were
  found, whether it passed its checks.
- **Unmatched place names:** place-like text from itineraries that matched
  nothing in the places list, for review.

### Cities visited

Cities come from the **day-by-day headings** of the itinerary (for example
"第一天 香港 → 大阪"), matched against the places list. The body text of each day
is not used, because it mentions places that are not visited.

Hong Kong (and the stated start/end point) is not shown as a stop on the route.
Consecutive repeats are collapsed; a city revisited later in the trip is kept.

This will not be perfect. Accuracy is managed by tests with hand-checked
expected city lists for saved pages, and by the unmatched-names log.

### Availability

A departure is "available" if it appeared in last night's scrape and its date is
in the future. Where an operator clearly marks a date as full or closed, that
date is skipped and not stored; no seat status is stored or shown otherwise.
*(Designer's call.)* A tour with no upcoming departures, or not seen in the latest
successful scrape of its operator, is hidden from results.

### Price comparison

Each card compares tonight's "from" price with the snapshot from 7 nights ago.
If the tour is newer than that, it compares with the oldest snapshot available;
if there is only one snapshot, no comparison is shown. Three states: lower (with
amount), higher (with amount), unchanged.

## The nightly scrape

For each operator, independently, so one failure does not stop the others:

1. Find tour pages, preferring the operator's sitemap.
2. Fetch each page slowly (a few seconds between requests to the same site),
   honouring robots.txt.
3. Parse it into the common tour shape, preferring structured data embedded in
   the page over visual layout.
4. Check the results before saving. If an operator returns no tours, far fewer
   than the previous night, or tours missing price or length, keep the previous
   night's data for that operator and mark the run as failed.
5. Save: update existing tours, add new ones, record tonight's price snapshot,
   delete snapshots older than 8 nights.

A failed run must be visible: the GitHub Actions job fails (which emails the
owner), and the site's "last updated" time for that operator stays at the last
good run.

## The website

### Destination search and filter

Two ways to choose a destination, both resulting in a country + region
selection:

- **Panels:** pick a country, then a region within it, as on existing operator
  sites. "All regions" of a country is allowed.
- **Search bar** at the top: the visitor types a country, region or city. A
  dropdown suggests the closest matching regions, always written
  `Country → Region` so similar names in different countries are
  distinguishable. Choosing a suggestion sets the filter. Typing a city (大阪)
  suggests the region containing it (日本 → 關西).

A tour matches a destination if **any** stop on its route is in that region:
first, intermediate or last. It does not have to start there.

### Other filters and sorting

Departure date range, length in days, price range, operator. Sort by price,
length, departure date or destination.

### Tour card

- Operator tag (in the operator's assigned colour) and `country · region`
- Route as the headline: 大阪 → 京都 → 奈良 → 神戶
- Length (5日4夜)
- Lowest "from" price, with the 7-day comparison beneath it
- The next few departure dates as chips, with "+N more"
- "Last updated" time
- A visible note of the start or end point **only when it is not Hong Kong or
  Shenzhen** (for example 澳門出發). *(Designer's reading of the owner's
  "start and end points only matter when not HK or SZ".)*
- Clicking the card opens the operator's page in a new tab
- A separate 加入行程 button, which does not open the operator's page. It opens
  a small list of that tour's departure dates (with each date's price where
  known); choosing a date starts a chain with that tour, or adds it as the next
  leg. In the chain list the button offers only the dates inside the gap window.

No photos and no descriptive text.

### Chaining

1. The visitor picks a first tour **and a departure date** for it.
2. They set a gap range. Default 1–3 days; the visitor can change both ends.
3. The site lists every tour, from any operator, with a departure inside the
   window that follows.
4. That list has the same filters and sorting as the main search (destination,
   length, price, operator), except the date filter is replaced by the gap
   range.
5. Picking one adds it as the next leg. The visitor can keep adding legs, and
   can remove the last leg.
6. The chain is shown as a strip at the top with each leg, the gaps between
   them, and a running total of price and days.

Definitions:

- A tour's end date is its departure date plus its length in days, minus one.
- The gap is the number of full free days between one tour's end date and the
  next tour's departure date. A tour ending 22 Dec with a gap of 1–3 days allows
  departures on 24, 25 or 26 Dec. A gap of 0 (leave the next morning) is
  allowed. *(This definition is the designer's call; the mockup showed the
  window one day earlier.)*

**Prices in a chain:** each leg uses the price of its chosen departure date
where the operator prices dates individually, and otherwise the tour's "from"
price, shown with 起 so the total is not read as exact. The chain list's price
filter and sort use the cheapest departure inside the window. *(Designer's
call.)*

**Excluding countries:** the chain list has one extra filter the main search
does not: exclude a country (as in the mockup's 排除：日本). It is off by
default. *(Designer's call.)*

The next leg does not have to be a different destination; destination is just a
filter. There is no departure-location rule in this version: start and end
points are recorded, and a "next leg must start near where the last one ended"
rule can be added later if the data shows tours that don't start and end in the
Hong Kong / Shenzhen area.

Because there are no accounts, the chain lives in the page address, so it
survives a reload and can be shared as a link. *(Designer's call.)*

### Look

Mockups approved by the owner are saved in
`.superpowers/brainstorm/3-1794510357/content/cards-and-chaining-v2.html`.

Site palette:

| Name | Hex | Use |
|---|---|---|
| Snow | `#fffcff` | Page background |
| Charcoal | `#50514f` | Text, top navigation bar |
| Cerulean | `#247ba0` | Actions and emphasis: search box, selected filters, gap selector, prices, links |
| Ash grey | `#cbd4c2` | Card borders, date chips, chain strip background |
| Khaki beige | `#c3b299` | Quiet details: route arrows, unselected filter outlines, gap line |

Operator colours are deliberately outside this palette and away from its blue.
They are arbitrary, not the companies' brand colours: EGL red `#d62839`, Jetour
orange `#ee7b06`, Travel Expert purple `#7d3cc8`, Big Line green `#2a9d4b`.
Reserved for later operators: pink `#d6338a`, gold `#b8860b`, teal `#0f8b8d`.

Price-change markers: muted green for a drop, muted red for a rise, grey for
unchanged.

The site states plainly that it is not affiliated with the operators and that
prices and dates must be confirmed on the operator's site.

## Testing

- **Scrapers:** for each operator, saved copies of real pages with hand-checked
  expected output (length, price, departure dates, city list).
- **City extraction:** a table of heading strings and expected city lists,
  including ambiguous and unmatched names.
- **Destination matching:** a tour matches when the place is a first,
  intermediate or last stop.
- **Search suggestions:** city, region and country inputs produce the right
  `Country → Region` suggestions.
- **Chaining:** date arithmetic for end dates and gap windows, including gap 0,
  month and year boundaries.
- **Price comparison:** lower, higher, unchanged, fewer than 7 nights of data,
  a single snapshot.
- **Scrape checks:** a bad run keeps the previous night's data.
- **Appearance** is checked by eye against the mockup.

## Left to the builder

- Repository layout, package manager, and how the scraper and website share the
  tour type.
- Database schema, indexes, and how the website queries Supabase.
- Whether results are paginated or loaded progressively.
- How suggestion matching is implemented.
- Exact thresholds for "far fewer tours than the previous night".
- Exact request delay per site, within "a few seconds".
- How the initial places list is assembled, provided it covers every
  destination the four operators sell.
- Mobile layout, following the mockup's structure.
