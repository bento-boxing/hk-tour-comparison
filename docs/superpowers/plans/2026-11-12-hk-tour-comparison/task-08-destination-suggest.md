# Task 8: Destination matching and search suggestions

**Goal:** (a) decide whether a tour matches a chosen destination — any stop counts, not only the first; (b) turn what a visitor types into `Country → Region` suggestions.

**Files:**
- Create: `packages/core/src/destination.ts`, `packages/core/src/suggest.ts`
- Test: `packages/core/src/destination.test.ts`, `packages/core/src/suggest.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `Stop` (Task 2); `PlacesIndex`, `normaliseName` (Task 3).
- Produces:

```ts
/** regionId null means "all regions of the country". */
export interface Destination { countryId: string; regionId: string | null }

export function tourMatchesDestination(stops: Stop[], dest: Destination): boolean;
export function tourVisitsCountry(stops: Stop[], countryId: string): boolean;
/** Distinct `country · region` pairs in route order, for the card's corner label. */
export function tourRegions(stops: Stop[]): Destination[];

export interface Suggestion {
  destination: Destination;
  label: string;            // '日本 → 關西' or '日本 → 全部地區'
  via: string | null;       // the city name that matched, e.g. '大阪'; null for region/country matches
}
export const ALL_REGIONS_LABEL = '全部地區';
export function suggestRegions(query: string, index: PlacesIndex, limit?: number): Suggestion[]; // limit default 8
```

The database query in Task 21 implements the same matching rule in SQL; `tourMatchesDestination` is the reference definition and is used for client-side checks.

## Suggestion rules

Normalise the query with `normaliseName`. Empty after normalising → `[]`. Build results in this order, de-duplicating by destination (first occurrence wins), then cut to `limit`:

1. Cities whose name or alias **equals** the query → that city's region, `via` = city `nameZh`.
2. Regions whose name or alias equals the query.
3. Countries whose name or alias equals the query → `Country → 全部地區`, followed by each of that country's regions.
4. Cities whose name or alias **starts with** the query → their regions, `via` = city name.
5. Regions, then countries, whose name starts with the query (countries as `→ 全部地區`).
6. Cities, then regions, whose name **contains** the query.

Matching also runs against `nameEn`, case-insensitively, so `osaka` works for the developer. Labels are always Chinese: `<country nameZh> → <region nameZh>`.

## Steps

- [ ] **Step 1: Write the failing tests.**

`destination.test.ts`:

```ts
const osaka = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const tokyo = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-tokyo' };
const seoul = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };
const hokkaidoRegionOnly = { countryId: 'japan', regionId: 'japan-hokkaido', cityId: null };
const kansai = { countryId: 'japan', regionId: 'japan-kansai' };

it('matches when the region is the first stop', () => { expect(tourMatchesDestination([osaka, tokyo], kansai)).toBe(true); });
it('matches when the region is an intermediate stop', () => { expect(tourMatchesDestination([tokyo, osaka, tokyo], kansai)).toBe(true); });
it('matches when the region is the last stop', () => { expect(tourMatchesDestination([tokyo, osaka], kansai)).toBe(true); });
it('does not match another region', () => { expect(tourMatchesDestination([tokyo], kansai)).toBe(false); });
it('country-wide destination matches any region of it', () => {
  expect(tourMatchesDestination([tokyo], { countryId: 'japan', regionId: null })).toBe(true);
  expect(tourMatchesDestination([seoul], { countryId: 'japan', regionId: null })).toBe(false);
});
it('matches a region-only stop', () => {
  expect(tourMatchesDestination([hokkaidoRegionOnly], { countryId: 'japan', regionId: 'japan-hokkaido' })).toBe(true);
});
it('empty stops never match', () => { expect(tourMatchesDestination([], kansai)).toBe(false); });
it('tourVisitsCountry', () => { expect(tourVisitsCountry([tokyo, seoul], 'korea')).toBe(true); });
it('tourRegions is distinct and in route order', () => {
  expect(tourRegions([osaka, tokyo, osaka, seoul])).toEqual([
    { countryId: 'japan', regionId: 'japan-kansai' }, { countryId: 'japan', regionId: 'japan-kanto' },
    { countryId: 'korea', regionId: 'korea-seoul' },
  ]);
});
```

`suggest.test.ts`:

```ts
const labels = (q: string) => suggestRegions(q, places).map(s => s.label);

it('a city suggests its region', () => {
  expect(suggestRegions('大阪', places)[0]).toEqual({
    destination: { countryId: 'japan', regionId: 'japan-kansai' }, label: '日本 → 關西', via: '大阪',
  });
});
it('a region suggests itself', () => { expect(labels('關西')[0]).toBe('日本 → 關西'); });
it('a country suggests all-regions first, then its regions', () => {
  const l = labels('日本');
  expect(l[0]).toBe('日本 → 全部地區');
  expect(l).toContain('日本 → 北海道');
});
it('prefix matches work while typing', () => { expect(labels('北海')).toContain('日本 → 北海道'); });
it('alias and English work', () => {
  expect(labels('漢城')[0]).toBe('韓國 → 首爾及京畿');
  expect(labels('Osaka')[0]).toBe('日本 → 關西');
});
it('nothing for empty, whitespace or unknown input', () => {
  expect(labels('')).toEqual([]); expect(labels('   ')).toEqual([]); expect(labels('亞特蘭提斯')).toEqual([]);
});
it('same-named cities in two countries give two distinguishable labels', () => {
  // tiny index from Task 3's shared-name test: 聖城 in 甲國/甲區 and 乙國/乙區
  // expect labels ['甲國 → 甲區', '乙國 → 乙區']
});
it('never returns duplicates and respects the limit', () => {
  const r = suggestRegions('日本', places, 3);
  expect(r.length).toBe(3);
  expect(new Set(r.map(s => s.label)).size).toBe(3);
});
```

Write the shared-name test in full.

- [ ] **Step 2: Run both files** — Expected: FAIL.
- [ ] **Step 3: Implement** `destination.ts` and `suggest.ts`.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): destination matching and region suggestions"`
