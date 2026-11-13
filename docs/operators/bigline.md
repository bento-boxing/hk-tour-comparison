OWNER DECISION PENDING

DATES NOT AVAILABLE WITHIN THE RULES (`api.biglinehk.com` answers our plain GET with `{"code":401,"msg":"未授权"}` ("unauthorised"); the site's own app sends `tenantCode`, `X-Device-Id` and `X-Device-Type` headers, which we must not imitate; and the departure dates and per-date prices are served only by a POST request, which is beyond a plain GET)

# Big Line Holiday 大航假期 (`bigline`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`). Task 14 pages were fetched 2026-11-12 22:13–22:34 UTC; Task 14b requests were made 2026-11-13 00:03–00:11 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **9 of 10** in Task 14. In Task 14b: **5 of 10** (3 script files on `bigline.hk` and 2 API calls on `api.biglinehk.com`), plus that host's robots.txt.

## Recommendation

**HOLD.** Each of these three reasons is enough on its own:

1. **The data host refuses a plain request.** `api.biglinehk.com` serves all tour data: the `bigline.hk` pages carry none of it. Asked for one tour's detail with a plain GET (our User-Agent, no other headers), it answered `{"code":401,"msg":"未授权"}` ("unauthorised", inside an HTTP 200 response). The site's own front end sends three extra headers on every API request: `tenantCode: DH`, `X-Device-Id` (a random id each browser stores) and `X-Device-Type: Web`. Sending them would imitate the site's own app, which the rules forbid, so it was not tried. Which header, if any, the API is missing could not be determined without sending them.
2. **The departure dates and per-date prices come only from a POST request** (`POST /bigline/global/product/release/page`, one per month). `createFetcher` makes only GET requests, and the rules allow nothing beyond a plain GET. So even if the 401 were lifted, the dates would not be reachable within the rules. No GET was tried against that path: it would be a guessed request the site never makes.
3. **The terms are unread.** The user agreement text loads from the same API (`GET /bigline/global/protocol/center?protocolId=1`), which gave the same answer, `{"code":401,"msg":"未授权"}`. No clause can be quoted, so the PROCEED/HOLD test cannot be applied. The only rights text on the site is the footer:

   > 大航假期 Copyright © 2026 Big Line Holiday Limited. All rights reserved

Nothing was worked around. No extra header, cookie, token, POST or retry was sent; the 401 answers were recorded and the investigation stopped. 5 of the 10 requests allowed were left unused.

**To revisit**, the owner would have to decide whether sending the site's `tenantCode` header and making the month-dates POST is acceptable (today's rules say no), or ask Big Line for access. The plan's note that the data is in embedded page state (`__NUXT__`) is no longer true: the embedded state now carries only SEO fields.

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

The field names in the first row are what the front-end code reads from the detail response. They were not observed, because the API returned no data. The same chunk also has a GET tour listing (`/bigline/global/product/tour/frontend/page`) that the tour page does not use. It was not called, and its contents are unknown.

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
