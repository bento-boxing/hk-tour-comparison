# Task 5: Start-point rule and normalising a scraped tour

**Goal:** turn a `ScrapedTour` into a `NormalisedTour` ready to save, or reject it with a reason.

**Files:**
- Create: `packages/core/src/start-point.ts`, `packages/core/src/normalise.ts`
- Test: `packages/core/src/start-point.test.ts`, `packages/core/src/normalise.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `ScrapedTour`, `NormalisedTour`, `TourPoint` (Task 2); `PlacesIndex` (Task 3); `extractStops` (Task 4).
- Produces:

```ts
export function normaliseStartPoint(raw: string | null): TourPoint;

export type NormaliseResult =
  | { ok: true; tour: NormalisedTour; unmatched: string[] }
  | { ok: false; reason: 'no-stops' | 'no-departures' | 'no-price'; unmatched: string[] };

/** today: 'YYYY-MM-DD' in Hong Kong. Departures before today are dropped. */
export function normaliseTour(scraped: ScrapedTour, index: PlacesIndex, today: IsoDate): NormaliseResult;
```

## Rules

`normaliseStartPoint`:
- `null` or blank → `{ kind: 'hk', label: null }`
- contains `當地` (a "join locally" tour) → `other`, checked before everything else
- contains any of `香港 機場 赤鱲角 西九龍 紅磡 啟德 中港城 港澳碼頭` → `hk`
- contains any of `深圳 福田 羅湖 蛇口 寶安 深圳灣 皇崗 蓮塘` → `sz`
- otherwise → `{ kind: 'other', label: <raw, trimmed, at most 12 characters> }`
- Hong Kong keywords are checked first (`香港西九龍` is `hk`).

`normaliseTour`:
1. `start` / `end` from `normaliseStartPoint(startPoint)` / `(endPoint)`.
2. Exclusions for `extractStops`: Hong Kong always; Shenzhen (`china-guangdong-shenzhen`) when start or end kind is `sz`.
3. No stops → `{ ok: false, reason: 'no-stops' }`, with `unmatched` being the extractor's unmatched list, or the raw headings (each cut to 40 characters) when that list is empty.
4. Departures: drop dates before `today`; de-duplicate by date keeping the lowest non-null price; sort ascending. None left → `'no-departures'`.
5. `fromPriceHkd` = lowest non-null departure price; if every departure price is null, the scraped `fromPriceHkd`; if that is also null → `'no-price'`.

## Steps

- [ ] **Step 1: Write the failing tests.**

`start-point.test.ts`:

```ts
it.each([
  [null, 'hk', null], ['', 'hk', null], ['香港國際機場集合', 'hk', null],
  ['香港西九龍站', 'hk', null], ['深圳灣口岸集合', 'sz', null], ['福田口岸', 'sz', null],
  ['澳門外港碼頭', 'other', '澳門外港碼頭'], ['東京成田機場當地集合', 'other', '東京成田機場當地集合'],
  ['大阪關西當地參團', 'other', '大阪關西當地參團'],
])('normaliseStartPoint(%j)', (raw, kind, label) => {
  expect(normaliseStartPoint(raw)).toEqual({ kind, label });
});
```

The `當地` rows pin the override rule: a "join locally" tour is `other` even though its text contains `機場`.

`normalise.test.ts`, with `base` being the valid `ScrapedTour` from Task 2's test but `dayHeadings: ['香港 → 大阪', '大阪 → 京都']` and departures `[{date:'2026-12-22',priceHkd:8299},{date:'2026-12-18',priceHkd:7999},{date:'2026-11-01',priceHkd:5000}]`:

```ts
const today = '2026-11-12';
it('normalises a good tour', () => {
  const r = normaliseTour(base, places, today);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.tour.stops.map(s => s.cityId)).toEqual(['japan-kansai-osaka', 'japan-kansai-kyoto']);
  expect(r.tour.departures.map(d => d.date)).toEqual(['2026-12-18', '2026-12-22']); // past date dropped, sorted
  expect(r.tour.fromPriceHkd).toBe(7999);
  expect(r.tour.start).toEqual({ kind: 'hk', label: null });
});
it('uses the scraped from-price when no departure has a price', () => {
  const r = normaliseTour({ ...base, fromPriceHkd: 6000, departures: [{ date: '2026-12-18', priceHkd: null }] }, places, today);
  expect(r.ok && r.tour.fromPriceHkd).toBe(6000);
});
it('de-duplicates dates keeping the lowest price', () => {
  const r = normaliseTour({ ...base, departures: [{ date: '2026-12-18', priceHkd: 9000 }, { date: '2026-12-18', priceHkd: 8000 }] }, places, today);
  expect(r.ok && r.tour.departures).toEqual([{ date: '2026-12-18', priceHkd: 8000 }]);
});
it.each([
  ['no-stops', { dayHeadings: [] }],
  ['no-stops', { dayHeadings: ['香港 → 亞特蘭提斯'] }],
  ['no-departures', { departures: [] }],
  ['no-departures', { departures: [{ date: '2026-11-11', priceHkd: 5000 }] }],
  ['no-price', { fromPriceHkd: null, departures: [{ date: '2026-12-18', priceHkd: null }] }],
])('rejects with %s', (reason, patch) => {
  const r = normaliseTour({ ...base, ...patch }, places, today);
  expect(r).toMatchObject({ ok: false, reason });
});
it('reports unmatched names on rejection', () => {
  const r = normaliseTour({ ...base, dayHeadings: ['香港 → 亞特蘭提斯'] }, places, today);
  expect(r.unmatched).toEqual(['亞特蘭提斯']);
});
it('drops Shenzhen from the route for a Shenzhen-start tour', () => {
  const r = normaliseTour({ ...base, startPoint: '深圳灣口岸', dayHeadings: ['深圳 → 桂林', '桂林 → 深圳'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangxi-guilin']);
  expect(r.ok && r.tour.start.kind).toBe('sz');
});
```

- [ ] **Step 2: Run both test files** — Expected: FAIL.
- [ ] **Step 3: Implement** `start-point.ts` and `normalise.ts` per the rules.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): start-point rule and tour normalisation"`
