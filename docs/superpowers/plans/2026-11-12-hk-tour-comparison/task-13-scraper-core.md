# Task 13: Polite fetcher, sitemap reader and operator runner

**Goal:** everything about scraping that is the same for every operator: fetching slowly and honestly, reading sitemaps, and the nightly pipeline of discover → fetch → parse → normalise → check → save.

**Files:**
- Create: `packages/scraper/src/types.ts`, `packages/scraper/src/polite-fetch.ts`, `packages/scraper/src/sitemap.ts`, `packages/scraper/src/run-operator.ts`
- Test: `packages/scraper/src/polite-fetch.test.ts`, `packages/scraper/src/sitemap.test.ts`, `packages/scraper/src/run-operator.test.ts`
- Add dependencies in `packages/scraper`: `crawlee`, `cheerio`, `@hktours/core`, `@hktours/db`

**Interfaces:**
- Consumes: `ScrapedTour`, `scrapedTourSchema`, `OperatorId` (Task 2); `PlacesIndex` (Task 3); `normaliseTour` (Task 5); `Db`, `saveOperatorRun`, `recordFailedRun`, `previousGoodTourCount` (Tasks 10–11); `checkRun` (Task 12).
- Produces:

```ts
// types.ts
export interface Fetcher {
  /** One page. null if robots.txt disallows it, or the response is not 200. */
  fetchText(url: string): Promise<string | null>;
}
export interface OperatorScraper {
  id: OperatorId;
  /** URLs of tour pages to fetch tonight, already filtered to tour pages. */
  discover(fetcher: Fetcher): Promise<string[]>;
  /** Pure function. null when the page is not a tour page or cannot be parsed. */
  parse(html: string, url: string): ScrapedTour | null;
}

// polite-fetch.ts
export const REQUEST_DELAY_MS = 3000;
export const USER_AGENT = 'tour-comparison-bot/0.1';
export function createFetcher(opts?: { userAgent?: string; delayMs?: number }): Fetcher; // userAgent defaults to USER_AGENT

// sitemap.ts
export function parseSitemapXml(xml: string): { urls: string[]; sitemaps: string[] };
/** Follows a sitemap index one level deep. Returns [] if the sitemap cannot be fetched. */
export async function readSitemapUrls(fetcher: Fetcher, sitemapUrl: string): Promise<string[]>;

// run-operator.ts
export interface RunDeps {
  db: Db; fetcher: Fetcher; index: PlacesIndex;
  today: IsoDate; now: () => Date; log: (line: string) => void;
}
export interface RunOutcome { operatorId: OperatorId; ok: boolean; reasons: string[]; toursSaved: number }
export async function runOperator(scraper: OperatorScraper, deps: RunDeps): Promise<RunOutcome>;
```

## Fetcher behaviour

- Sends the given `User-Agent` on every request, including the robots.txt request.
- Per host: fetches `/robots.txt` once, obeys its rules for our User-Agent (falling back to `*`); a missing robots.txt allows everything.
- Per host: one request at a time, and at least `delayMs` (default `REQUEST_DELAY_MS`) between the start of consecutive requests.
- Retries a failed request (network error or 5xx) up to 2 times; 4xx is not retried. A 403 or 429 returns null and is logged; it is never worked around.
- Request timeout 30 seconds.

The spec names Crawlee. Use Crawlee's HTTP crawling and robots.txt support if they deliver the behaviour above behind this `Fetcher` interface; check the current Crawlee documentation for option names. If a behaviour cannot be met through Crawlee, implement that part directly (Node `fetch` plus the `robots-parser` package). The tests below are the contract either way.

## `runOperator` pipeline

1. `urls = await scraper.discover(fetcher)`, de-duplicated.
2. For each URL in order: `fetchText`; null → skip (not counted as a tour page). Otherwise count it as a tour page and call `scraper.parse`.
3. Parser returned null, or the result fails `scrapedTourSchema`, or the result's `operatorId` differs from `scraper.id` → parse failure.
4. `normaliseTour(scraped, index, today)`: `no-stops` or `no-price` → parse failure (its `unmatched` names are kept); `no-departures` → skipped, not a failure; ok → kept, with its unmatched names.
5. Two tours with the same code → keep the first.
6. `checkRun` with `previousGoodTourCount`.
7. ok → `saveOperatorRun`; not ok → `recordFailedRun`. Either way return the outcome.
8. An exception thrown by `discover` or `parse` is caught: a `parse` throw is a parse failure for that page; a `discover` throw ends the run as failed with reason `discover-error`.

`log` receives one line per failure (URL and reason) and a final summary line.

## Steps

- [ ] **Step 1: Write the failing fetcher tests** in `polite-fetch.test.ts`, against a local `node:http` server started in the test on a random port. The server records each request's path, time and `user-agent`, and serves:
  - `/robots.txt` → `User-agent: *\nDisallow: /private/`
  - `/a`, `/b`, `/c` → 200 `ok-a` etc.; `/private/x` → 200; `/missing` → 404; `/flaky` → 500 twice then 200; `/blocked` → 403.

```ts
const f = createFetcher({ userAgent: 'test-bot/0.1', delayMs: 200 });
it('returns the body', async () => { expect(await f.fetchText(url('/a'))).toBe('ok-a'); });
it('sends the User-Agent on every request, including robots.txt', async () => { /* every recorded UA equals the string above */ });
it('never requests a disallowed path', async () => {
  expect(await f.fetchText(url('/private/x'))).toBeNull();
  expect(requests.some(r => r.path === '/private/x')).toBe(false);
});
it('fetches robots.txt once per host', async () => { /* after three fetches, exactly one /robots.txt request */ });
it('spaces requests by at least the delay', async () => {
  await Promise.all([f.fetchText(url('/a')), f.fetchText(url('/b')), f.fetchText(url('/c'))]);
  // sorted start times of /a,/b,/c: each gap ≥ 190 ms; never two in flight at once
});
it('returns null for 404 without retrying', async () => { /* null; exactly 1 request to /missing */ });
it('retries 5xx up to twice', async () => { /* 'ok'; exactly 3 requests to /flaky */ });
it('returns null for 403 without retrying', async () => { /* null; exactly 1 request to /blocked */ });
it('allows everything when robots.txt is missing', async () => { /* second server with no robots.txt → /a returns body */ });
it('USER_AGENT is generic', () => { expect(USER_AGENT).toBe('tour-comparison-bot/0.1'); });
it('uses USER_AGENT by default', async () => { /* createFetcher() with no options → recorded UA is tour-comparison-bot/0.1 */ });
```

- [ ] **Step 2: Write the failing sitemap tests** in `sitemap.test.ts`:

```ts
it('parses a urlset', () => {
  expect(parseSitemapXml('<urlset><url><loc>https://x.test/tour/A</loc></url><url><loc> https://x.test/tour/B </loc></url></urlset>'))
    .toEqual({ urls: ['https://x.test/tour/A', 'https://x.test/tour/B'], sitemaps: [] });
});
it('parses a sitemap index', () => {
  expect(parseSitemapXml('<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap></sitemapindex>'))
    .toEqual({ urls: [], sitemaps: ['https://x.test/s1.xml'] });
});
it('decodes &amp; in URLs and survives junk', () => {
  expect(parseSitemapXml('<urlset><url><loc>https://x.test/a?b=1&amp;c=2</loc></url></urlset>').urls).toEqual(['https://x.test/a?b=1&c=2']);
  expect(parseSitemapXml('not xml')).toEqual({ urls: [], sitemaps: [] });
});
it('readSitemapUrls follows an index one level', async () => {
  // fake Fetcher: index → s1.xml, s2.xml; each a urlset → returns the union of their URLs
});
it('readSitemapUrls returns [] when the sitemap is unavailable', async () => { /* fetchText → null */ });
```

- [ ] **Step 3: Write the failing runner tests** in `run-operator.test.ts`, using `createTestDb()`, the real `places` index, a fake `Fetcher` backed by a `Map<string, string | null>`, and a fake scraper whose `parse` does `JSON.parse(html)` (so each fake page is a `ScrapedTour` as JSON, or the string `"null"`).

```ts
it('saves good tours and reports ok', async () => {
  // 3 pages: two valid tours, one "null" → outcome ok, toursSaved 2; db has 2 active tours
});
it('skips pages the fetcher cannot get, without counting them as failures', async () => { /* fetchText null for one URL */ });
it('a tour with no upcoming departures is skipped, not a failure', async () => { /* only past dates → not saved, run still ok */ });
it('a tour whose headings match no place is a parse failure and its names are logged', async () => {
  // headings ['香港 → 亞特蘭提斯'] among 9 good tours → run ok, 9 saved;
  // unmatched_places has 亞特蘭提斯
});
it('rejects a tour claiming another operator id', async () => { /* scraper.id 'jetour', page says 'egl' → parse failure */ });
it('keeps the first of two tours with the same code', async () => {});
it('a bad run keeps last night\'s data', async () => {
  // night 1: 30 good tours saved. night 2: discover returns the same 30 URLs but 25 pages parse to null
  // → outcome ok false, reasons include 'tour-count-dropped' and 'too-many-parse-failures';
  // db still has 30 active tours with last_seen = night 1; scrape_runs has an ok=false row
});
it('zero discovered URLs is a failed run', async () => { /* reasons ['no-tours'] */ });
it('a throwing parser is a parse failure, not a crash', async () => {});
it('a throwing discover ends the run as failed', async () => { /* reasons ['discover-error']; recordFailedRun called */ });
```

Write every commented test in full.

- [ ] **Step 4: Run** `pnpm --filter @hktours/scraper test` — Expected: FAIL.
- [ ] **Step 5: Implement** `types.ts`, `polite-fetch.ts`, `sitemap.ts`, `run-operator.ts`.
- [ ] **Step 6: Run the tests** — Expected: PASS.
- [ ] **Step 7: Commit** — `git commit -am "feat(scraper): polite fetcher, sitemap reader, operator runner"`
