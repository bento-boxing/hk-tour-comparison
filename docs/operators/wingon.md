OWNER DECISION PENDING

DATES NOT AVAILABLE WITHIN THE RULES (the per-date prices, the full/closed status, the complete departure-date list and the gathering points are loaded in the browser by `POST` requests to `https://m.wingon-travel.com/restapi/wotapi/tbs-product-rest-api/…`, whose JSON body carries a `head` the site's script builds, including a time-based `tcks` token and tracking ids; a plain GET of allowed pages gives only a "from" price and up to 20 dates per status, without year or price, for the tours shown on listing pages)

# Wing On Travel 永安旅遊 (`wingon`): operator investigation

- Capture date: **2026-11-14** (Hong Kong). The pages were fetched 2026-11-13 21:45–22:16 UTC, which was 05:45–06:16 on 14 November in Hong Kong.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, one at a time, 3 s per site), with undici's `EnvHttpProxyAgent` installed as `cli.ts` does. All were GETs with no extra headers, cookies or tokens. Page fetches used: **12 of 12**, plus robots.txt on four hosts (not counted). Every request is listed under "Every URL fetched".
- Raw responses and the ledger are in `.superpowers/raw-pages/wingon/` (git-ignored). The probe script is outside the repository.
- No block page, captcha, JavaScript challenge, login wall, 403 or 429 was met. Akamai fronts `www.wingontravel.com` (`c-via: akamai`). Every page answered a plain GET with HTTP 200 and served HTML.
- The site runs on Trip.com Group's platform. Scripts come from `static.tripcdn.com`, the robots.txt response names `crash.trip.com` as a reporting endpoint, and 404 pages on the API host are Ctrip's (`携程旅行网`).

## Recommendation

**HOLD.** Three reasons:

1. **Dates and prices need a POST.** The tour page's price is `--` and its calendar is an empty placeholder in the HTML. The site's script fills them from `POST https://m.wingon-travel.com/restapi/wotapi/tbs-product-rest-api/product/product-price-calendar`. The JSON body is `{head: {...}, data: {productId}}`. The `head` holds `syscode`, a `tcks` token the script makes from the time (Base64 of system code + client time, with three random digits inserted), `cid`/`did` tracking ids from the browser's storage, `auth`, and `scene`. Gathering points come from a second POST (`…/product/departure-group-list`). Both are outside the rules: they are POSTs, and they need a client-made token. robots.txt does **not** forbid this host. `m.wingon-travel.com` has no robots.txt (HTTP 404), so it is not a robots matter. None of these POSTs was sent.
2. **The terms could not be read.** The footer's only terms link, `旅行團報名及責任細則` (`/information/content/tour-terms`), returns a page with no terms text. The site's script loads the text after the page opens, and finding that request would have taken fetches beyond the budget. The footer has no website terms of use (`使用條款`, `免責聲明` or similar), only `私隱政策` (privacy policy, not fetched). The footer says `All Rights Reserved.` (quoted below). **So it is not known whether Wing On's terms restrict automated access or reuse.**
3. **What a plain GET can reach is incomplete.** Allowed GETs give the tour list (sitemap: 1,222 tour URLs). Each tour page gives the title, tour code, days, day-by-day headings, cities and departure city. Listing pages also give a "from" price and up to 20 dates for each of three statuses. Those dates have no year and no price, and only the tours on that listing page are covered. A listing built only from GETs would have **no per-date prices and no full/closed marker**, and its date lists would be cut off at 20.

**What would lift the HOLD.** Any one of these:

- **Owner decision A (terms):** the owner reads `https://www.wingontravel.com/information/content/tour-terms` and `https://www.wingontravel.com/information/content/privacy-policy` in a browser. Or the owner allows a small further probe: one fetch of the information app's script to find the request that loads the terms text, plus that request itself if it is a GET on an allowed path. A or C is needed whatever else is decided.
- **Owner decision B (reduced listing):** the owner accepts Wing On tours without per-date prices or full/closed markers. That would also need a further probe of the country listing pages (`/tours/list/country-<n>.html`, not fetched) to check that they carry every tour with its "from" price and dates in the served HTML. Even then, the date lists hold at most 20 dates per status, without a year.
- **Ask Wing On (C).** A request for permission or a feed would need to cover:
  - for about 1,222 tours each night: departure dates, per-date price, full/closed status and gathering point, either through a feed or by allowing `POST …/product-price-calendar` and `…/departure-group-list`;
  - what a bot should send in place of the browser-made `head` (`tcks`, `cid`, `did`);
  - the rate (one request at a time, at least 3 s apart, User-Agent `tour-comparison-bot/0.1`);
  - publishing those facts on a personal, non-commercial comparison site with a link back to the tour page, copying no descriptions or images.

**The earlier survey, checked.** It said Wing On "likely needs a real browser; its API is disallowed by robots.txt". That is partly right and partly wrong:

- Wrong: the tour and listing pages are rendered on the server and answer a plain GET, and no challenge was met.
- Right: the dates and prices are loaded by browser script.
- Wrong about robots.txt: `www.wingontravel.com` does disallow `/api/`, but the tour data does not come from there. It comes from `m.wingon-travel.com/restapi/wotapi/`, which has no robots.txt. What stops us is the POST and the browser-made token, not robots.txt.

## Terms

Not read: the text is not in the served page. Here is what was looked at.

| Document | URL | Read | Result |
|---|---|---|---|
| 旅行團報名及責任細則 (tour booking and liability terms; the footer's only terms link) | https://www.wingontravel.com/information/content/tour-terms | 2026-11-14 (fetched 21:57:55 UTC on 13 Nov) | HTTP 200, 70,353 bytes. The page holds only the site header, a loading message `正在搜尋，請稍候` ("searching, please wait") and the footer. The text is loaded later by the `wireless-information-web` app (`main_14.8.1_20260929151513.js` and others on `static.tripcdn.com`). That script was not fetched, so the request that loads the text is **not known**. |
| 私隱政策 (privacy policy) | https://www.wingontravel.com/information/content/privacy-policy | not fetched | Same `/information/content/` app, so it is probably also a shell. **Not verified.** |
| Website terms of use | – | – | **No link found.** The footers of the home page and the terms page have no `使用條款`, `免責聲明`, `版權` or `條款及細則` link. The home page has a link `永安旅遊官方提示` ("Wing On official notice", `/promotion/activity/wot-official-channels-disclaimer/`), which was not fetched; from its name it is about official channels, but that is **not verified**. |

Clauses on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use: **not known**, because the terms text was not read. This is a gap, not a "none".

The only related text seen, verbatim from the footer of the home page and the terms page:

- `© 1999 - 2026 香港永安旅遊有限公司 Hong Kong Wing On Travel Service Limited. All Rights Reserved. 牌照號碼: 350074` ("© 1999–2026 Hong Kong Wing On Travel Service Limited. All Rights Reserved. Licence no. 350074"). A rights notice, not a clause.
- `本網頁所顯示之價格因應產品種類及出發日期而有所不同，不包括任何稅項、燃油附加費、行政費、簽証費、服務費(旅行團適用)及其他應繳費用` ("prices shown on this website vary by product and departure date and exclude taxes, fuel surcharges, administration fees, visa fees, service charges (for tours) and other charges"). It is about prices, not about using the content. Our "check with the operator" wording would cover it.
- In the tour pages (both samples), a booking note: `以上行程價格及其相關費用(例如手續費、稅項及旅遊業監管局印花成本等)可在永安旅遊網站查看或向分行職員查詢` ("the tour price and related charges (handling fee, taxes, TIA levy and so on) can be checked on the Wing On website or with branch staff"). Not about use.

The served tour pages (`/tours/detail-<id>`) have no footer in the HTML and no `©`, `版權` or `All Rights` text.

## robots.txt (`https://www.wingontravel.com/robots.txt`, read 2026-11-13 21:45:39 UTC)

HTTP 200, `text/plain`, `last-modified: Wed, 11 Nov 2026 09:05:45 GMT`. The whole file, verbatim. It has one group, `User-agent: *`. No group names AI or other bots, and there is no Crawl-delay.

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /marketing/
Disallow: /crm/
Disallow: /moto/

Sitemap: https://www.wingontravel.com/sitemap.xml
Sitemap: https://www.wingontravel.com/hotel/sitemap/sitemap.xml
Sitemap: https://www.wingontravel.com/flight/sitemap.xml
Sitemap: https://www.wingontravel.com/cruises/sitemap.xml
Sitemap: https://www.wingontravel.com/tours/sitemap-tbs.xml
Sitemap: https://www.wingontravel.com/package/sitemap.xml
Sitemap: https://www.wingontravel.com/ferry/sitemap.xml
Sitemap: https://www.wingontravel.com/train/sitemap.xml
Sitemap: https://www.wingontravel.com/local/sitemap.xml
Sitemap: https://www.wingontravel.com/promotion/sitemap.xml
Sitemap: https://www.wingontravel.com/discovery/sitemap.xml
Sitemap: https://www.wingontravel.com/things-to-do/sitemap.xml
```

`/tours/`, `/tours/detail-<id>`, `/tours/list/…`, `/information/content/…` and `/` are allowed. Only `/api/`, `/marketing/`, `/crm/` and `/moto/` are disallowed on this host.

Other hosts:

| Host | robots.txt | Meaning |
|---|---|---|
| `m.wingon-travel.com` (the tour data API, `/restapi/wotapi/…`) | HTTP 404 (Ctrip's error page) | No robots.txt: every path allowed (RFC 9309). No page on this host was requested. |
| `m.wingontravel.com` (the base for the other API calls, `https://m.wingontravel.com/api/`) | HTTP 301 → `https://www.wingontravel.com/` | No robots.txt of its own; it redirects to the home page. The fetcher's follow-up request to the home page was refused by the sandbox before it was sent (see the fetch log). How `createFetcher` would treat this host is therefore not settled. Nothing on this host is needed. |
| `static.tripcdn.com` (Trip.com's CDN; the site's scripts) | HTTP 404 (CloudFront) | No robots.txt: every path allowed. |

## Tour pages in the sitemap

- `https://www.wingontravel.com/tours/sitemap-tbs.xml` is an index of 31 child sitemaps: `dest`, `label`, `group`, `country`, `city`, `scenery`, `poi`, `product`, `article` and 22 `seo-*` ones. Only `product` holds tour pages.
- `…/tours/sitemap-tbs/product.xml` is itself an index of two files: `product/product-1.xml` (1,000 URLs) and `product/product-2.xml` (222 URLs).
- **Tour pages: 1,222 URLs, all of the form `https://www.wingontravel.com/tours/detail-<id>`, with no duplicates.** 608 ids are below 100,000 (`2945` to `24702`); 614 are 1,000,000 and up (`1000062` to `1001485`). The two samples suggest the two ranges are different products (see below), but that was not checked across the set. Every `lastmod` is the capture day (`2026-11-14`), `changefreq` is `daily`.
- Whether all 1,222 are on sale is not known. Both samples had `onlineStatus: 1`.

## Where each fact comes from

Two tour pages were read: `detail-4537` (`AJSGA05N`, Hokkaido 5 days, by air, `productType: 2`, `trafficType: 1`) and `detail-1000082` (`GEFFD02MJ`, Foshan and Guangzhou 2 days, by coach, `productType: 1`, `trafficType: 2`, `tourLineName: 廣東短線`).

Each tour page has an inline `<script>` that sets `window._initialData_ = {…}`. The object is valid JSON: parse from the first `{` after `=` to its matching `}`. Below, **"page JSON"** means `_initialData_.product`.

| Fact | Where | Path / selector | Example |
|---|---|---|---|
| Tour id | URL; page JSON | `product.productID` | `4537` |
| Tour code | page JSON; also the visible title ends with `(<code>)` | `product.productCode` | `AJSGA05N`, `GEFFD02MJ` |
| Title | page JSON; also `<title>` (with an SEO suffix) | `product.productName` | `日本5天團·北海道~道央 秋色美景5天之旅  賞紅葉名所(…)…1晚溫泉酒店` |
| Days | page JSON | `product.travelDays` (number) | `5`, `2` |
| Nights | **not given** | No nights field. Titles mention hotel nights (`1晚溫泉酒店`), which are not the tour's nights. | – |
| Day-by-day headings | page JSON | `tourRouteSegment[].title`, one per day in order (`journey[]` holds meals, hotels and sights with `type` codes) | day 1 `香港✈札幌─拉麵橫町(1小時)─晚餐自理─住宿酒店` |
| Cities / country | page JSON | `product.cityNameRoute` (comma list, repeats allowed), `cityIDRoute`, `countryNameRoute`, `firstCategoryName`, `areaTypeName` | `札幌,登別,洞爺湖町,札幌,小樽,札幌`; `佛山,廣州` (country `中國`, area `廣東省`) |
| Start / gathering point | **partly** | page JSON `product.departureCityName` (`香港` on both). Day 1's heading names the first place (`香港✈札幌`; `於羅湖【香格里拉酒店集合及享用自助早餐】…`). The structured `集合點` (meeting point) block is an empty placeholder in the HTML (`.meeting-point .item.sketch`). The script fills it from **`POST …/tbs-product-rest-api/product/departure-group-list`** (`meetingPoints` per departure group, read from the script). | `GEFFD02MJ` remark: `有關集合時間及地點，最遲於出發前一天下午三時後，以手機訊息通知閣下。` ("meeting time and place are sent by text message by 3 pm the day before") |
| "From" price | **not in the tour page** (`.price-now .detail-amount` is `--`). In **listing pages** only: `/tours/` `_initialData_.{hotProduct,toursAsianProducts,toursLongProducts,toursChinaProducts,toursGdProducts}[].price` / `.defaultPrice`, and `webRecommendData.defaultProducts[].minPrice` (+ `currency: "HKD"`). The home page has the same fields in its Next.js data. | `AJOCS05NB` `5899` (`originalPrice` `6199`) |
| Departure dates | **not in the tour page** (the calendar is `.wg-component-calendar.sketch`, empty). Complete list: **`POST …/product-price-calendar`** → `calendarList[].departureDate` (`"YYYY-MM-DD hh:mm:ss"`, read from the script). Partial lists in listing pages: `kDateStr`, `aboutToKDateStr`, `pDateStr` (`DD/MM`, comma list, **no year, at most 20 each**); `webRecommendData.defaultProducts[]` also has `kDates`, `aboutToKDates`, `pDates` as `"2026-12-11 00:00:00"` (also at most 20). | `kDateStr: "22/11,24/11,27/11,…"` |
| Per-date price | **only through the POST** `…/product-price-calendar`. The script reads per-date and per-group prices (`defaultPrice`, `MinPrice`, `DefaultPrice` in departure groups). Field names come from the script and were **not observed in a response**. | – |
| Full / closed | **only through the POSTs**. Calendar items carry `groupStatus` and `isAboutToK`, and departure groups carry `Remain` (seats left), read from the script and **not observed**. The listing's three date lists match the page's legend `已成團` (green, "tour confirmed") and `快將成團` (orange, "about to be confirmed"); the FAQ in the `/tours/` page says unmarked dates are not yet near the minimum. So `kDates` probably means confirmed and `aboutToKDates` almost confirmed. What `pDates` means is **not known**. No full or closed marker was seen anywhere in served HTML. | – |

`起價說明` ("about the from price") on both tour pages reads `本價格是按2026年11月27日出發的成人佔半房團費…` ("this price is the adult twin-share fare for the 27 November 2026 departure"). It is the same date on two unrelated tours, and `product.lowestPriceDate` is `""` on both, so the date looks like a template default rather than a fact about the tour. **Not verified.**

### The separate requests (read from the scripts, none sent)

The tour page's app is `wireless-tours-web` 14.9.5. Its code is in `common_14.9.5_20261104152337.js` and the lazy chunk `tours/webresources/controllers/detail_14.9.5_20261104152337.js` on `static.tripcdn.com`; the file names are hashed builds and will change.

- **API paths** (module `6KVL` in `common`): `GetProductPriceCalendarApi: "tbs-product-rest-api/product/product-price-calendar"`, `getProductDepartureGroupListApi: "tbs-product-rest-api/product/departure-group-list"`, `GetByProductDetailApi: "tbs-product-rest-api/product/product-detail"`, `GetListSearch: "tbs-app-api-dotnet/api/ProductEngine/Search"`, `GetDepartureDateProductApi: "tbs-product-rest-api/product/departure-date-product"` and others.
- **Base URL.** The base model's `getBaseUrl` uses `ctripRestfulApi` (`https://m.wingon-travel.com/restapi/wotapi/`) when the path starts with one of `CTRIP_RESTFUL_DOMAIN_SUPPORT`; the list includes `tbs-product-rest-api` and `tbs-app-api-dotnet`. Other paths go to `restfullApiHttps` (`https://m.wingontravel.com/api/`). So the calendar is **`POST https://m.wingon-travel.com/restapi/wotapi/tbs-product-rest-api/product/product-price-calendar`**.
- **Method and body.** The calendar model (`KEiO`) sets `this.method="POST"`, and the detail view calls `setModelParam({productId:<id>})`. For any POST, `getRequestParam` adds `head: getHeadInfo()`. The `head` has `syscode` (`"01"` for tours), `tcks` (built in `getTcks`: `syscode + Date.now() + server time offset`, with three random digits spliced in at position 10, then Base64), `cid` (from `localStorage.WINGON_TRACKING_CID`), `did`, `auth` and `scene` (`"pc-client|tbs|<route>"`). Responses are checked for `head.errcode === 0`.
- **robots.txt.** `m.wingon-travel.com` has none (404), so it allows these paths. They are excluded by the GET-only, no-token rules, not by robots.txt.
- Every model in these files that loads tour data is a POST. No GET endpoint for dates or prices was found in the three scripts read; the vendor bundle and the other chunks were not read.
- The scripts check the browser's User-Agent against a bot list (`/bot/i`, `/crawler/i`, `/spider/i`, …). On the tour page this only skips analytics registration (`this.isRobot||…register(…)`). It does not hide content.

## Gathering / departure point text (exact)

- `AJSGA05N` (Hokkaido, by air): `departureCityName` `香港`; day 1 `香港✈札幌─拉麵橫町(1小時)─晚餐自理─住宿酒店`; last day ends `─札幌✈香港`. Airlines (page JSON `airlines[].localName`): `國泰航空`, `香港航空`.
- `GEFFD02MJ` (Guangdong, by coach): `departureCityName` `香港`; day 1 `於羅湖【香格里拉酒店集合及享用自助早餐】早餐時間:08:30-09:30—酒店出發—順德—（約12:10抵達）午餐…`; remarks `有關集合時間及地點，最遲於出發前一天下午三時後，以手機訊息通知閣下。` and `於公眾假期出發之團隊，為避免集合地點/海關關口過於擠迫，集合時間將可能提早至早上06:00前，敬請留意。` ("on public holidays the gathering time may be moved before 06:00").
- The structured meeting point per departure is only in the `departure-group-list` POST (not sent).

## Number and date formats

- Prices: plain JSON numbers in HKD (`5899`, `minPrice: 999`, `currency: "HKD"`). Prose has `$800`, `港幣$500`, `$1,500`.
- Dates: listing strings are `DD/MM` with **no year** (`"22/11,24/11,…"`). They run in date order and cross the year end (`…,29/12,02/01,…`), so a year could be inferred, but that is fragile. `webRecommendData` has `"YYYY-MM-DD 00:00:00"`. The calendar POST uses `"YYYY-MM-DD hh:mm:ss"` according to the script (`departureDate.split(" ")[0]`).
- Days: `travelDays` is a number. Titles use `5天`.

## Fixtures

**None saved.** The facts that matter most (dates, per-date prices, status) are not in any page reachable within the rules, and the operator is on HOLD. The raw pages stay under `.superpowers/raw-pages/wingon/` only.

## Discovering tours and nightly cost

**Discovery:** `tours/sitemap-tbs.xml` → `tours/sitemap-tbs/product.xml` → `product/product-1.xml` and `product/product-2.xml`: 4 requests, **1,222 tour URLs** `/tours/detail-<id>`. The `/tours/` page also links country and region listings (`/tours/list/country-<n>.html`, `/tours/list/province-<n>.html`, `/tours/list/city-<n>.html`, `/tours/dest/<name>-<a>-<b>`). None was fetched, so whether they list every tour in the served HTML is **not known**.

**Requests per tour per night:**

| Route | Requests per tour | Per night (1,222 tours) | At 3 s each (plus response time) | Within the rules? | Fits the 170-minute job? |
|---|---|---|---|---|---|
| GET tour page only (title, code, days, day headings, cities; no price, no dates) | 1 | 4 + 1,222 = 1,226 | 61 min | yes | yes |
| + listing pages for "from" price and partial dates | 1 + share of listing pages | 1,226 + number of listing pages (not known) | over 61 min | yes, if the listings serve it (not verified) | probably |
| + calendar POST (all dates, per-date prices, status) | 2 | 4 + 2,444 = 2,448 | 2 h 2 min | **no** (POST, browser-made token) | yes, but tightly |
| + departure-group-list POST for gathering points | 2 + n (its parameters were not read; it may be per date) | over 2,448 | over 2 h 2 min | **no** | unlikely if per date |

## Every URL fetched (12 page fetches; robots.txt not counted)

All were GETs through `createFetcher`. "Bytes" is the size of the decoded body. The ledger (`.superpowers/raw-pages/wingon/ledger.tsv`) also lists the times each saved robots.txt was reused instead of fetched again.

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | 21:45:39 | https://www.wingontravel.com/robots.txt | 200, 793 bytes |
| 1 | 21:47:01 | https://www.wingontravel.com/tours/sitemap-tbs.xml | 200, 4,687 bytes (index of 31 sitemaps) |
| 2 | 21:48:33 | https://www.wingontravel.com/tours/sitemap-tbs/product.xml | 200, 628 bytes (index of 2) |
| 3 | 21:49:24 | https://www.wingontravel.com/tours/sitemap-tbs/product/product-1.xml | 200, 215,904 bytes (1,000 tour URLs) |
| 4 | 21:50:17 | https://www.wingontravel.com/tours/sitemap-tbs/product/product-2.xml | 200, 48,330 bytes (222 tour URLs) |
| 5 | 21:50:58 | https://www.wingontravel.com/tours/detail-4537 | 200, 202,456 bytes (tour data in `_initialData_`; price `--`, empty calendar; no footer) |
| 6 | 21:56:33 | https://www.wingontravel.com/ | 200, 493,948 bytes (fetched to find the terms link, which the tour page lacks; set a `GUID` cookie, which was not stored or sent back) |
| 7 | 21:57:55 | https://www.wingontravel.com/information/content/tour-terms | 200, 70,353 bytes (no terms text; loaded by script) |
| 8 | 22:02:28 | https://www.wingontravel.com/tours/ | 200, 406,177 bytes (listing: `price`, `kDateStr`, `aboutToKDateStr`, `pDateStr` for 39 product entries (37 distinct tours), plus `webRecommendData` with 10 more entries; 41 distinct tours in all) |
| – | 22:04:35 | https://static.tripcdn.com/robots.txt | 404 (no robots.txt) |
| 9 | 22:04:39 | https://static.tripcdn.com/modules/ibt/wireless-tours-web/prod/tours/dist/javascripts/main_14.9.5_20261104152337.js | 200, 33,548 bytes (bootstrap: chunk map, config) |
| 10 | 22:07:16 | https://static.tripcdn.com/modules/ibt/wireless-tours-web/prod/tours/webresources/controllers/detail_14.9.5_20261104152337.js | 200, 386,481 bytes (tour page view) |
| 11 | 22:10:08 | https://static.tripcdn.com/modules/ibt/wireless-tours-web/prod/tours/dist/javascripts/common_14.9.5_20261104152337.js | 200, 381,847 bytes (API paths, calendar model, base URL, `head`) |
| – | 22:12:19 | https://m.wingon-travel.com/robots.txt | 404 (no robots.txt) |
| – | 22:12:24 | https://m.wingontravel.com/robots.txt | 301 → `https://www.wingontravel.com/` |
| – | 22:12:24 | https://www.wingontravel.com/ (redirect hop of the line above) | **not sent**: the sandbox refused the connection, because that command was not allowed to reach `www.wingontravel.com`. Nothing reached the server, and the probe's budget guard stopped the fetcher's retries. Not counted. |
| 12 | 22:16:08 | https://www.wingontravel.com/tours/detail-1000082 | 200, 133,273 bytes (coach tour; same structure as #5) |

**Order of fetches.** The brief's order was sitemaps, terms, listing, tour pages, scripts. Tour page #5 came before the terms because the terms URL was not known: the tour page has no footer. It turned out to have no terms link, so #6 (the home page) was spent to find one. Scripts #9–#11 came before the second tour page so that the dates request could be found within the budget. #12 used the last fetch.

**Not fetched:** the privacy policy; `永安旅遊官方提示`; the information app's scripts (where the terms text request is); any country listing page (`/tours/list/…`); `/tours/departure-date-product`; a third tour page; the `vendor`/`crocodile-component` scripts; any request to `m.wingon-travel.com` or `m.wingontravel.com` other than robots.txt. No POST was sent.

## Not verified

- The terms' content (not read at all), and whether a separate website terms of use exists anywhere.
- The calendar and departure-group responses: field names come from the scripts, not from an observed response. Whether the API would answer without a valid `tcks`/`cid` is also unknown.
- Whether country listing pages serve every tour with a "from" price and dates.
- What `pDates` means; whether a date list cut at 20 hides later dates (it does on several tours: `24020` has 20 in each list).
- What `起價說明`'s date means.
- Whether the 1,000,000+ id range is consistently a different kind of product from the lower range (two samples only).
- How `createFetcher` would treat `m.wingontravel.com`, whose robots.txt redirects to the home page.
