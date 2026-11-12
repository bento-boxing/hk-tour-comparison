# Task 4: Day headings → stops

**Goal:** turn an itinerary's day-by-day headings into the ordered list of places visited. Only headings are read, never the body text of a day.

**Files:**
- Create: `packages/core/src/stops.ts`
- Test: `packages/core/src/stops.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `PlacesIndex`, `normaliseName` (Task 3); `Stop` (Task 2).
- Produces:

```ts
export interface StopsResult { stops: Stop[]; unmatched: string[] }
/** excludeCityIds: places never shown on a route (Hong Kong, and the tour's start/end city). */
export function extractStops(dayHeadings: string[], index: PlacesIndex, excludeCityIds?: string[]): StopsResult;
```

## Rules (the algorithm the tests alone do not determine)

For each heading, in order:

1. Remove a leading day marker: `第一天`, `第1天`, `第 1 日`, `Day 1`, `DAY1`, `D1`, optionally followed by `:` `：` `-` or spaces.
2. Remove bracketed text: `(…)`, `（…）`, `【…】`, `[…]`.
3. Split into tokens on any of: `→ ➝ ⇒ ✈ ～ ~ - － – — > ＞ / ／ 、 ， , ｜ |` and whitespace.
4. For each token, in order:
   - exact `findCity` match → a city stop;
   - else the longest city name or alias contained in the token (minimum 2 characters) → a city stop;
   - else exact `findRegion` match → a region stop (`cityId: null`);
   - else exact `findCountry` match → ignore silently;
   - else, if the token is 2–8 characters and contains at least one CJK character and is not in the ignore list, add it to `unmatched`;
   - otherwise ignore.
5. If a name matches cities in more than one country, prefer the one whose country already appears among this tour's earlier stops; if none does, take the first and also add the token to `unmatched`.

Ignore list (a token containing any of these words is never reported as unmatched): `機場 酒店 自由活動 全日 原居地 啟程 回程 返港 抵達 出發 市內觀光 送機 接機 晚餐 午餐 早餐`.

After all headings: drop stops whose `cityId` is in `excludeCityIds`; collapse consecutive duplicates (same city, or same region when `cityId` is null); keep non-consecutive repeats. `unmatched` is de-duplicated, order of first appearance.

`excludeCityIds` defaults to `['hongkong-hongkong-hongkong']`.

## Steps

- [ ] **Step 1: Write the failing tests** in `stops.test.ts`. `names(r)` is a helper mapping stops to city `nameZh` (or region `nameZh` when `cityId` is null).

```ts
it.each([
  [['第一天 香港 → 大阪', '第二天 大阪 → 京都 → 奈良', '第三天 奈良 → 神戶', '第四天 神戶 → 大阪 → 香港'],
    ['大阪', '京都', '奈良', '神戶', '大阪'], []],
  [['Day 1: 香港✈首爾', 'Day 2 首爾－南怡島－江陵', 'DAY3 江陵 / 首爾', 'D4 首爾 ✈ 香港'],
    ['首爾', '南怡島', '江陵', '首爾'], []],
  [['第1日：香港 ～ 東京（成田機場）', '第2日：東京市內觀光'], ['東京'], []],
  [['香港 → 北海道', '札幌 → 小樽'], ['北海道', '札幌', '小樽'], []],
  [['香港 → 日本'], [], []],
  [['香港 → 大阪 → 亞特蘭提斯'], ['大阪'], ['亞特蘭提斯']],
  [['大阪 → 大阪 → 京都 → 京都'], ['大阪', '京都'], []],
  [['全日自由活動', '酒店 → 機場 → 香港'], [], []],
  [[], [], []],
])('extractStops(%j)', (headings, expectedNames, expectedUnmatched) => {
  const r = extractStops(headings, places);
  expect(names(r)).toEqual(expectedNames);
  expect(r.unmatched).toEqual(expectedUnmatched);
});

it('fills country and region ids', () => {
  expect(extractStops(['香港 → 大阪'], places).stops).toEqual([
    { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' },
  ]);
});

it('excludes a custom start city', () => {
  const r = extractStops(['深圳 → 桂林 → 陽朔 → 深圳'], places,
    ['hongkong-hongkong-hongkong', 'china-guangdong-shenzhen']);
  expect(names(r)).toEqual(['桂林', '陽朔']);
});

it('resolves a shared name using earlier stops, and flags it when it cannot', () => {
  // build a tiny index with 聖城 in two countries plus 甲市 in country a
  // ['甲市 → 聖城'] → 聖城 resolves to country a, unmatched []
  // ['聖城'] → first match used, unmatched ['聖城']
});
```

Write the last test in full using `buildPlacesIndex`.

- [ ] **Step 2: Run** `pnpm vitest run packages/core/src/stops.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `extractStops`** following the rules above.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): extract stops from day headings"`
