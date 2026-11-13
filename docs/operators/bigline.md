OWNER DECISION PENDING

DATES NOT AVAILABLE WITHIN THE RULES (`api.biglinehk.com` answers our plain GET with `{"code":401,"msg":"未授权"}` ("unauthorised"); the site's own app sends `tenantCode`, `X-Device-Id` and `X-Device-Type` headers, which we must not imitate; and the departure dates and per-date prices are served only by a POST request, which is beyond a plain GET)

# Big Line Holiday 大航假期 (`bigline`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`). Task 14 pages were fetched 2026-11-12 22:13–22:34 UTC; Task 14b requests were made 2026-11-13 00:03–00:11 UTC; the Task 14c probe ran 2026-11-13 20:46–20:55 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **9 of 10** in Task 14. In Task 14b: **5 of 10** (3 script files on `bigline.hk` and 2 API calls on `api.biglinehk.com`), plus that host's robots.txt. In Task 14c: **7 of 12** requests to `api.biglinehk.com`, robots.txt included.

## Recommendation

**PROCEED, on three conditions for the owner.** The three reasons for the earlier HOLD are gone:

1. **The API answers with one static header.** With `tenantCode: DH` added (no device id, no device type, no cookie, no token), every request was answered with data (`"code":200`). `DH` is a fixed value written into the site's public JavaScript and page state (`apiHostCode: "DH"`). It is the same for every visitor and identifies the site, not a person or a device.
2. **The dates and per-date prices are reachable.** `POST /bigline/global/product/release/page` with the site's own JSON body returned every departure of the month with its date, prices and seats left. `createFetcher` now has `postJson`. A POST goes through the same robots.txt check, queue, 3 s spacing and pushback rules as a GET, and it is never retried.
3. **The terms were read, and nothing in them stops us.** The user agreement, the privacy policy and the member agreement have no clause on automated access, robots, crawling, scraping, copying or reproduction. They also have no personal or non-commercial use limit. The nearest clauses are quoted under "Terms" below. The footer still says `All rights reserved`. We would copy facts (dates, prices, day count, gathering point), not text.

The conditions:

- **A standing approval for the header and the POST.** The owner approved them for this probe only. A nightly scraper would send `tenantCode: DH` and one POST per month on every run.
- **The nightly cost does not fit as it stands.** One tour needs 1 detail GET plus 1 POST per month it has departures in. Tour 9109 has 8 months, so it needs 9 requests. If all 586 sitemap tours were like that, a night would take 5,274 requests, about 4 h 24 min at 3 s each (plus response time). The nightly job's limit is 170 minutes. A horizon of the next 3 months would make it 586 × 4 = 2,344 requests, about 1 h 57 min plus response time. That fits, but tightly. How many months the other tours have was not measured (see "Nightly cost").
- **The API returns internal and personal data along with the public facts.** Examples: a tour leader's full name (`data.list[].tourLeader[].guideName`), staff sales notes (`internalSaleRemark`, e.g. "(a short staff sales note)", roughly "we need customers, the flights are booked, we need 6 guests"), supplier names and supplier cost prices, and leader subsidies. The scraper must keep only the public facts listed under "Where each fact is in the API". Any fixture must be trimmed down to those facts. The raw probe responses stay under `.superpowers/` and should be deleted once the fixtures are made.

The plan's note that the data is in embedded page state (`__NUXT__`) is no longer true: the embedded state now carries only SEO fields.

## Owner decision (2026-11-13)

The owner explicitly authorised one staged probe of `api.biglinehk.com`, and nothing beyond it. The steps were to be done in this order, stopping at the first failure:

1. **Terms first**: `GET /bigline/global/protocol/center?protocolId=1` with the one extra header `tenantCode: DH`. The brief allowed one retry with `X-Device-Type: Web` and an `X-Device-Id`. **The owner withdrew that retry during the task, before any request was sent:** no device header was to be sent at all, and a refusal of `tenantCode` alone meant stop. A block page, captcha or rate limit, or HTTP 403/429, also meant stop.
2. **Read the terms**: at most 3 documents, plus the listing call once if needed. A clause prohibiting automated access, scraping or reproduction meant stop all fetching (HOLD). A personal or non-commercial use limit was to be recorded and flagged.
3. **One tour detail**: `GET /bigline/global/product/tour/frontend/detail?id=9109` with the smallest header set that worked.
4. **One dates request** (at most 2 POSTs, for two different months): `POST /bigline/global/product/release/page` with the site's JSON body, the same headers, plus `Content-Type: application/json`. Then stop. No listing or crawl calls.

Rules for every request: our honest User-Agent, robots.txt obeyed, one request at a time at least 3 s apart, all through `createFetcher`, a hard cap of 12 requests. Not allowed: cookies, browser-like headers (Referer, Origin, Accept-Language, `sec-*`), login, or a token from any user session. This was permission to probe, not approval of the operator.

## Task 14c probe: what was sent and what came back

Each request was logged to `.superpowers/raw-pages/bigline/ledger-probe.tsv`, and each raw response was saved beside it as `probe-*.json` (git-ignored). The probe script is outside the repository. Each request carried `user-agent: tour-comparison-bot/0.1`, plus undici's defaults (`accept: */*`, `accept-language: *`, `sec-fetch-mode: cors`, `accept-encoding`), and only the extra headers listed below. No cookie, Referer, Origin, Authorization, `X-Device-Id` or `X-Device-Type` was sent at any point. Nothing was retried.

| # | UTC (2026-11-13) | Method and URL | Extra headers | HTTP | JSON `code` | Bytes |
|---|---|---|---|---|---|---|
| 1 | 20:46:26 | GET https://api.biglinehk.com/robots.txt | none | 200 | 500 (`404 NOT_FOUND`: no robots.txt, everything allowed, as in Task 14b) | 34 |
| 2 | 20:46:32 | GET …/bigline/global/protocol/center?protocolId=1 (user agreement 用戶協議) | `tenantCode: DH` | 200 | **200** | 14,412 |
| 3 | 20:48:15 | GET …/bigline/global/protocol/center?protocolId=2 (privacy policy 隱私政策) | `tenantCode: DH` | 200 | 200 | 38,851 |
| 4 | 20:49:57 | GET …/bigline/global/protocol/center?protocolId=8 (member agreement 會員服務協議) | `tenantCode: DH` | 200 | 200 | 18,330 |
| 5 | 20:50:32 | GET …/bigline/global/product/tour/frontend/detail?id=9109 | `tenantCode: DH` | 200 | 200 | 73,823 |
| 6 | 20:53:15 | POST …/bigline/global/product/release/page, body `{"pageNo":1,"productId":"9109","yearMonth":"2026-12","pageSize":1000}` | `tenantCode: DH`, `Content-Type: application/json` | 200 | 200 | 104,041 |
| 7 | 20:54:33 | POST …/bigline/global/product/release/page, body `{"pageNo":1,"productId":"9109","yearMonth":"2026-11","pageSize":1000}` | `tenantCode: DH`, `Content-Type: application/json` | 200 | 200 | 60,025 |

- **Step 1.** `tenantCode: DH` alone was enough, so the minimal header set is that one header. The retry with device headers was neither needed nor sent. No block page, captcha, rate limit, 403 or 429 was seen at any step.
- **Step 2.** The listing call was not needed. Every `protocol/center` answer carries `data.typeList`, the list of all 9 documents: 1 用戶協議 (user agreement), 2 隱私政策 (privacy policy), 3 旅行團報名及細則 (tour booking terms), 4 旅遊保險 (travel insurance), 5 簽證須知 (visa notes), 6 旅客須知 (traveller notes), 7 惡劣天氣團隊安排說明 (bad-weather arrangements), 8 會員服務協議 (member agreement), 9 註銷服務協議 (account closing). Three were read: 1, 2 and 8. The other six are about booking, travelling and accounts.
- **Step 3.** The detail came back in full (fields below).
- **Step 4.** The body follows the site's JS. The tour component calls the release API with `{pageNo: 1, productId, yearMonth}`, and the API function adds `pageSize: 1000`. `productId` is the route id as a string (`/tour-group/9109` → `"9109"`). When there is no route id, the JS uses the detail's `productId` (here `null`) and then its `id` (here `9109`), so the value is the same. `yearMonth` is `YYYY-MM`, taken from `availableMonths`. Two months were asked for. December had no full departures, so November (the current month) was asked for second, to see what a full date looks like. Fetching stopped there: 5 of the 12 allowed requests were left unused.

## Terms (read 2026-11-13 from `protocol/center`)

None of the three documents read has a clause on automated access, robots, crawling, scraping, copying or reproduction. None has a personal or non-commercial use limit either. These are the only clauses that come near those topics (short quotations, with an English gloss):

- User agreement, 3.2(6): 「不得利用本網站侵犯本公司、第三方供應商或其他用戶的合法權益（包括但不限於知識產權、名譽權、隱私權等）」: users must not use the site to infringe the lawful rights of the company, its suppliers or other users, including intellectual property, reputation and privacy. Listing facts with a link is not that. The personal data the API returns (above) must not be republished, which is also what this clause protects.
- User agreement, 4.1(2): 「有權對用戶的註冊信息、使用行為進行審核、監測，對違反本協議、法律法規或惡意使用服務的用戶，有權採取警告、限制賬號功能…等措施」: the company may review and monitor how users use the site, and may act (warnings, account limits and so on) against users who break the agreement or use the service maliciously. This is aimed at accounts. We have none.
- User agreement, 7.6: 「因網絡傳輸延遲、數據緩存等原因導致本網站展示的產品信息（如價格、庫存等）出現臨時錯誤，本公司有權更正該信息」: prices and availability shown on the site may be briefly wrong, and the company may correct them. Our "check with the operator" wording covers this.
- Privacy policy, opening: 「任何人士如瀏覽本平台，即表示已閱讀、理解並接納本聲明之內容及同意受其約束」: anyone who browses the platform accepts this statement. The statement is about personal data and cookies, and has nothing on automated access.
- The privacy policy refers to 「我們的 Cookie 條款與條款及細則」 ("our cookie terms and terms and conditions"). No separate website terms and conditions appear among the 9 documents in `typeList`. The cookie terms are part of the privacy policy. **Not verified:** whether a website T&C exists somewhere else. The footer of `bigline.hk` links two documents: 《用戶協議》 (`protocolId=1`) and 《隱私政策》 (`protocolId=2`), both read.
- The member agreement (8) is about the loyalty points scheme only. Nothing in it is relevant.

## Where each fact is in the API (observed in Task 14c)

Detail: `GET /bigline/global/product/tour/frontend/detail?id=<id>` → `data`. Dates: `POST /bigline/global/product/release/page` → `data.list[]`, one entry per departure, plus `data.total`, `data.pageNum` and `data.pageSize`.

| Fact | Path | Example (tour 9109) |
|---|---|---|
| Tour id | detail `data.id`, the same as the sitemap id; dates `data.list[].productId` | `9109` |
| Tour code | detail `data.basic.tourNo`; dates `data.list[].tourNo` | `CSIAA06` |
| Title | detail `data.basic.nameCn`; dates `data.list[].nameCn` | `【純玩•西安】（提升2+1旅遊巴及粵語導遊） 西嶽華山 … 直航6天` |
| Days | detail `data.basic.tourDays`; dates `data.list[].tourDays` | `6` |
| Nights | **not in either response.** The top-level `data.durationNights` and `data.durationDays` are `null`. | – |
| Day headings | detail `data.projectItinerary.dailyTripList[]`: `.days` (day number) and `.tripContent` (the route, places separated by `~`, with a leading `.`) | day 1 `.香港機場集合~西安機場~入住酒店` |
| Start / gathering point | detail `data.signUp.locationGroupList[].locationName` and `.startTime`; per departure `data.list[].departurePlace[].locationName` and `.startTime`. Top-level `data.gatheringPlace` is `""`. | `香港國際機場`, start time `待定` (to be confirmed) |
| "From" price | detail `data.memberFee` (`data.basic.memberFee` is `null`). The front end shows `memberFee` with 「起」 ("from"). `adultFee` is $10 higher. | `5799` (HKD: `data.signUp.settlementCurrencyCode`) |
| Months with departures | detail `data.availableMonths` (`YYYY-MM`) | `2026-11` … `2027-06` (8 months) |
| Departure dates | dates `data.list[].scheduleDate` (`YYYY-MM-DD`). **Past dates are included**: the November answer had 11-04 and 11-11, before the capture date 11-13. | 7 in 2026-12, 4 in 2026-11 |
| Per-date price | dates `data.list[].memberFee` (also `adultFee`, `childFee`, `babyFee`; numbers such as `6899.0`; `currencySymbol` is `null`) | 12-01 `5799.0` … 12-25 `6899.0` |
| Full | observed together on all 3 full departures (2026-11-04, -11, -22): `seatRemain: 0`, `soldTotal` equal to `maxPersonTotal`, `registrationStatus: 1` and `tourFlag` containing `5` (`"1,2,5"`). Open departures had `seatRemain` 3–14, `registrationStatus: 0`, and no `5` in `tourFlag`. The front end's own "已滿" (full) test is the function `ot` in chunk `/_nuxt/C8-td2ew.js`. That chunk was not fetched, so the exact rule is **not verified**. `seatRemain === 0` is the safest reading. | |
| Closed / cut off | `data.list[].isCutofftour` was `false` on all 11 departures; no closed departure was seen. `tourStatus` was `"1"` on 10 departures and `"2"` on one (2026-12-01: `maxPersonTotal: 3`, `releaseStatusDaily: ""`). What `"2"` means is **unknown**. | |
| Guaranteed departure | `data.list[].releaseStatusDaily: "已成團"` ("tour confirmed") on 10 of 11 departures | |

**Do not take** these fields: `tourLeader`, `guideLeader`, `internalSaleRemark`, `internalRemark`, `agencySupplier`, `projectItinerary.projectItineraryList` (supplier names and cost prices), `extraCost`, `salesCommission`, `soldTotal`/`soldCount` beyond the full test, `departureFlightTime`/`returnFlightTime` (staff-typed text), or `reservationPolicies` (long terms text).

## Discovering tours and nightly cost

**Tour ids** come from the sitemap: `https://bigline.hk/sitemap-1.xml` lists 586 `https://bigline.hk/tour-group/<id>` URLs, out of 691 URLs in all. `<id>` is the `id` the detail endpoint takes. The site also has a GET tour listing (`/bigline/global/product/tour/frontend/page`). It was not called, so what it returns is unknown.

**Requests per tour per night:** 1 detail GET, plus 1 POST for each month in `availableMonths`. Tour 9109 needs 1 + 8 = 9. One sample does not give the average for all tours. Tours that are no longer sold may have no months: they would need just the detail call, or they may be gone from the API.

| Assumption | Requests per night | At 3 s each (plus response time) | Fits the 170-minute nightly job? |
|---|---|---|---|
| Sitemap fetch only (index + 1 child) | 2 on `bigline.hk` | – | – |
| 586 tours × 9 (every tour like 9109) | 5,274 | 4 h 24 min | **no** |
| 586 tours × 4 (detail + the next 3 months only) | 2,344 | 1 h 57 min | yes, but tightly |
| 586 tours × 2 (detail + the current month only) | 1,172 | 59 min | yes |
| all 691 sitemap URLs × 9, if non-tour pages were also counted | 6,219 | 5 h 11 min | no (only the 586 tour URLs are needed) |

Ways to cut the cost, none of them tried: a months horizon; skipping a tour's POSTs when its detail shows no `availableMonths`; or spreading tours across nights.

## Owner decision (2026-11-12)

The owner permitted reading the data host `api.biglinehk.com`: its robots.txt first, and the API itself only if robots.txt allows the paths needed. Both were done (below). This was permission to look, not approval of the operator; Big Line is not approved.

## robots.txt (`https://api.biglinehk.com/robots.txt`, read 2026-11-13 00:03:38 UTC)

The response was HTTP 200 with `Content-Type: application/json` and this body, verbatim (34 characters, no trailing newline):

```
{"code":500,"msg":"404 NOT_FOUND"}
```

The host has no robots.txt: its API framework answers the path with a "not found" error. `createFetcher` parsed the body as a robots.txt with no rules, so it allowed every path, which is the same result as a 404 ("no restriction from robots"). Note that this API reports errors inside the JSON `code` field, not in the HTTP status.

## The API (read from the site's own JavaScript)

**Base URL** `https://api.biglinehk.com/`, from `window.__NUXT__.config.public.appBaseApi` and hard-coded in the request client `/_nuxt/Bk0Y8-wa.js`. Paths are joined to it without their leading `/`.

**What the site's request client sends** (`/_nuxt/Bk0Y8-wa.js`, the `onRequest` hook of its `$fetch` instance):
- on every request: `Content-Type: application/json` (unless the body is form data), `tenantCode: DH`, `X-Device-Id: <id>` and `X-Device-Type: Web`;
- `Authorization: Bearer <token>` only when a user is logged in (the token is kept in `localStorage`);
- the request option `credentials: "include"`, so the browser also sends any cookies;
- no signature, timestamp or nonce. The RSA keys in the page state are used only for login.

The device id is generated in the browser as `web_` plus `crypto.randomUUID()` without dashes (falling back to `web_<time>_<random>`; `web_ssr` during server rendering) and kept in `localStorage` as `bl_web_device_id`. `DH` matches `apiHostCode: "DH"` in the page state.

**Endpoints the tour page uses** (`/_nuxt/DCBnc137.js`, called from the tour detail component `/_nuxt/DJSmirVR.js`):

| Purpose | Method and path | Parameters | Called? |
|---|---|---|---|
| Tour detail (title, tour number, `availableMonths`, gathering points `signUp.locationGroupList`, days `projectItinerary.dailyTripList`) | `GET /bigline/global/product/tour/frontend/detail` | `?id=<numeric id from /tour-group/<id>>` or `?tourNo=<code>` | **yes, once** (`id=9109`): `{"code":401,"msg":"未授权"}` |
| Departure dates and per-date prices for one month | **`POST`** `/bigline/global/product/release/page` | JSON body `{pageNo: 1, productId, yearMonth: "YYYY-MM", pageSize: 1000}` | no (POST) |
| Seats and rooms for one selected departure | `GET /bigline/global/product/tour/frontend/get-bookseat-jointour/<departure id>` | the id comes from the month list above | no (needs the POST's result) |
| User agreement / privacy text | `GET /bigline/global/protocol/center` | `?protocolId=<id>` (the footer's `《用戶協議》` link uses `1`); without a parameter it lists the agreements | **yes, once** (`protocolId=1`): `{"code":401,"msg":"未授权"}` |

The field names in the first row are what the front-end code reads from the detail response. They were not observed in Task 14b, because the API returned no data. Task 14c observed them (see "Where each fact is in the API"); the detail and dates rows above were called then with `tenantCode: DH`. The same chunk also has a GET tour listing (`/bigline/global/product/tour/frontend/page`) that the tour page does not use. It was not called, and its contents are unknown.

No fixtures were saved: no tour data was returned.

## robots.txt (`https://bigline.hk/robots.txt`)

```
User-agent: *
Allow: /

Sitemap: https://bigline.hk/sitemap.xml
```

## Tour pages in the sitemap

`https://bigline.hk/sitemap.xml` is an index with one child, `https://bigline.hk/sitemap-1.xml` (691 URLs). Tour pages: **`https://bigline.hk/tour-group/<numeric id>`: 586.** Others: `/free-travel/package/<id>` 50, `/travel-note/<id>` 35, `/activity/page/<id>` 8, `/destinations/<name>` 7, plus single pages. The app's router also has `/tour-group/cruise/:id`, but the sitemap lists none.

## Where each fact comes from

What the server-rendered tour page contains (checked on two tours, `9109` and `8923`):

| Fact | In the page? | Where |
|---|---|---|
| Title | yes (SEO only) | `<script type="application/json">` (`__NUXT_DATA__`, devalue format) → `seo-page:TOUR:<id>` → `title`, e.g. `西安直航6天旅行團｜華山、兵馬俑、大唐不夜城與長安十二時辰主題街區 - 大航假期「中國旅游專家」` |
| Days | only inside the SEO title or description (`6天`, `5天`) | same |
| Tour code | sometimes, in SEO keywords (`清邁清萊旅行團,BKKCA05,中國旅游專家` on `8923`; none on `9109`) | same → `keywords` |
| Nights, day headings, start/end point, "from" price, departure dates, per-date prices, full/closed | **no** | loaded in the browser |

The visible body is the site header, the footer and a loading skeleton (`aria-label="旅行團詳情加載中"`).

**The separate request.** `window.__NUXT__.config.public.appBaseApi` is `"https://api.biglinehk.com/"` (with `apiHostCode: "DH"`). The app's API client calls paths relative to it; the one seen is `bigline/global/seo/page` (in `/_nuxt/DRm_WKFd.js`). The tour detail component (`/_nuxt/DJSmirVR.js`, via the route chunk `/_nuxt/Dv_9fUjz.js`) builds its request from the route as `{tourNo}` or `{productId}`. The exact tour-detail path is in a chunk not fetched in Task 14, so the full URL could not be recorded then. The page state also has `token`, `refreshToken` and `rsaPublicKey` fields. **Task 14b update:** the paths, methods and headers are now recorded under "The API" above. `token` and `refreshToken` are used only for logged-in users, and the RSA keys only for login. The tour-detail URL for `/tour-group/9109` is `https://api.biglinehk.com/bigline/global/product/tour/frontend/detail?id=9109`.

## Gathering / departure point text

None is in the HTML. The only place text is in the SEO descriptions:

- `9109`: `直航西安6天，遊華山、秦始皇陵兵馬俑與大唐不夜城，走訪高家大院及長安十二時辰主題街區，體驗古都歷史與民間藝術。`
- `8923`: `香港直航清邁，5天遊雙龍寺、清邁古城及清萊，轉乘九人商務車走訪美斯樂華人村與茶園，並入住美斯樂度假村一晚。`

## Number and date formats

No prices or dates are in the pages, so nothing to report. The SEO text uses ASCII digits (`6天`, `5天`).

## Fixtures

**None saved**: none of the facts is in the `bigline.hk` pages, and the API that serves them returned no data to a plain GET (`{"code":401,"msg":"未授权"}`). There is nothing to trim, so `trimFixture` was not changed.

Task 14c: the API responses are saved only as raw pages under `.superpowers/raw-pages/bigline/` (git-ignored). They contain personal and internal data, so they must not be committed as they are. A fixture must keep only the fields in "Where each fact is in the API".

## Every URL fetched (Task 14: 9 page fetches; Task 14b: 5; robots.txt not counted)

### Task 14

| # | UTC | URL | Result |
|---|---|---|---|
| – | 22:13:21 | https://bigline.hk/robots.txt | 200 |
| 1 | 22:13:52 | https://bigline.hk/sitemap.xml | 200 (index) |
| 2 | 22:15:42 | https://bigline.hk/sitemap-1.xml | 200 |
| 3 | 22:16:11 | https://bigline.hk/tour-group/9109 | 200 (no tour data) |
| 4 | 22:26:32 | https://bigline.hk/_nuxt/DaXYCoAd.js | 200 (app entry: router, chunk map) |
| 5 | 22:27:19 | https://bigline.hk/_nuxt/Dv_9fUjz.js | 200 (tour route chunk) |
| 6 | 22:27:49 | https://bigline.hk/_nuxt/DJSmirVR.js | 200 (tour detail component) |
| 7 | 22:28:41 | https://bigline.hk/_nuxt/DRm_WKFd.js | 200 (fetch parameters, API paths) |
| 8 | 22:29:36 | https://bigline.hk/user-agreement?protocolId=1 | 200 (no agreement text) |
| 9 | 22:33:23 | https://bigline.hk/tour-group/8923 | 200 (no tour data; confirms 9109 is typical) |

Not requested in Task 14: anything on `api.biglinehk.com`, `h5.bigline.hk` or `www.bigline.hk`.

### Task 14b (budget: 10 requests to `api.biglinehk.com` and `bigline.hk` combined, robots.txt not counted; 5 used)

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | 00:03:38 | https://api.biglinehk.com/robots.txt | HTTP 200, `{"code":500,"msg":"404 NOT_FOUND"}` (no robots.txt; everything allowed) |
| – | – | https://bigline.hk/robots.txt | **not requested again**: `createFetcher` was given the copy saved in Task 14 (read 2026-11-12 22:13:21 UTC, under 2 hours earlier; RFC 9309 allows caching for up to 24 hours), so no URL was requested twice |
| 1 | 00:05:02 | https://bigline.hk/_nuxt/DCBnc137.js | 200, 3,105 characters (the API functions: paths and methods) |
| 2 | 00:08:57 | https://bigline.hk/_nuxt/Bk0Y8-wa.js | 200, 89,813 characters (the request client: base URL, headers, error handling; also the agreement API) |
| 3 | 00:09:02 | https://bigline.hk/_nuxt/Dor4AHE3.js | 200, 17,414 characters (the user agreement page: which API call loads the text) |
| 4 | 00:11:19 | https://api.biglinehk.com/bigline/global/product/tour/frontend/detail?id=9109 | HTTP 200, body `{"code":401,"msg":"未授权"}`: **stop** |
| 5 | 00:11:23 | https://api.biglinehk.com/bigline/global/protocol/center?protocolId=1 | HTTP 200, body `{"code":401,"msg":"未授权"}`: **stop** |

Every request was a GET with exactly the headers `createFetcher` sets (`user-agent: tour-comparison-bot/0.1`), plus the defaults of Node's fetch (undici): `accept: */*`, `accept-language: *`, `sec-fetch-mode: cors` and `accept-encoding`. The headers were seen on a local test server. Nothing was retried. Not requested: any further tour, the month-dates POST, `h5.bigline.hk`, `www.bigline.hk`.
