OWNER DECISION PENDING

# EGL Tours 東瀛遊 (`egl`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`); pages fetched 2026-11-12 22:13–22:31 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **10 of 10**.

## Recommendation

**HOLD.** The terms of use could not be read within the fetch budget, so it is not known whether they prohibit automated access or reproduction.

- The footer link `條款及細則` goes to `https://www.egltours.com/website/html/content.html?page=terms_and_conditions`, which is an empty shell. Its script (`includeHTML(page)` in `/website/html/header/assets/js/w3include.js`) loads the real text from `page + ".html?v=" + <start of the hour>`, that is **`https://www.egltours.com/website/html/terms_and_conditions.html`**. robots.txt allows that path, but EGL's 10 fetches were used up before it could be requested. **No terms text has been read; no clause can be quoted.**
- Everything else needed is reachable within robots.txt (see below), so if the owner reads that page (or allows one more fetch) and finds no prohibiting clause, this becomes `PROCEED`.
- Context, from robots.txt (not terms): EGL names AI crawlers explicitly. Our User-Agent is not among them and falls under `User-agent: *`:

  ```
  # Added 2026 - AI crawlers
  # Search / referral bots allowed (they cite egltours.com and send traffic)
  ...
  # Bulk training crawlers blocked (no referral traffic)
  User-agent: GPTBot
  Disallow: /
  ```

## robots.txt (`https://www.egltours.com/robots.txt`, read 2026-11-13)

`User-agent: *` disallows, among others: `/cas-b2c/`, `/itour/`, `/tour/fitPaxInfo`, `/tour/tourPaxInfo`, `/travel/pages/tour_view/`, `/travel/pdf/`, `/pdf_src/tour/tourpdf/`, `/EGLTBS/`, `/website/search-result/*`, `/website/location-search-result/*`, `/website/search-result-cruise/*`, `/nfit-cart-b2c-web/`, `/cart-tbs/`, `/cart-guru/`, `/tour/indexOnline3in1`. **`/website/itinerary/` and `/api/` are allowed.** No Crawl-delay.

## Tour pages in the sitemap

- `https://www.egltours.com/sitemap.xml` is one `urlset` (no index) with 1,232 URLs.
- Tour pages: **`/website/itinerary/<CODE>` (573)** and `/website/itinerary-premier/<CODE>` (2): **575** in all. Everything else (`/website/tour-location/…` 542, `/website/tour-line/…`, `/promo/…`, `/local-travel/…`, `/blog/…`, `/website/company-info/…`) is not a tour page.
- Codes are 8 characters, e.g. `HTJSJG06`; the last two digits match the day count in the samples. Prefixes: `HT` 478, `MT` 95 (the sample `MTJ3TA06` flies from **Macau**), `HE` 2 (premier), `HF` 1.
- An inline script sends `/website/itinerary/hc…` to `/website/cruise`; no `hc` codes were in the sitemap.

## Where each fact comes from

The tour page HTML has everything except the full list of departure dates and the per-date prices. Those come from one separate JSON request per tour (below), which robots.txt allows.

| Fact | Where | Selector / JSON path |
|---|---|---|
| Tour code | page | `.block-item--daily-itinerary-calendar-picker[data-tour-code]`; also `<script type="application/json">` with `product_code`, visible `團號：HTJSJG06`, and the URL |
| Title | page | first `<script type="application/ld+json">` (Product) → `name` (has `\uXXXX` escapes; JSON.parse handles them) |
| Days | page | hero `<p>` that contains `.block-item--itinerary-hero-price`: text `6天．` (note the full-width `．`); also the highest `dayNumber` in the day plans |
| Nights | not stated | No nights field. Titles sometimes mention hotel nights (`2晚北湯澤…`), which are not the tour's nights. |
| Day headings | page | `.block-item--daily-itinerary-plan-accordion[data-daily-itinerary-plans-json]` → JSON array; each item has `dayNumber`, `title` (may be `""`, as in `MTJ3TA06`) and `journeyTextRows[][].location` (the day's stops, e.g. `香港`, `直航札幌`, `拉麵橫丁`) |
| Start / end point | page | the transport block after the heading `出發交通資料` / `回程交通資料`: the first `p.egl-h5` is the origin (`香港`, `澳門`, `深圳羅湖口岸(地面)門前廣場(EGL旗號集合)`). Day 1's first `journeyTextRows` location is the same place. |
| "From" price | page | JSON-LD `offers.price` (a **string**, e.g. `"16899"`), `priceCurrency` `HKD`. The visible hero price `<span>` is empty in the HTML (filled by script). Also `data.sellingPrice` in the dates JSON. |
| Departure dates | **separate request** | `GET https://www.egltours.com/api/v1/tours/<CODE>/dates?currencyCode=HKD` → `data.dates[].departureDate` (ISO `YYYY-MM-DD`) |
| Per-date price | separate request | same JSON → `data.dates[].sellingPrice` (integer HKD; differs per date, e.g. 17999 / 17599 / 19199 / 16899) |
| Full / closed | separate request | same JSON → `data.dates[].isFull` (boolean). Also `isGuarantee` (成團), `isLessAvailableSeats` (few seats), `isOffline`, `tourPlanCodes` (e.g. `HTJSJG06-261227HB`), `carrierCodes`. No `isFull: true` date was seen in the three samples. |

**Where the dates request comes from.** The raw HTML shows the dates only as a heading line without a year (`出發日期： 12月21、22、24、27日`). The page's calendar (`ItineraryCalendarPicker` in `/assets/client/assets/website-BI98BOXS.js`, a hashed name that will change) calls `getAvailableDates(code, "HKD")` = `GET /api/v1/tours/${code}/dates?currencyCode=HKD` (a relative path; requesting it on `www.egltours.com` returned the data). It was fetched three times through `createFetcher`: HTTP 200, plain JSON, no login, cookie or token. It is **not** disallowed (robots.txt has no `/api/` rule). The bundle also shows `GET /api/v1/tours/${code}/tour-plans?selectedDate=…&reservedSeats=2&currencyCode=HKD` (per-date package detail), which was not needed and not fetched. `/itour/api/v1` exists in the bundle and **is** disallowed (`/itour/`); it is not needed.

Sample response (abridged):

```json
{"isSuccess":true,"data":{"productCode":"HTJSJG06","currency":"HKD","sellingPrice":16899,"dates":[
 {"tourPlanCodes":["HTJSJG06-261221"],"departureDate":"2026-12-21","isGuarantee":true,"isLessAvailableSeats":false,
  "isOffline":false,"isFull":false,"sellingPrice":17999,"carrierCodes":["HX"]}, …]}}
```

## Gathering / departure point text (exact)

- `HTGSZK02` (2-day Zhongshan): transport summary `深圳集散`; `深圳羅湖口岸(地面)門前廣場(EGL旗號集合)`; `12:30 集合 / 12:45 出發 (逾時不侯)`; `中途站 : 深圳灣口岸站地鐵C出口(EGL旗號集合)`; `深圳灣口岸站地鐵 C出口(EGL旗號集合)`; `13:30 集合/13:45出發<逾時不侯>`; return `深圳灣口岸 及 羅湖口岸 (解散)`; note `集合及解散地點: 【 深圳羅湖口岸 / 深圳灣口岸 】`; day 2 stops end `深圳灣口岸 及 深圳羅湖口岸(解散)`.
- `HTJSJG06` (Hokkaido): `乘坐香港航空或大灣區航空公司直航往返(日本時間快香港1小時)`; origin `香港` `上午08:30至09:10左右起飛`; day 1 stops `香港` › `直航札幌` › `拉麵橫丁`.
- `MTJ3TA06` (Tokyo, from Macau): `乘搭澳門航空往返(日本時間快澳門1小時)`; origin `澳門` `上午09:30左右起飛`; day 1 stops `澳門` › `東京成田機場`; `※ 不設延期返澳服務。`
- No page used the words `集合地點` or `出發地點` as a label.

## Number and date formats

- Prices: ASCII digits everywhere they are needed (JSON-LD string `"16899"`, JSON integers). Prose has `HK$1500`, `$4,000`, `HKD500`. One full-width digit seen, in prose only (`７.` in a numbered note on `HTGSZK02`).
- Dates: the HTML heading has **no year** and lists several months in one line (`11月21、27、28、12月4、5、11、12、18、19、25、26日`); the JSON has ISO dates. Use the JSON.
- Days: `6天．` with a full-width full stop `．` (U+FF0E).

## Fixtures (`packages/scraper/src/operators/egl/fixtures/`)

Saved with `pnpm --filter @hktours/scraper fixture --from <saved page> <output>` (trimmed by `trimFixture`). The date JSON files are the raw API responses, copied unchanged: they hold only codes, dates, prices and flags.

| File | Source | Why |
|---|---|---|
| `multi-city.html` + `multi-city.dates.json` | `/website/itinerary/HTJSJG06` | 6 days, Sapporo / Noboribetsu / Otaru / Kitahiroshima; 4 dates with 4 different prices; `isLessAvailableSeats` on two |
| `simple.html` + `simple.dates.json` | `/website/itinerary/HTGSZK02` | 2 days, one place (中山); gathers in Shenzhen; 11 dates, two at a higher price |
| `edge.html` + `edge.dates.json` | `/website/itinerary/MTJ3TA06` | **Starts in Macau** (Air Macau); every day `title` is empty, only stops are given |

Checked by eye: no personal data (only the company's published hotlines). No hand trimming was needed. Long day descriptions inside the day-plan JSON attribute are cut by `trimFixture` (strings over 120 characters); image URLs (not images) remain in that JSON.

## Every URL fetched (10 page fetches; robots.txt not counted)

| # | UTC | URL | Result |
|---|---|---|---|
| – | 22:13:20 | https://www.egltours.com/robots.txt | 200 |
| 1 | 22:13:54 | https://www.egltours.com/sitemap.xml | 200 |
| 2 | 22:16:11 | https://www.egltours.com/website/itinerary/HTJSJG06 | 200 |
| 3 | 22:18:37 | https://www.egltours.com/assets/client/assets/website-BI98BOXS.js | 200 (to find the dates request) |
| 4 | 22:20:45 | https://www.egltours.com/api/v1/tours/HTJSJG06/dates?currencyCode=HKD | 200 JSON |
| 5 | 22:29:37 | https://www.egltours.com/website/html/content.html?page=terms_and_conditions | 200 (empty shell) |
| 6 | 22:29:41 | https://www.egltours.com/website/itinerary/HTGSZK02 | 200 |
| 7 | 22:29:45 | https://www.egltours.com/api/v1/tours/HTGSZK02/dates?currencyCode=HKD | 200 JSON |
| 8 | 22:29:49 | https://www.egltours.com/website/itinerary/MTJ3TA06 | 200 |
| 9 | 22:29:53 | https://www.egltours.com/api/v1/tours/MTJ3TA06/dates?currencyCode=HKD | 200 JSON |
| 10 | 22:31:03 | https://www.egltours.com/website/html/header/assets/js/w3include.js | 200 (to find the terms text URL) |

Not fetched (budget): `https://www.egltours.com/website/html/terms_and_conditions.html`.
