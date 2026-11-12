# Task 15: Jetour scraper

**Precondition:** `docs/operators/jetour.md` starts with `APPROVED`. If it says `DROPPED`, skip this task.

**Goal:** turn Jetour (捷旅, jetour.com.hk) tour pages into `ScrapedTour` objects, proven against the saved fixtures.

**Files:**
- Create: `packages/scraper/src/operators/jetour/discover.ts`, `parse.ts`, `index.ts`
- Create: `packages/scraper/src/operators/jetour/fixtures/multi-city.expected.json`, `simple.expected.json`, `edge.expected.json`
- Test: `packages/scraper/src/operators/jetour/discover.test.ts`, `parse.test.ts`
- Modify: `packages/core/src/places/data.json` (add any place this operator's fixtures need)

**Interfaces:**
- Consumes: `OperatorScraper`, `Fetcher` (Task 13); `readSitemapUrls` (Task 13); `ScrapedTour`, `scrapedTourSchema`, `parsePriceHkd` (Task 2); `normaliseTour`, `places` (Tasks 3, 5); the findings in `docs/operators/jetour.md` and the fixtures (Task 14).
- Produces:

```ts
export function isTourUrl(url: string): boolean;          // discover.ts
export async function discover(fetcher: Fetcher): Promise<string[]>;
export function parse(html: string, url: string): ScrapedTour | null; // parse.ts
export const jetourScraper: OperatorScraper;              // index.ts, id 'jetour'
```

## Expected-output files

Each `<name>.expected.json` is written **by hand from reading the fixture and the live page**, never by running the parser:

```json
{
  "sourceUrl": "https://www.jetour.com.hk/...",
  "scraped": { "...a full ScrapedTour, or null if this page should not parse..." },
  "stopNames": ["曼谷", "芭堤雅"]
}
```

`stopNames` is the route a person would write down from the day headings, as city `nameZh` values (region name where only a region is given), without Hong Kong.

## Parser rules

- Follow the selectors and JSON paths recorded in `docs/operators/jetour.md`. Prefer embedded structured data over visual layout.
- `code`: the operator's own tour code. `url`: the page URL without query string or fragment.
- `dayHeadings`: the heading text of each itinerary day only. Never the day's description.
- `departures`: every listed date not marked full or closed, as `YYYY-MM-DD`, with its price or null. Years: if a date is shown without a year, take the nearest future occurrence relative to the fixture's capture date; make `parse` accept an optional third argument `today?: IsoDate` for this and pass it in tests.
- `startPoint` / `endPoint`: only when the page states a gathering or dismissal place; otherwise null.
- Return null (do not throw) for a page that is not a single tour, or is missing a code or day count.
- If the findings say a `/tour/<CODE>` page lists several tours, `discover` must reach the single-tour pages (as the findings document describes) and `isTourUrl` must describe those.

## Steps

- [ ] **Step 1: Write the three `expected.json` files by hand.**

- [ ] **Step 2: Owner step.** The owner opens each `sourceUrl` and confirms days, price, the first three departure dates and the route in `expected.json` against the live page. Any date that has since passed is fine; a wrong city or price is not. Do not continue until confirmed.

- [ ] **Step 3: Write the failing tests.**

`parse.test.ts`:

```ts
const CAPTURED = '<the date the fixtures were saved, from docs/operators/jetour.md>';
describe.each(['multi-city', 'simple', 'edge'])('jetour %s', name => {
  const html = readFixture(`${name}.html`);
  const expected = readJson(`${name}.expected.json`);
  it('parses to the hand-checked tour', () => {
    expect(parse(html, expected.sourceUrl, CAPTURED)).toEqual(expected.scraped);
  });
  it('passes the shared schema', () => {
    if (expected.scraped) expect(scrapedTourSchema.safeParse(parse(html, expected.sourceUrl, CAPTURED)).success).toBe(true);
  });
  it('yields the hand-checked route', () => {
    if (!expected.scraped) return;
    const r = normaliseTour(parse(html, expected.sourceUrl, CAPTURED)!, places, CAPTURED);
    expect(r.ok).toBe(true);
    expect(r.ok && stopNames(r.tour.stops)).toEqual(expected.stopNames);
    expect(r.unmatched).toEqual([]);
  });
});
it('returns null for a non-tour page', () => { expect(parse('<html><body>404</body></html>', 'https://www.jetour.com.hk/x')).toBeNull(); });
it('returns null for empty input without throwing', () => { expect(parse('', 'https://www.jetour.com.hk/x')).toBeNull(); });
it('never copies long prose', () => {
  const t = parse(readFixture('multi-city.html'), 'https://www.jetour.com.hk/x', CAPTURED)!;
  expect(Math.max(...t.dayHeadings.map(h => h.length))).toBeLessThanOrEqual(80);
});
```

`discover.test.ts`: a table of at least 6 real URLs from the findings document — 3 tour pages (`true`) and 3 non-tour pages from the same sitemap (`false`) — through `isTourUrl`; and one test that `discover` with a fake `Fetcher` serving a small sitemap returns only the tour URLs, de-duplicated.

- [ ] **Step 4: Run** `pnpm vitest run packages/scraper/src/operators/jetour` — Expected: FAIL.
- [ ] **Step 5: Implement** `discover.ts`, `parse.ts`, `index.ts`. If the route test reports unmatched names that are real places, add them to `packages/core/src/places/data.json` (and keep Task 3's consistency test passing).
- [ ] **Step 6: Run the tests, then `pnpm test`** — Expected: all PASS.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(scraper): jetour scraper"`
