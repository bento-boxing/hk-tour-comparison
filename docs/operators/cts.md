OWNER DECISION PENDING

DATES NOT AVAILABLE WITHIN THE RULES (every tour fact, including the tour list, the title, the departure dates and the per-date prices, is loaded in the browser by `POST` requests to `https://private-api.ctshk.com/nbs/mob-server/open-api/…` whose body the site's script AES-encrypts and signs with SHA256withRSA over a client-made uuid and timestamp; the served HTML of every page is an empty shell)

# China Travel Service (Hong Kong) 香港中國旅行社 (`cts`): operator investigation

- Capture date: **2026-11-14** (Hong Kong). The requests were made 2026-11-13 23:11 – 2026-11-14 00:06 UTC, which was 07:11–08:06 on 14 November in Hong Kong.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, one at a time, 3 s per site), with undici's `EnvHttpProxyAgent` installed as `cli.ts` does. All were GETs with no extra headers, cookies or tokens. Page fetches used: **12 of 12**, plus robots.txt on three hosts (not counted). Two of the 12 were redirect hops the fetcher followed by itself (see "Every URL fetched").
- Raw responses and the ledger are in `.superpowers/raw-pages/cts/` (git-ignored). The probe script is outside the repository.
- No block page, captcha, JavaScript challenge, login wall, 403 or 429 was met. `www.ctshk.com` sets two Huawei Cloud WAF cookies (`HWWAFSESID`, `HWWAFSESTIME`) on every answer; they were not stored or sent back. `ww1.ctshk.com` and `private-api.ctshk.com` are behind a Kong gateway (`via: kong/3.1.1`, `server: elb`).
- **No request was sent to the API host `private-api.ctshk.com` other than its robots.txt.** No POST was sent.

## Who the operator is

- **China Travel Service (Hong Kong) Limited, 香港中國旅行社有限公司** (short name 香港中旅社). The site's own disclaimer starts: `香港中國旅行社網站 www.ctshk.com (下稱”本網站”)是香港中國旅行社有限公司(下稱”本公司”)專為旅遊人仕提供之網上旅遊資訊平台` ("the China Travel Service (Hong Kong) website www.ctshk.com is an online travel information platform provided by China Travel Service (Hong Kong) Limited"). The `/aboutUs` route's description in the site script: `香港中國旅行社成立於1928年，是香港規模最大的旅遊機構之一` ("founded in 1928, one of the largest travel organisations in Hong Kong"). Web search (company name only) agrees on the site and history.
- **Official site:** `https://www.ctshk.com/`, which is a 203-byte page that meta-refreshes after 1 s to **`https://ww1.ctshk.com/`**, the real site (a Nuxt 3 single-page app). Phones are sent by the script to `https://h5.ctshk.com` (a user-agent check in the global route middleware; not looked at, our User-Agent is not a phone).
- **Group tours** are under `/travelCircle` (SEO title `旅行團｜香港中國旅行社｜中國長短線,日韓台,東南亞,海外,深度遊`), with tour pages at `/product?productId=<id>`.
- **Licence number: not found.** None of the pages or scripts read shows one (no `牌照` text; the footer component was not among the files fetched). A web search turned up a 2020 Gazette notice that a licence `350273` held by this company (for the names 「中國旅行網」/「中旅網」) was revoked on 2019-12-23; that is not the current licence. **The current licence number is not verified.**
- The site's script also says, for hotel bookings, `預訂服務由中國旅遊集團旅行服務有限公司及其分公司提供` ("booking service provided by China Tourism Group Travel Service Co., Ltd. and its branches"). The API's test hosts are under `cits.com.cn` and the booking links point to `ourtour.com`. So the platform is shared with the mainland China Tourism Group; this does not change who the Hong Kong operator is.

## Recommendation

**HOLD.** Three reasons:

1. **Every tour fact comes from an encrypted, signed POST.** The served HTML of the home page and of the group tour page `/travelCircle` is the same empty shell: `window.__NUXT__` has no data, `<body>` has no text, there are no tour links, no product ids and no prices (the 387 KB are almost all inline CSS). The script fills the page in the browser. The tour list (`product/list/v2`), the tour detail (`product/detail`), the departure cities (`product/pro-dep-city`) and the price calendar (`product/price/calendar`) are all `POST` requests to `https://private-api.ctshk.com/nbs/mob-server/open-api/…`. For each one the request client (`baseOptions` in `/_nuxt/entry.4daefa33.js`) builds `{uuid, timestamp, versionNo, data, sign}`, where `uuid` is random, `timestamp` is the client clock and `sign` is a **SHA256withRSA signature** of `1101 + uuid + timestamp + "1.0"` made with an RSA private key written into the bundle. It then **AES-encrypts** that object (ECB, key derived from a constant in the bundle) and sends `{systemId: 1101, body: <ciphertext>}`. The answer's `body` is encrypted too and is decrypted in the browser with a second constant key. This is a request needing a client-generated signature, which is outside the rules. None was sent.
2. **There is no GET route to the data.** No sitemap exists (`www.ctshk.com/sitemap.xml` 404; `ww1.ctshk.com/sitemap.xml` redirects to the home page), robots.txt names none, and the served pages carry nothing. The only GET endpoints in the scripts read are `journey-file/<id>`, `dic/dictItems`, `districts/tcc` and `city/hotel/base-info`; none gives dates or prices, and three of the four still return an encrypted body. So **no reduced listing is possible** either: not even tour titles or URLs can be found with plain GETs.
3. **Not all terms were read.** Two documents were read and neither prohibits automated access, copying or reuse (see "Terms"). But the group tour booking terms and the `《用戶協議》` (user agreement) shown in the login dialog were not found in the scripts read, so they were **not read**.

robots.txt is not what stops us: none of the three hosts has one (all 404 or redirect), so every path is allowed.

**What would lift the HOLD.** Only asking CTS. A request for permission or a feed would need to cover:

- the tour list (ids of all group tours) and, for each tour each night, title, tour code, days and nights, day headings, departure/gathering point, "from" price, departure dates, per-date price and full/closed status; either as a feed, or by allowing `POST …/product/list/v2`, `…/product/detail` and `…/product/price/calendar`;
- what a bot should send instead of the browser-signed and encrypted body (the RSA signature, the AES encryption, `systemId`, uuid and timestamp), since signing with the key in their bundle would be acting as their own app;
- the rate (one request at a time, at least 3 s apart, User-Agent `tour-comparison-bot/0.1`);
- publishing those facts on a personal, non-commercial comparison site with a link back to the tour page, copying no descriptions or images;
- confirming the current website terms (user agreement and tour booking terms).

There is no owner decision that would make this PROCEED within the project's rules: replaying the site's own signing and encryption is not a "plain GET" and is not a static header like Big Line's `tenantCode`.

## Terms

| Document | URL | Read | Result |
|---|---|---|---|
| 免責聲明 (disclaimer) | page `https://ww1.ctshk.com/disclaimer`; its text is static in `https://ww1.ctshk.com/_nuxt/disclaimer.285a89e2.js` | 2026-11-14 HK (fetched 23:43:12 UTC on 13 Nov) | read in full (4 paragraphs). **No clause** on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or personal/non-commercial use. |
| 預訂景點門票/交通券/飲食餐券/Wifi及電話卡/旅遊必備品報名及責任細則 (網上/應用程式軟件版本) (booking terms for tickets, vouchers, Wi-Fi/SIM and travel goods, online/app version) | page `https://ww1.ctshk.com/contract`; text static in `https://ww1.ctshk.com/_nuxt/contract.50307433.js` | 2026-11-14 HK (fetched 23:46:22 UTC on 13 Nov) | read in full. Booking, payment, refund, liability, privacy, governing law. **No clause** on automated access, robots, crawling, scraping, intellectual property, linking or personal/non-commercial use of the site. Not the tour terms. |
| 旅行團報名及責任細則 (group tour booking terms) | **not found** | not read | The scripts read have no such title, link or PDF. Probably shown inside the booking flow or the tour page's `instructions` (which come from the encrypted `product/detail` POST). **Not verified.** |
| 《用戶協議》 (user agreement, linked in the login dialog) | **not found** | not read | The label is in the entry script's strings (`Login.main.996508-15`), but the link target is in a component not fetched. The sign-up form in the layout links only `私隱政策` (`/privacyPolicy`). **Not verified** whether a separate user agreement exists. |
| 私隱政策 (privacy policy) | `https://ww1.ctshk.com/privacyPolicy` (`/_nuxt/privacyPolicy.3db946b9.js`) | not fetched | A privacy policy; budget kept for the data question. |

Clauses that come near the topics, verbatim (Chinese as written, English gloss):

- Disclaimer, para. 1: `任何人仕如欲瀏覽本網站，即表示已閱讀、理解並接納聲明之內容及同意受其約束。` ("anyone who browses this website is taken to have read, understood and accepted this statement and agreed to be bound by it"). The statement itself only limits CTS's liability.
- Disclaimer, para. 2: `網上所載資料及價格僅供參考之用。` ("information and prices shown online are for reference only"). Our "check with the operator" wording would cover it.
- Disclaimer, para. 3: `…或任何由於使用或瀏覽本網站或向本網站或從本網頁上載、下載或載錄任何數據、文字、圖像或其他材料或資料而直接或間接產生的任何其他訴因，本公司概不負責。` ("… CTS is not liable for any cause of action arising directly or indirectly from using or browsing the site, or from uploading to, downloading or recording any data, text, images or other material from it"). A liability exclusion, not a prohibition.
- Ticket terms, opening: `於香港中旅社有限公司(“香港中旅社”) 預訂任何景點門票/交通券/飲食餐券/Wifi及電話卡/旅遊必備品、查詢或擷取任何資料，均受本景點門票/交通券/飲食餐券/Wifi及電話卡/旅遊必備品條款約束` ("booking any tickets/vouchers/… with CTS, or enquiring about or **retrieving any information**, is subject to these ticket terms"). It says retrieving information is covered by these terms, but nothing in these terms restricts it.
- Ticket terms, 責任及細則: `在香港中旅社所發佈的所有內容，包括但不限於景點/交通/餐飲/Wifi及電話卡/旅遊必備品介紹、產品地理位置等資料，均由相關產品提供者提供。` ("all content published by CTS, including descriptions and locations, is provided by the product suppliers") and `香港中旅社所提供的所有資訊僅供參考，香港中旅社有權隨時更改香港中旅社的任何內容，恕不另行通知。` ("all information is for reference only and may be changed at any time without notice").
- Ticket terms, 二、使用方法: `客人須同意不可複印或複製使用憑證。` ("customers agree not to photocopy or copy the vouchers"). About booking vouchers, not website content.

No `©`, `版權`, `Copyright`, `All rights reserved` or `知識產權` text appears in any page or script read (home shell, `/travelCircle` shell, entry script, layout, disclaimer, ticket terms, tour page chunk). The footer component was not fetched, so a rights notice there is **not ruled out**.

## robots.txt

**None of the three hosts has a robots.txt**, so there is no `User-agent: *` group, no group naming AI or other bots, no Crawl-delay and no Sitemap line. Every path is allowed (RFC 9309).

| Host | Read (UTC) | Answer | Meaning |
|---|---|---|---|
| `www.ctshk.com` | 2026-11-13 23:11:54 | HTTP 404, `text/html; charset=iso-8859-1`, Apache-style body `<title>404 Not Found</title> … The requested URL was not found on this server.`; `server: CW`; sets `HWWAFSESID`, `HWWAFSESTIME` | no robots.txt: all allowed |
| `ww1.ctshk.com` | 2026-11-13 23:19:32 | HTTP 302, `location: /`, body `<meta http-equiv="refresh" content="0; url=/">`. `createFetcher` followed the redirect, received the home page (HTML, 387,501 bytes, counted as page #3) and parsed it as robots.txt: no rules, so all allowed | no robots.txt of its own (unknown paths redirect to `/`) |
| `private-api.ctshk.com` (the data API) | 2026-11-14 00:00:21 | HTTP 404, `application/json`, body `{"message":"no Route matched with those values"}` (Kong) | no robots.txt: all allowed |

How the probe handled `ww1`'s redirect: the probe caches each robots.txt answer so it is not fetched again in later runs. It first cached the 302 without the page it led to, so the cache was corrected by hand to the 200 body the fetcher had actually parsed (logged in the ledger as a `(note)` line). Nothing extra was requested.

## Where each fact comes from

**No fact was observed.** No tour page could be opened (no productId was found: the list is only in the encrypted POST, there is no sitemap, and a web search for `ww1.ctshk.com/product?productId` found nothing). Everything below is read from the site's scripts; the field names have **not been seen in a response**.

| Fact | Where | Request | Field (from the script, not observed) |
|---|---|---|---|
| Tour id | URL `/product?productId=<id>`; list results | `POST …/product/list/v2` | `records[].productId` |
| Tour code | detail | `POST …/product/detail` | `productCode` (read once in the tour chunk) |
| Title | detail | `POST …/product/detail` | `productName` (the page title is built as `${productName}(${departureCityName}${t("startOff")})`) |
| Days / nights | detail | `POST …/product/detail` | `journeyDays`, `journeyNights` |
| Day-by-day headings | detail | `POST …/product/detail` | `journey.dayList` (item fields not read) |
| Start / gathering point | detail; departure-city list | `POST …/product/detail`; `POST …/product/pro-dep-city` | `departureCityName`, `departureCityList`, `cityMap` |
| "From" price | detail; list | `POST …/product/detail` | `lowestPrice` (also `finalPrice`, `originalPrice` on related products) |
| Departure dates | calendar | `POST …/product/price/calendar`, body data `{productId, resourceId, schemeId, cityId, startDepartureDate, endDepartureDate, channelCode}` | not read (the calendar component's chunk was not fetched) |
| Per-date prices | calendar | same | not read |
| Full / closed | calendar; detail | same; `status` on the detail (`PRODUCT_STATUS_CODE = {disabled: 0, active: 1, noDate: 2}`) | per-date status not read |

None of these is in the HTML as served. All are loaded by separate requests, which are POSTs, need the client-made signature and encryption described above, and are on a host with no robots.txt (so robots does not forbid them; the GET-only and no-signature rules do).

### The request client (from `/_nuxt/entry.4daefa33.js`)

- **Base URL:** `config.domainName + "/nbs/" + path`, with `domainName = "https://private-api.ctshk.com"` in the production branch and `mobServer = "mob-server/open-api/"`. Example: `https://private-api.ctshk.com/nbs/mob-server/open-api/product/detail`.
- **Function `baseOptions(method, path, data, {needEncrypt = true, toastOnError = true, needToken = true})`:**
  - if `needEncrypt` (the default; in the scripts read, only `city/hotel/base-info` and `category/product-class-list` turn it off): `d = {uuid: createUuid(), timestamp: Date.now(), versionNo: "1.0"}`, `sign = sha256WithRSA({systemId: 1101, ...d})` (signs the string `systemId + uuid + timestamp + versionId` with `SHA256withRSA` using a PKCS#8 private key stored in the bundle as `privateArray`), then the request body is `{systemId: 1101, body: encryptionAES({...d, data, sign})}` (AES-ECB, PKCS7, key from the bundle's `keyClient`);
  - headers: `Content-Type: application/json;charset=utf-8`, `requestId: <Date.now()>`, `loginToken: <cookie, or "">`;
  - for GET the URL is `path?<plain query>` and no body is sent, but the answer is still decrypted with `decryptAES(d.body)` (key `keyServer` from the bundle), then `eval`'d.
- The key values are not copied into this document.
- **All tour endpoints are POST:** `product/list/v2`, `product/detail`, `product/price/calendar` (twice, as `getCalendarPrice` and `productPriceCalendar`), `product/pro-dep-city`, `product/first-departure-date`, `product/product-session/query`, `product/resource-list`, `product/exists`, `product/city-agg`, `product/tag-agg`, `product/agg/destination`, `tour-info/list`, `hot-recommend-product/list`, `floor-info-list`, `banner/list`.
- **The tour page** (`/_nuxt/product.561c1e8c.js`) reads `productId` from the query string and calls `getProductDetail({productId})` from its `onMounted`-style hook (browser only). The server renders nothing for it: `setup` only awaits `getLocation`.

## Discovering tours and nightly cost

- **Discovery:** not possible within the rules. There is no sitemap on either web host, robots.txt names none, and the served `/travelCircle` page lists no tours. The only list is `POST …/product/list/v2` (paged with `current` and `size`, returns `{records, total}`).
- **Number of tours: not known.**
- **Requests per tour per night**, if CTS ever allowed the API: at least 1 detail POST + 1 calendar POST (the calendar takes a start and end date, so one call may cover the whole horizon; not verified), plus `ceil(total / size)` list POSTs a night. At 2 requests per tour and 3 s each, 1,000 tours would take about 1 h 40 min plus response time, inside the 170-minute job; 1,700 tours would reach it. These numbers are guesses for scale only.

## Every URL fetched (12 page fetches; robots.txt not counted)

All were GETs through `createFetcher`. "Bytes" is the size of the body as received. The ledger (`.superpowers/raw-pages/cts/ledger.tsv`) also lists each time a saved robots.txt was reused instead of fetched again.

| # | UTC | URL | Result |
|---|---|---|---|
| – | 2026-11-13 23:11:54 | https://www.ctshk.com/robots.txt | 404, 196 bytes (no robots.txt) |
| 1 | 23:13:53 | https://www.ctshk.com/sitemap.xml | 404, 196 bytes |
| 2 | 23:15:47 | https://www.ctshk.com/ | 200, 203 bytes (meta refresh to `https://ww1.ctshk.com/`) |
| – | 23:19:32 | https://ww1.ctshk.com/robots.txt | 302 → `/`, 87 bytes |
| 3 | 23:19:36 | https://ww1.ctshk.com/ (the fetcher following the robots.txt redirect) | 200, 387,501 bytes (Nuxt shell: empty `__NUXT__`, no body text) |
| 4 | 23:30:29 | https://ww1.ctshk.com/_nuxt/entry.4daefa33.js | 200, 969,922 bytes (routes, API config, request client, signing and encryption) |
| 5 | 23:43:12 | https://ww1.ctshk.com/_nuxt/disclaimer.285a89e2.js | 200, 2,835 bytes (disclaimer text) |
| 6 | 23:46:22 | https://ww1.ctshk.com/_nuxt/contract.50307433.js | 200, 24,289 bytes (ticket and add-on booking terms) |
| 7 | 23:51:08 | https://ww1.ctshk.com/_nuxt/default.021a1be5.js | 200, 30,037 bytes (layout: header, login and sign-up; no footer) |
| 8 | 23:53:50 | https://ww1.ctshk.com/_nuxt/product.561c1e8c.js | 200, 17,293 bytes (tour page: calls `getProductDetail` in the browser) |
| 9 | 23:57:41 | https://ww1.ctshk.com/_nuxt/index.591c1039.js | 200, 3,606 bytes (list API functions: `product/list/v2` and others, all POST) |
| – | 2026-11-14 00:00:21 | https://private-api.ctshk.com/robots.txt | 404, 48 bytes (Kong: `no Route matched`) |
| 10 | 00:02:42 | https://ww1.ctshk.com/travelCircle | 200, 387,513 bytes (group tour page: same empty shell, no tours) |
| 11 | 00:06:07 | https://ww1.ctshk.com/sitemap.xml | 302 → `/`, 87 bytes |
| 12 | 00:06:11 | https://ww1.ctshk.com/ (the fetcher following #11's redirect) | 200, 387,501 bytes (home shell again) |

**Order of fetches.** The brief's order was sitemaps, terms, listing, tour pages, scripts. Sitemap #1 came first. The home page (#2, #3) was needed to find the real host and the terms, since the root is a redirect and has no links. The entry script (#4) was needed before any terms page could be found, because the site is a single-page app with no links in its HTML. No tour detail page was fetched: no productId could be found without the POST, and the tour page chunk (#8) shows that the HTML would be the same empty shell. #11 tried for a sitemap on the real host; its redirect hop (#12) used the last fetch.

**Not fetched:** the privacy policy; the user agreement and tour booking terms (not located); the footer component; the calendar component's chunk; `/searchPage` and its chunk; any tour page `/product?productId=…`; `h5.ctshk.com`; any request to `private-api.ctshk.com` other than robots.txt. No POST was sent.

## Not verified

- The current licence number.
- The group tour booking terms and the user agreement (not found, not read), the privacy policy (not read), and whether the footer carries a rights notice.
- Every response field name above (read from the scripts only); what the calendar returns, and whether one calendar call covers all dates.
- Whether the API answers unsigned or unencrypted requests (not tried, and not allowed).
- The number of tours.
- Whether the mobile site `h5.ctshk.com` serves anything different (not looked at).
