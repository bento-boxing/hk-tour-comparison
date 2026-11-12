# Task 3: Places list and lookup

**Goal:** a hand-curated country → region → city list with Chinese names and alternate spellings, and fast lookups over it. This list powers city extraction, the destination filter and the search bar.

**Files:**
- Create: `packages/core/src/places/data.json`, `packages/core/src/places/index.ts`
- Test: `packages/core/src/places/index.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces — Produces:**

```ts
export interface Country { id: string; nameZh: string; nameEn: string; aliases: string[] }
export interface Region  { id: string; countryId: string; nameZh: string; nameEn: string; aliases: string[] }
export interface City    { id: string; regionId: string; nameZh: string; nameEn: string; aliases: string[] }
export interface PlacesData { countries: Country[]; regions: Region[]; cities: City[] }

export interface PlacesIndex {
  data: PlacesData;
  country(id: string): Country | undefined;
  region(id: string): Region | undefined;
  city(id: string): City | undefined;
  regionsOf(countryId: string): Region[];
  citiesOf(regionId: string): City[];
  /** Exact match on nameZh or an alias, after normaliseName. */
  findCity(name: string): City[];      // may return several (same name, different countries)
  findRegion(name: string): Region[];
  findCountry(name: string): Country[];
}
export function normaliseName(s: string): string; // trim, strip spaces, convert 臺→台, lower-case Latin
export function buildPlacesIndex(data: PlacesData): PlacesIndex;
export const places: PlacesIndex; // built from data.json
```

Ids are lower-case English slugs: country `japan`, region `japan-kansai`, city `japan-kansai-osaka`.

## Seed data

`data.json` must contain at least the following. Each operator task (15–18) extends it with whatever that operator sells.

| Country | Regions (id suffix: nameZh) | Example cities that must be present |
|---|---|---|
| 日本 `japan` | hokkaido 北海道, tohoku 東北, kanto 關東, chubu 中部北陸, kansai 關西, chugoku 中國地方, shikoku 四國, kyushu 九州, okinawa 沖繩 | 札幌 函館 小樽; 仙台; 東京 橫濱 箱根 日光; 名古屋 金澤 高山 富士山 (alias 富士河口湖); 大阪 京都 奈良 神戶 姬路 白濱; 廣島 岡山; 高松 松山; 福岡 長崎 熊本 鹿兒島 別府 由布院; 那霸 |
| 韓國 `korea` | seoul 首爾及京畿, gangwon 江原道, busan 釜山及慶尚, jeju 濟州 | 首爾 (alias 漢城) 南怡島; 江陵; 釜山 慶州 大邱; 濟州 |
| 台灣 `taiwan` | north 北部, central 中部, south 南部, east 東部 | 台北 九份 宜蘭; 台中 日月潭 阿里山; 高雄 台南 墾丁; 花蓮 台東 |
| 泰國 `thailand` | bangkok 曼谷及中部, north 北部, south 南部海島 | 曼谷 芭堤雅 (alias 芭達雅) 華欣; 清邁 清萊; 布吉 (alias 普吉) 蘇梅 喀比 |
| 中國 `china` | guangdong 廣東, beijing 北京及華北, shanghai 上海及華東, sichuan 四川重慶, yunnan 雲南, guangxi 廣西, fujian 福建, hunan 湖南, shandong 山東, xinjiang 新疆, tibet 西藏 | 廣州 深圳 珠海 潮州 汕頭; 北京 天津; 上海 杭州 蘇州 南京; 成都 重慶 九寨溝; 昆明 大理 麗江; 桂林 陽朔; 廈門; 張家界 長沙; 青島 蓬萊; 烏魯木齊; 拉薩 |
| 越南 `vietnam` | north 北部, central 中部, south 南部 | 河內 下龍灣; 峴港 會安; 胡志明市 |
| 新加坡 `singapore` | singapore 新加坡 | 新加坡 |
| 馬來西亞 `malaysia` | peninsular 西馬, borneo 東馬 | 吉隆坡 檳城 馬六甲; 沙巴 (alias 亞庇) |
| 香港 `hongkong` | hongkong 香港 | 香港 |
| 澳門 `macau` | macau 澳門 | 澳門 |

香港 and 澳門 exist so headings and start points can be recognised; Task 4 excludes Hong Kong from routes.

## Steps

- [ ] **Step 1: Write the failing tests** in `index.test.ts`:

```ts
it('finds a city by name', () => {
  expect(places.findCity('大阪').map(c => c.id)).toEqual(['japan-kansai-osaka']);
});
it('finds a city by alias and normalises 臺', () => {
  expect(places.findCity('漢城')[0].id).toBe('korea-seoul-seoul');
  expect(places.findCity('臺北')[0].id).toBe('taiwan-north-taipei');
  expect(places.findCity(' 大 阪 ')[0].id).toBe('japan-kansai-osaka');
});
it('walks city → region → country', () => {
  const city = places.findCity('京都')[0];
  expect(places.region(city.regionId)!.nameZh).toBe('關西');
  expect(places.country(places.region(city.regionId)!.countryId)!.nameZh).toBe('日本');
});
it('lists regions and cities', () => {
  expect(places.regionsOf('japan').length).toBe(9);
  expect(places.citiesOf('japan-kansai').map(c => c.nameZh)).toContain('神戶');
});
it('returns [] for unknown names', () => { expect(places.findCity('亞特蘭提斯')).toEqual([]); });
it('returns every match when a name is shared', () => {
  const idx = buildPlacesIndex({
    countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [] }, { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [] }],
    regions: [{ id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: '', aliases: [] }, { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: '', aliases: [] }],
    cities: [{ id: 'a-r-x', regionId: 'a-r', nameZh: '聖城', nameEn: '', aliases: [] }, { id: 'b-r-x', regionId: 'b-r', nameZh: '聖城', nameEn: '', aliases: [] }],
  });
  expect(idx.findCity('聖城').length).toBe(2);
});
it('data.json is internally consistent', () => {
  // every region.countryId and city.regionId exists; all ids unique; ids match the slug convention
});
```

Write the last test in full: it must fail on a dangling reference, a duplicate id, or an id that does not start with its parent's id.

- [ ] **Step 2: Run** `pnpm vitest run packages/core/src/places` — Expected: FAIL.
- [ ] **Step 3: Write `data.json`** with the seed table, and implement `index.ts`. Lookups use `Map`s keyed by `normaliseName`.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): places list and lookup index"`
