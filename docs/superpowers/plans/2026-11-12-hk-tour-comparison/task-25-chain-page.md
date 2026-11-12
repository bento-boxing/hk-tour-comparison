# Task 25: Chaining page

**Goal:** the page where a visitor builds a chain: the strip of chosen legs with gaps and totals, the gap selector, and the filtered list of tours that can come next.

Open `docs/design/mockup.html`, "Screen 2". The strip is `.chain` (panel background `--panel`, 10px radius, 14px padding) with `.leg` boxes (white, 5px left border in the operator colour), `.gap` connectors (a 70px dashed khaki line between the word `休息` and the gap value), a dashed placeholder `.leg.next`, and `.total` on the right (cerulean 20px bold price).

**Files:**
- Create: `apps/web/lib/chain.ts`
- Create: `apps/web/components/ChainStrip.tsx`, `ChainStrip.module.css`, `GapSelector.tsx`
- Modify: `apps/web/app/chain/page.tsx`, `apps/web/components/FilterBar.tsx` (the exclusion pill), both dictionaries
- Test: `apps/web/lib/chain.test.ts`, `apps/web/components/ChainStrip.test.tsx`, `apps/web/components/GapSelector.test.tsx`

**Interfaces:**
- Consumes: `decodeChain`, `encodeChain`, `ChainState`, `MAX_CHAIN_LEGS` (Task 9); `tourEndDate`, `gapWindow`, `gapBetween`, `MAX_GAP_DAYS` (Task 6); `getToursByKeys`, `searchTours`, `TourCardData` (Task 21); `parseSearchParams`, `buildSearchQuery`, `FilterBar`, `Results` (Task 24); `TourCard` (Task 22).
- Produces:

```ts
// lib/chain.ts — pure
export interface ResolvedLeg {
  tour: TourCardData; departure: IsoDate; endDate: IsoDate;
  priceHkd: number; priceIsExact: boolean;  // exact when that departure has its own price
  gapBefore: number | null;                 // free days since the previous leg; null for the first
}
export interface ResolvedChain { legs: ResolvedLeg[]; droppedCount: number }
export function resolveChain(state: ChainState, tours: Map<string, TourCardData>, today: IsoDate): ResolvedChain;

export interface ChainTotals { priceHkd: number; priceIsExact: boolean; tourDays: number; spanDays: number }
export function chainTotals(legs: ResolvedLeg[]): ChainTotals;
/** The departure window for the next leg, or null when there are no legs. */
export function nextWindow(legs: ResolvedLeg[], gap: { min: number; max: number }): { from: IsoDate; to: IsoDate } | null;
```

## `resolveChain` rules

Walk the legs in order. A leg is valid when all hold:
- its tour is in the map (so it exists and is active);
- its departure date is one of that tour's upcoming departures;
- for every leg after the first, its departure is after the previous leg's end date (`gapBetween ≥ 0`).

Stop at the first invalid leg: it and every later leg are dropped, and `droppedCount` is how many were dropped. The leg's price is that departure's own price (`priceIsExact: true`), or the tour's `fromPriceHkd` when the departure has none (`priceIsExact: false`).

`chainTotals`: `priceHkd` is the sum; `priceIsExact` is true only if every leg is exact; `tourDays` is the sum of tour lengths; `spanDays` runs from the first departure to the last end date, inclusive. Empty chain → all zeros and `priceIsExact: true`.

## Page behaviour (`app/chain/page.tsx`, a server component)

Address: `legs` and `gap` (Task 9), plus the filter parameters of Task 24 except `from`/`to`.

1. Decode the chain; `getToursByKeys` for its tour keys; `resolveChain`.
2. **No legs** (nothing chosen, or everything was dropped): show `先在「搜尋旅行團」選擇第一個旅行團，再回來加入下一程。` with a link to `/`. No list.
3. **Dropped legs**: show the notice `部分旅行團已下架或日期已不適用，已從行程中移除。` above the strip. The page keeps working with the legs that remain.
4. **Strip** (`ChainStrip`): each leg shows its route (as on the card), then `{operator} · 12/18 – 12/22 · HK$7,999` (with `起` after the price when not exact). Between legs: `休息 {n} 日`. After the last leg: the gap selector, then the dashed placeholder `＋ 從下方選擇下一個旅行團` with `可出發日：12/24 – 12/26`. On the right: `目前合計`, the total price (with `起` when not exact), and `{tourDays}日（連休息共{spanDays}日）` — just `{tourDays}日` for a single leg. A `移除最後一程` button removes the last leg.
5. **Gap selector**: two number selects, 0 to `MAX_GAP_DAYS`, labelled `最少` and `最多`, shown as `休息 [1] – [3] 日`. Changing either updates `gap` in the address (and resets `page`). Choosing a minimum above the maximum raises the maximum to match, and the reverse.
6. **Next-leg list**: heading `可接續的旅行團（12/24 – 12/26 出發）`. `FilterBar` with `show: { dates: false, exclude: true }`, then `Results` from `searchTours` with the visitor's filters plus `dateFrom`/`dateTo` = `nextWindow(...)`. Each card:
   - shows only the departures inside the window (which `searchTours` already returns) and the window price;
   - has `footNote` `休息 {n} 日後出發`, or `休息 {a}–{b} 日後出發` when its departures span several gaps;
   - `onAdd` appends the leg and navigates to the new address, keeping `gap`, clearing `page`.
7. With `MAX_CHAIN_LEGS` legs the list is replaced by `行程已達上限（8 程）。`
8. Empty list: `這段休息期內沒有可接續的旅行團，可嘗試延長休息日數。`
9. Rendered per request. A database error shows the same message as the search page.

## Exclusion pill (added to `FilterBar`)

Shown when `show.exclude` is true. Label `排除：無` or `排除：日本、韓國`. Its popover lists every country (except Hong Kong) as a checkbox; ticked countries go to `ex`. Off by default: nothing is excluded until the visitor chooses.

## Dictionary keys

`chain.empty` 先在「搜尋旅行團」選擇第一個旅行團，再回來加入下一程。 · `chain.dropped` 部分旅行團已下架或日期已不適用，已從行程中移除。 · `chain.yours` 你的行程 · `chain.rest` 休息 · `chain.restDays` 休息 {n} 日 · `chain.gapMin` 最少 · `chain.gapMax` 最多 · `chain.days` 日 · `chain.pickNext` ＋ 從下方選擇下一個旅行團 · `chain.window` 可出發日：{from} – {to} · `chain.total` 目前合計 · `chain.totalDays` {days}日 · `chain.totalSpan` {days}日（連休息共{span}日） · `chain.removeLast` 移除最後一程 · `chain.nextHeading` 可接續的旅行團（{from} – {to} 出發） · `chain.afterRest` 休息 {n} 日後出發 · `chain.afterRestRange` 休息 {a}–{b} 日後出發 · `chain.full` 行程已達上限（8 程）。 · `chain.noNext` 這段休息期內沒有可接續的旅行團，可嘗試延長休息日數。 · `filter.exclude` 排除 · `filter.none` 無. Add an English value for each.

## Steps

- [ ] **Step 1: Write the failing tests.** Tours: `A` = `egl:KIX5`, 5 days, departures `2026-12-18: 7999`, `2026-12-27: 8999`; `B` = `texpert:SEL5`, 5 days, departures `2026-12-24: 5699`, `2026-12-25: null`, `fromPriceHkd` 5699; `C` = `bigline:TPE4`, 4 days, departure `2026-12-23: 3980`. `today = '2026-11-12'`.

```ts
// chain.test.ts
const st = (...legs: [string, string][]) => ({ legs: legs.map(([tourKey, departure]) => ({ tourKey, departure })), gap: { min: 1, max: 3 } });

it('resolves a valid two-leg chain', () => {
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']), tours, today);
  expect(r.droppedCount).toBe(0);
  expect(r.legs.map(l => [l.endDate, l.priceHkd, l.priceIsExact, l.gapBefore])).toEqual([
    ['2026-12-22', 7999, true, null], ['2026-12-28', 5699, true, 1],
  ]);
});
it('a departure without its own price uses the from-price and is not exact', () => {
  const r = resolveChain(st(['texpert:SEL5', '2026-12-25']), tours, today);
  expect(r.legs[0]).toMatchObject({ priceHkd: 5699, priceIsExact: false });
});
it('drops a leg whose tour has gone, and everything after it', () => {
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['jetour:GONE', '2026-12-24'], ['bigline:TPE4', '2026-12-23']), tours, today);
  expect(r.legs.map(l => l.tour.key)).toEqual(['egl:KIX5']); expect(r.droppedCount).toBe(2);
});
it('drops a leg whose date is no longer offered', () => {
  expect(resolveChain(st(['egl:KIX5', '2026-12-19']), tours, today)).toEqual({ legs: [], droppedCount: 1 });
});
it('drops a leg that overlaps the previous one', () => {
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['bigline:TPE4', '2026-12-23']), tours, today);
  expect(r.legs).toHaveLength(2);   // 12-23 is the day after 12-22: gap 0, allowed
  const r2 = resolveChain(st(['egl:KIX5', '2026-12-27'], ['texpert:SEL5', '2026-12-24']), tours, today);
  expect(r2.legs).toHaveLength(1); expect(r2.droppedCount).toBe(1);
});
it('an empty chain resolves to nothing', () => { expect(resolveChain(st(), tours, today)).toEqual({ legs: [], droppedCount: 0 }); });
it('chainTotals', () => {
  const legs = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']), tours, today).legs;
  expect(chainTotals(legs)).toEqual({ priceHkd: 13698, priceIsExact: true, tourDays: 10, spanDays: 11 });
  const legs2 = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']), tours, today).legs;
  expect(chainTotals(legs2)).toMatchObject({ priceIsExact: false, spanDays: 12 });
  expect(chainTotals([])).toEqual({ priceHkd: 0, priceIsExact: true, tourDays: 0, spanDays: 0 });
});
it('nextWindow follows the last leg and the gap', () => {
  const legs = resolveChain(st(['egl:KIX5', '2026-12-18']), tours, today).legs;
  expect(nextWindow(legs, { min: 1, max: 3 })).toEqual({ from: '2026-12-24', to: '2026-12-26' });
  expect(nextWindow(legs, { min: 0, max: 0 })).toEqual({ from: '2026-12-23', to: '2026-12-23' });
  expect(nextWindow([], { min: 1, max: 3 })).toBeNull();
});

// ChainStrip.test.tsx
it('shows each leg with operator, dates and price', () => { /* '東瀛遊 · 12/18 – 12/22 · HK$7,999' */ });
it('shows the rest between legs', () => { /* two legs → '休息 1 日' */ });
it('shows the window for the next leg', () => { /* '可出發日：12/24 – 12/26' */ });
it('shows the total, marking an inexact total with 起', () => {
  /* exact: 'HK$13,698' and '10日（連休息共11日）'; inexact: text contains '起' */
});
it('a single leg shows only its days', () => { /* '5日', no 連休息 */ });
it('remove-last calls back', async () => {});
it('uses the operator colour on each leg', () => {});

// GapSelector.test.tsx
it('shows the current gap', () => { /* selects have values 1 and 3 */ });
it('changing the maximum calls onChange', async () => { /* → onChange({min:1,max:5}) */ });
it('raising the minimum above the maximum raises the maximum too', async () => { /* min → 5 with max 3 → onChange({min:5,max:5}) */ });
it('lowering the maximum below the minimum lowers the minimum too', async () => { /* gap 2–4, max → 1 → onChange({min:1,max:1}) */ });
it('offers 0 to 30', () => {});
```

Write every commented test in full.

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/chain.ts`, `ChainStrip`, `GapSelector`, the exclusion pill, the page, and the dictionary keys.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Try it against real data.** From the search page add a tour; on the chain page check that the window dates match the gap definition (a tour ending on the 22nd with 1–3 days gives the 24th–26th), change the gap and see the list change, exclude a country, add a second and third leg, remove the last leg, reload, and open the address in a private window. Then break the address by hand (`legs=egl:NOPE@2026-12-18`, `gap=9-2`, `gap=abc`) and confirm the page shows the empty state or the removal notice, never an error.
- [ ] **Step 6: Compare with the mockup's Screen 2** side by side.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(web): chaining page"`
