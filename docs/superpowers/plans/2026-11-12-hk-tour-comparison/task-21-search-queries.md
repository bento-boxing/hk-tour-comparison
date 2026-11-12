# Task 21: Database queries for search and chaining

**Goal:** the read side of the database: filtered, sorted, paged tour search, and loading specific tours by key. The same search serves the main results and the "next leg" list; chaining just supplies a date window and exclusions.

**Files:**
- Create: `packages/db/src/search.ts`
- Test: `packages/db/src/search.test.ts`
- Modify: `packages/db/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `Db`, `createTestDb` (Task 10); `saveOperatorRun` (Task 11, to seed tests); `Stop`, `TourPoint`, `ScrapedDeparture`, `OperatorId`, `tourKey` (Task 2); `Destination` (Task 8); `PriceChange`, `comparePrice` (Task 7).
- Produces:

```ts
export interface TourFilters {
  destination?: Destination;          // matches if ANY stop is in it
  excludeCountryIds?: string[];       // drops tours with ANY stop in these countries
  dateFrom?: IsoDate; dateTo?: IsoDate; // departure window, inclusive
  daysMin?: number; daysMax?: number;
  priceMin?: number; priceMax?: number; // applied to windowPriceHkd
  operators?: OperatorId[];
}
export type SortKey = 'price' | 'days' | 'date' | 'destination';
export const PAGE_SIZE = 24;

export interface TourCardData {
  key: string;                        // 'egl:HTBKOK06'
  operatorId: OperatorId; url: string; title: string;
  days: number; nights: number | null;
  stops: Stop[]; start: TourPoint; end: TourPoint;
  fromPriceHkd: number;               // lowest across all upcoming departures
  windowPriceHkd: number;             // lowest across the departures listed below
  departures: ScrapedDeparture[];     // upcoming and inside the window, ascending
  priceChange: PriceChange | null;    // compares fromPriceHkd with the snapshots
  lastUpdated: string;                // operator's last_good_run_at, ISO timestamp
}

export interface SearchInput { filters: TourFilters; sort: SortKey; page: number; today: IsoDate }
export async function searchTours(db: Db, input: SearchInput): Promise<{ tours: TourCardData[]; total: number }>;
/** Active tours only; `departures` holds every upcoming departure. Unknown or inactive keys are absent from the map. */
export async function getToursByKeys(db: Db, keys: string[], today: IsoDate): Promise<Map<string, TourCardData>>;
export interface OperatorInfo { id: OperatorId; nameZh: string; nameEn: string; color: string; lastGoodRunAt: string | null }
export async function getOperators(db: Db): Promise<OperatorInfo[]>;
```

## Rules

- Only `active` tours with at least one departure that is `>= today` and inside `[dateFrom, dateTo]` (an absent bound is open; the lower bound is never earlier than `today`).
- A departure's effective price is its own `price_hkd`, or the tour's `from_price_hkd` when that is null. `windowPriceHkd` is the lowest effective price among the listed departures.
- `priceMin` / `priceMax` filter on `windowPriceHkd`.
- Destination: with a `regionId`, any stop with that `region_id`; with `regionId: null`, any stop with that `country_id`.
- Sorting, always with `key` as the final tie-break so paging is stable:
  - `price` → `windowPriceHkd` ascending
  - `days` → days ascending, then price
  - `date` → earliest listed departure ascending, then price
  - `destination` → the first stop's `country_id`, then `region_id`, then price
- `page` starts at 1; pages below 1 are treated as 1. `total` is the count before paging.
- `priceChange` is `comparePrice(fromPriceHkd, snapshots, today)`.
- An empty `operators` array or empty `excludeCountryIds` means "no filter".
- At most a handful of queries per call regardless of page size (no query per tour).

## Steps

- [ ] **Step 1: Write the failing tests** in `search.test.ts`. Seed with `saveOperatorRun` on run date `2026-11-12`, `today = '2026-11-12'`:

| key | stops | days | departures (date: price) |
|---|---|---|---|
| `egl:KIX5` | 大阪, 京都, 奈良 | 5 | 12-18: 7999, 12-27: 8999 |
| `jetour:TYO-KIX` | 東京, 箱根, 大阪 | 6 | 12-20: 9880 |
| `texpert:SEL5` | 首爾, 南怡島 | 5 | 12-24: 5699, 12-25: null (tour from-price 5699) |
| `bigline:TPE4` | 台北, 九份 | 4 | 12-23: 3980 |
| `jetour:HKD7` | 北海道 (region only), 札幌 | 7 | 2027-01-05: 12500 |
| `egl:OLD` | 大阪 | 3 | 12-01: 3000 — then made inactive by a second egl run that omits it |

Also seed `egl:KIX5` with a snapshot of 8499 on `2026-11-05`.

```ts
const keys = async (filters: TourFilters, sort: SortKey = 'price') =>
  (await searchTours(db, { filters, sort, page: 1, today })).tours.map(t => t.key);

it('returns active tours with upcoming departures, cheapest first', async () => {
  expect(await keys({})).toEqual(['bigline:TPE4', 'texpert:SEL5', 'egl:KIX5', 'jetour:TYO-KIX', 'jetour:HKD7']);
});
it('destination matches a first, intermediate or last stop', async () => {
  expect(await keys({ destination: { countryId: 'japan', regionId: 'japan-kansai' } })).toEqual(['egl:KIX5', 'jetour:TYO-KIX']);
});
it('country-wide destination', async () => {
  expect(await keys({ destination: { countryId: 'japan', regionId: null } })).toEqual(['egl:KIX5', 'jetour:TYO-KIX', 'jetour:HKD7']);
});
it('matches a region-only stop', async () => {
  expect(await keys({ destination: { countryId: 'japan', regionId: 'japan-hokkaido' } })).toEqual(['jetour:HKD7']);
});
it('excludes countries', async () => {
  expect(await keys({ excludeCountryIds: ['japan'] })).toEqual(['bigline:TPE4', 'texpert:SEL5']);
});
it('date window keeps only departures inside it and reprices', async () => {
  const r = await searchTours(db, { filters: { dateFrom: '2026-12-24', dateTo: '2026-12-27' }, sort: 'price', page: 1, today });
  expect(r.tours.map(t => t.key)).toEqual(['texpert:SEL5', 'egl:KIX5']);
  const kix = r.tours[1];
  expect(kix.departures).toEqual([{ date: '2026-12-27', priceHkd: 8999 }]);
  expect(kix.windowPriceHkd).toBe(8999);
  expect(kix.fromPriceHkd).toBe(7999);
});
it('a null departure price falls back to the tour from-price', async () => {
  const r = await searchTours(db, { filters: { dateFrom: '2026-12-25', dateTo: '2026-12-25' }, sort: 'price', page: 1, today });
  expect(r.tours.map(t => [t.key, t.windowPriceHkd])).toEqual([['texpert:SEL5', 5699]]);
});
it('length, price and operator filters', async () => {
  expect(await keys({ daysMin: 5, daysMax: 5 })).toEqual(['texpert:SEL5', 'egl:KIX5']);
  expect(await keys({ priceMin: 5000, priceMax: 8000 })).toEqual(['texpert:SEL5', 'egl:KIX5']);
  expect(await keys({ operators: ['jetour'] })).toEqual(['jetour:TYO-KIX', 'jetour:HKD7']);
  expect(await keys({ operators: [] })).toHaveLength(5);
});
it('sorts', async () => {
  expect(await keys({}, 'days')).toEqual(['bigline:TPE4', 'texpert:SEL5', 'egl:KIX5', 'jetour:TYO-KIX', 'jetour:HKD7']);
  expect(await keys({}, 'date')).toEqual(['egl:KIX5', 'jetour:TYO-KIX', 'bigline:TPE4', 'texpert:SEL5', 'jetour:HKD7']);
  // by FIRST stop: japan-hokkaido, japan-kansai, japan-kanto, korea-seoul, taiwan-north
  expect(await keys({}, 'destination')).toEqual(['jetour:HKD7', 'egl:KIX5', 'jetour:TYO-KIX', 'texpert:SEL5', 'bigline:TPE4']);
});
it('hides tours whose departures have all passed', async () => {
  const r = await searchTours(db, { filters: {}, sort: 'price', page: 1, today: '2026-12-26' });
  expect(r.tours.map(t => t.key)).toEqual(['egl:KIX5', 'jetour:HKD7']);
});
it('never returns inactive tours', async () => { expect(await keys({})).not.toContain('egl:OLD'); });
it('includes the 7-day price change', async () => {
  const kix = (await searchTours(db, { filters: { operators: ['egl'] }, sort: 'price', page: 1, today })).tours[0];
  expect(kix.priceChange).toEqual({ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' });
});
it('pages with a stable order and reports the total', async () => {
  // seed 30 extra bigline tours all priced 4000; page 1 has 24, page 2 the rest, no key appears twice, total = 35
});
it('page 0 and negative pages behave as page 1', async () => {});
it('stops come back in route order with ids', async () => { /* egl:KIX5 stops city ids [osaka, kyoto, nara] */ });
it('getToursByKeys returns every upcoming departure and omits unknown or inactive keys', async () => {
  const m = await getToursByKeys(db, ['egl:KIX5', 'egl:OLD', 'egl:NOPE', 'garbage'], today);
  expect([...m.keys()]).toEqual(['egl:KIX5']);
  expect(m.get('egl:KIX5')!.departures.map(d => d.date)).toEqual(['2026-12-18', '2026-12-27']);
});
it('getToursByKeys with [] makes no query and returns an empty map', async () => {});
it('getOperators returns four operators with names, colours and freshness', async () => {});
```

Write the commented tests in full.

- [ ] **Step 2: Run** `pnpm vitest run packages/db/src/search.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `search.ts`.** Build the `where` clause from the filters with positional parameters; fetch the page of tours, then their stops, departures and snapshots with `tour_id = any($1)` queries.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): tour search and lookup queries"`
