# Task 24: Search page

**Goal:** the home page: destination picker, filter bar, sorted results as cards, paging, and starting a chain from any card. All state lives in the page address.

Open `docs/design/mockup.html`, "Screen 1". The filter bar is `.filters` / `.f`: white pills with a khaki outline, the active one filled cerulean with snow text; results are `.grid` (cards at least 300px wide, 14px gap).

**Files:**
- Create: `apps/web/lib/search-params.ts`
- Create: `apps/web/components/FilterBar.tsx`, `FilterBar.module.css`, `Results.tsx`, `Results.module.css`, `Pager.tsx`
- Modify: `apps/web/app/page.tsx`, both dictionaries
- Test: `apps/web/lib/search-params.test.ts`, `apps/web/components/FilterBar.test.tsx`, `apps/web/components/Results.test.tsx`

**Interfaces:**
- Consumes: `searchTours`, `getOperators`, `TourFilters`, `SortKey`, `PAGE_SIZE`, `TourCardData` (Task 21); `TourCard` (Task 22); `DestinationSearch`, `DestinationPanels`, `destinationLabel` (Task 23); `PlacesIndex`, `isIsoDate`, `OPERATOR_IDS`; `encodeChain`, `DEFAULT_GAP` (Tasks 6, 9); `getDb`, `getT` (Task 20); `todayInHongKong`.
- Produces:

```ts
// search-params.ts
export interface SearchState { filters: TourFilters; sort: SortKey; page: number }
type RawParams = Record<string, string | string[] | undefined>;
/** Never throws. Anything invalid is dropped. includeDates false is used by the chain page. */
export function parseSearchParams(raw: RawParams, places: PlacesIndex, opts?: { includeDates?: boolean }): SearchState;
/** Omits defaults and empty values so addresses stay short. */
export function buildSearchQuery(state: SearchState): URLSearchParams;
export const DEFAULT_SORT: SortKey = 'price';
```

## Address parameters

| Param | Meaning | Example | Invalid value |
|---|---|---|---|
| `dest` | a region id, or a country id for all regions | `japan-kansai`, `japan` | ignored |
| `ex` | excluded country ids, comma-separated (used on the chain page; parsed here) | `japan,korea` | unknown ids dropped |
| `from`, `to` | departure window | `2026-12-01` | ignored; if `from > to` both ignored |
| `dmin`, `dmax` | length in days, integers 1–60 | `4` | ignored; swapped if min > max |
| `pmin`, `pmax` | price in HKD, integers 0–2,000,000 | `5000` | ignored; swapped if min > max |
| `op` | operator ids, comma-separated | `egl,jetour` | unknown ids dropped |
| `sort` | `price`, `days`, `date`, `destination` | `days` | `price` |
| `page` | integer ≥ 1 | `2` | `1` |

A repeated parameter uses its first value.

## Page behaviour (`app/page.tsx`, a server component)

1. `today = todayInHongKong()`; parse the address; `searchTours(getDb(), …)`; `getOperators`.
2. Layout top to bottom: nav bar (search current), `DestinationSearch` with the `按國家選擇` panels button beside it, `FilterBar`, a result count line, `Results`, `Pager`.
3. Changing any filter or sort navigates to the same page with the new address and `page` reset to 1.
4. Result count line: `共 {n} 個旅行團`.
5. No results: `找不到符合條件的旅行團` and a `清除所有篩選` link to `/`.
6. Every card gets `onAdd`; picking a date navigates to `/chain?` + `encodeChain({ legs: [{ tourKey, departure }], gap: DEFAULT_GAP })`.
7. The page is rendered per request (not statically cached), so it shows the latest scrape. If the database is unreachable, show `暫時未能載入資料，請稍後再試。` instead of crashing.

## Filter bar

Pills in this order: selected destination (with ✕ to clear, only when set), departure dates, length, price, operators, sort. Each pill opens a small popover:

- **出發日期**: two date inputs; label `出發日期：全部` or `出發日期：12/1 – 12/31`.
- **日數**: presets `1–3日`, `4–6日`, `7–9日`, `10日以上`, plus min/max number inputs; label `日數：4–6日`.
- **價錢**: min/max number inputs; label `價錢：HK$5,000–12,000`.
- **旅行社**: a checkbox per operator from `getOperators`, each with its colour dot; label `旅行社：全部` or the names joined by `、`.
- **排序**: `價錢 低→高`, `日數 短→長`, `出發日期 早→遲`, `目的地`.

A pill whose filter is set is shown filled (cerulean); unset pills are outlined.

`FilterBar` props: `{ state: SearchState; operators: OperatorInfo[]; places: PlacesIndex; t: T; onChange: (next: SearchState) => void; show?: { dates?: boolean; exclude?: boolean } }`. `show.dates` defaults to true and `show.exclude` to false; the chain page (Task 25) flips both.

## Dictionary keys

`search.count` 共 {n} 個旅行團 · `search.empty` 找不到符合條件的旅行團 · `search.clearAll` 清除所有篩選 · `search.error` 暫時未能載入資料，請稍後再試。 · `filter.dates` 出發日期 · `filter.days` 日數 · `filter.price` 價錢 · `filter.operators` 旅行社 · `filter.sort` 排序 · `filter.all` 全部 · `filter.daysRange` {min}–{max}日 · `filter.daysPlus` {min}日以上 · `sort.price` 價錢 低→高 · `sort.days` 日數 短→長 · `sort.date` 出發日期 早→遲 · `sort.destination` 目的地 · `pager.prev` 上一頁 · `pager.next` 下一頁 · `pager.page` 第 {page} / {pages} 頁. Add an English value for each.

## Steps

- [ ] **Step 1: Write the failing tests.**

```ts
// search-params.test.ts
it('parses a full address', () => {
  const s = parseSearchParams({ dest: 'japan-kansai', from: '2026-12-01', to: '2026-12-31', dmin: '4', dmax: '6',
    pmin: '5000', pmax: '12000', op: 'egl,jetour', sort: 'days', page: '2' }, places);
  expect(s).toEqual({
    filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' }, dateFrom: '2026-12-01', dateTo: '2026-12-31',
      daysMin: 4, daysMax: 6, priceMin: 5000, priceMax: 12000, operators: ['egl', 'jetour'] },
    sort: 'days', page: 2,
  });
});
it('a country id means all regions', () => {
  expect(parseSearchParams({ dest: 'japan' }, places).filters.destination).toEqual({ countryId: 'japan', regionId: null });
});
it('empty address gives defaults', () => {
  expect(parseSearchParams({}, places)).toEqual({ filters: {}, sort: 'price', page: 1 });
});
it.each([
  [{ dest: 'atlantis' }], [{ from: '2026-02-30' }], [{ from: '2026-12-31', to: '2026-12-01' }],
  [{ dmin: '0' }], [{ dmin: '4.5' }], [{ dmax: '61' }], [{ pmin: '-5' }], [{ pmin: 'abc' }],
  [{ op: 'wingon' }], [{ sort: 'random' }], [{ page: '0' }], [{ page: '-3' }], [{ page: 'x' }],
  [{ dest: '<script>' }], [{ ex: 'atlantis' }],
])('ignores invalid input %j', raw => {
  expect(parseSearchParams(raw, places)).toEqual({ filters: {}, sort: 'price', page: 1 });
});
it('swaps reversed ranges', () => {
  expect(parseSearchParams({ dmin: '6', dmax: '4', pmin: '9000', pmax: '5000' }, places).filters)
    .toEqual({ daysMin: 4, daysMax: 6, priceMin: 5000, priceMax: 9000 });
});
it('keeps valid operators and exclusions, drops unknown ones', () => {
  const f = parseSearchParams({ op: 'egl,wingon,jetour', ex: 'japan,atlantis' }, places).filters;
  expect(f.operators).toEqual(['egl', 'jetour']); expect(f.excludeCountryIds).toEqual(['japan']);
});
it('uses the first value of a repeated parameter', () => {
  expect(parseSearchParams({ sort: ['days', 'date'] }, places).sort).toBe('days');
});
it('includeDates false drops the date window', () => {
  expect(parseSearchParams({ from: '2026-12-01', dmin: '4' }, places, { includeDates: false }).filters).toEqual({ daysMin: 4 });
});
it('buildSearchQuery omits defaults and round-trips', () => {
  expect(buildSearchQuery({ filters: {}, sort: 'price', page: 1 }).toString()).toBe('');
  const s = parseSearchParams({ dest: 'japan', op: 'egl', sort: 'date', page: '3', ex: 'korea' }, places);
  expect(parseSearchParams(Object.fromEntries(buildSearchQuery(s)), places)).toEqual(s);
});

// FilterBar.test.tsx
it('shows each filter with its current value', () => { /* labels '日數：4–6日', '旅行社：全部', '排序：價錢 低→高' */ });
it('choosing a length preset calls onChange with page reset to 1', async () => {
  // state page 3 → click 日數, click '4–6日' → onChange({...filters daysMin 4, daysMax 6, page: 1})
});
it('ticking operators updates the filter', async () => {});
it('clearing the destination pill removes it', async () => {});
it('hides dates and shows exclusion when asked', () => {
  // show {dates:false, exclude:true} → no 出發日期 pill; a 排除 pill present
});

// Results.test.tsx
it('renders one card per tour', () => {});
it('shows the count', () => { /* '共 2 個旅行團' */ });
it('shows the empty message and a clear link when there are none', () => {
  /* '找不到符合條件的旅行團'; link 清除所有篩選 → '/' */
});
it('picking a date on a card navigates to the chain page with that leg', async () => {
  // mock next/navigation router; click 加入行程 ＋, pick 2026-12-18
  // → push('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3') (compare after decoding)
});
```

Write every commented test in full.

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `search-params.ts`, `FilterBar`, `Results`, `Pager`, the page, and the dictionary keys.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Try it against real data.** With `DATABASE_URL` pointing at a database that has scraped tours (or seeded with a few rows), run the dev server and check: typing 大阪 and choosing `日本 → 關西` lists tours where Osaka is a middle or last stop as well as a first stop; each filter and sort changes the list and the address; reload keeps the state; a nonsense address such as `/?page=-1&sort=x&dest=%3Cb%3E` renders the default list.
- [ ] **Step 6: Compare with the mockup's Screen 1** side by side.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(web): search page with filters, sorting and paging"`
