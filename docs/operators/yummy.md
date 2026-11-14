OWNER DECISION PENDING

# Yummy Holiday 美味假期 (`yummy`): operator investigation

- Capture date: **2026-11-14** (Hong Kong). The requests were made 2026-11-13 23:08–23:59 UTC, which was 07:08–07:59 on 14 November in Hong Kong. Two more (the remaining terms images, allowed afterwards) were made 2026-11-14 00:16 UTC (08:16 in Hong Kong).
- All requests to the operator's hosts went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, one at a time, 3 s per site), with undici's `EnvHttpProxyAgent` installed as `cli.ts` does. All were GETs with no extra headers, cookies or tokens. Page fetches used: **12 of 12** in the investigation, then **2 of 2** more for the terms images (14 in all), plus robots.txt on three hosts (not counted). Every request is listed under "Every URL fetched".
- Raw responses and the ledger are in `.superpowers/raw-pages/yummy/` (git-ignored). The probe scripts are outside the repository.
- No block page, captcha, JavaScript challenge, login wall, 403 or 429 was met. All three hosts are plain `nginx` or Aliyun OSS, with no CDN or bot protection seen.

## Who the operator is

- **YUMMY HOLIDAY LIMITED 美味假期有限公司**, trade names `YUMMY HOLIDAY` and `美味假期`, **Travel Agent's Licence no. 353650**. Source: the Travel Industry Council's member directory, https://www.tichk.org/en/travel-agent-information/22663, read 2026-11-14 (a third-party site, not the operator's). The directory gives the website as `http://www.yummyholiday.net`, the head office in Tai Po, and the business as outbound package tours (retail and wholesale), air-plus-hotel, hotel, cruise and local tours.
- "Yummy Holiday" was the owner's spelling and is the company's own English name. There is no doubt about which company this is.
- **Official site: `https://www.yummyholiday.net/`** (title `美味假期`). It is a uni-app (Vue) single-page app with hash routes (`/#/pages/...`). Its data comes from **`https://api.yummyholiday.net/`** (JSON) and its images and PDFs from **`https://img.yummyholiday.net/`** (Aliyun OSS).
- The site's footer (from the footer script) reads `深圳美味假期旅行社有限公司 Yummy holiday LTD. All Rights Reserved.` and `粤ICP备20058198号` (a mainland website filing). So the site is registered to a Shenzhen sister company, while the terms name the Hong Kong company (`美味假期有限公司`) as the payee. Who runs the site is not otherwise stated.
- Web search also turned up an older PHP site at `hk.yummyholiday.cn` (`login.hk.php`, `signature.hk.php`). Nothing on it was fetched. Whether it is still live is **not known**; it is not needed.
- The tours are mostly short Guangdong coach tours and mainland China, Japan, Korea, Taiwan and Southeast Asia tours (see "Tours").

## Recommendation

**PROCEED WITH OWNER DECISION.** Every fact the site shows as text is reachable by plain GETs of allowed URLs, and nothing read restricts automated access or reuse:

1. **robots.txt allows everything.** `www.yummyholiday.net` and `img.yummyholiday.net` have none (404). `api.yummyholiday.net` has `User-agent: *` with an empty `Disallow:`.
2. **The data is a public JSON API used by GET, with no headers, tokens or signature.** The site's request client (axios, base URL `https://api.yummyholiday.net`) has empty request interceptors. Every tour call is `GET` with query parameters. One listing call returns all 327 tours with every departure date and its status. One call per tour returns each departure's price. This is the same kind of source as EGL's `/api/v1/tours/<code>/dates`.
3. **The terms document has no clause on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use.** It is published as three images, and **all three were read in full** by eye. They are customer booking terms: a membership notice, the travel terms and liability sheet, and a fee, deposit and balance table. See "Terms".

The decisions the owner needs to make:

- **A. The terms: read in full, nothing prohibits.** The 2 extra fetches were allowed and made (the other two images on the `旅遊細則` page). None of the three images has a clause on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use, and no part of any image was illegible. This is a PROCEED result: the owner only has to accept it. The site has no other terms, website terms of use, copyright or privacy page in its menu, so the footer's `All Rights Reserved.` line is the only rights statement (we would copy facts, not text or images).
- **B. Accept a reduced set of fields (needed).** **Day-by-day headings and the gathering point are not in the API as text.** The itinerary is a set of images (`descp_images`, `promot_pages`) and a PDF per departure (`promot_files`, the `行程單`, "itinerary sheet"). A Yummy Holiday listing would show: tour code, title, days, cities (`dist_list`), the transport mode (`巴士` coach, `飛機` air, `西九`/`高鐵` high-speed rail, `船` ship), "from" price, departure dates, per-date prices and full markers. It would not show day headings or the gathering place. Reading the PDFs would be a separate decision: they were not fetched, so whether they have a text layer is **not known**, and they would add requests.
- **C. Stay on the three tour endpoints.** The same API also has staff endpoints the site's code calls for tour guides (`/bussiness/group/getGroupReport`, `getGroupWorkOrder`, `/tour/expenses/...`, and POSTs such as `saveGroupReport`). None was requested. A scraper must call only `line/index`, `group/list` and (optionally) `line/detail`. It must keep only public facts and drop the booking counts the dates call returns (`cur_enroll_headcount`, `start_headcount`, `early_prefer_used_headcount`).

## Terms

| Document | URL | Read | Result |
|---|---|---|---|
| `旅遊細則` (the site's only terms page; menu item id 7) | `https://www.yummyholiday.net/#/pages/content/content?id=7&pageId=7`, whose content comes from `GET https://api.yummyholiday.net/website/page/detail?id=7` | 2026-11-14 (fetched 23:49 UTC on 13 Nov) | HTTP 200 JSON. `data.content` is three `<img>` tags and nothing else: `uploads/20250203/65be3698….jpg`, `uploads/20261103/1b3a46ee….jpg` (title `旅遊細則 美味 2026.11.3.jpg`) and `uploads/20260603/4bf4ce7b….jpg`. |
| Image 2 of 3: `旅遊細則及責任問題` (travel terms and liability), version `版本20261104(I)` | https://img.yummyholiday.net/uploads/20261103/1b3a46ee1eca9e138e74f9215193d8bf.jpg | 2026-11-14, **read in full** (2481 × 20951 px, read in 14 strips) | Sections: `報名手續` (booking), `臨時取消及退款細則` (cancellation and refunds), `團隊8號風球及天雨安排` (typhoon and rain), `責任問題` (liability, 38 items), `保險須知` (insurance). Customer booking terms only. |
| Image 1 of 3: membership notice | https://img.yummyholiday.net/uploads/20250203/65be3698b7db9fb466076d5436fe652b.jpg | 2026-11-14 (fetched 00:16 UTC), **read in full** (2481 × 264 px, one line of text) | The whole image, verbatim: `團費均為會員價，報團須先入會，會員費$10，有效期一年，不設退費!` ("all tour fees are member prices; you must join as a member before booking; the membership fee is $10, valid for one year, not refundable!"). Booking terms only. |
| Image 3 of 3: `手續費，訂金，餘款` (fees, deposit, balance), `更新日期: 2026年3月31日` (updated 31 March 2026) | https://img.yummyholiday.net/uploads/20260603/4bf4ce7b8fffebab8b71c08496e9a224.jpg | 2026-11-14 (fetched 00:16 UTC), **read in full** (2433 × 1500 px, read whole and in six crops) | Deposit (`訂金`, peak-season `旺季訂金`) and balance (`餘款`) rules; a table of name-change (`轉名`), withdrawal (`退出`) and tour-change (`轉團`) charges by days before departure, for coach (`巴士線`, in and out of province), high-speed rail (`高鐵線`) and air (`飛機線`) tours, weekday (`平日`) and peak season (`旺季`); two notes (`註明`). Customer booking terms only. |
| Website terms of use, privacy policy, copyright notice | – | – | **No such page found.** The menu (`GET /website/menu/list`) has 11 items: `榮譽獎項`, `公司簡介`, `招聘`, `聯系我們`, `開心時刻`, `現場實拍`, `我們的動態`, `波士開咪`, `好片分享`, `限時特惠`, `旅遊細則`. The footer has only the rights line and the ICP number. |

Clauses on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use (personal / non-commercial) in the whole three-image terms document: **none**. All three images were read in full by eye, not searched as text. **No part of any image is illegible**; image 3's small print (the `出發前1天 (14:00前)` / `(14:00後)` rows) was checked in full-resolution crops. The nearest clauses (short quotations):

- Image 1: `團費均為會員價` ("all tour fees are member prices"). It is about who the prices apply to (members; membership is $10 a year). It does not restrict using the content. Our "check with the operator" wording covers it.
- Image 3, the line above the table: `** 所有飛機/高鐵線, 有關(轉名/退出/轉團)需收取之手續費, 最終均以航空公司/鐵路局回覆確認為準, 以下價目表只供參考` ("for all air and high-speed-rail tours, the fees for name changes, withdrawals and tour changes are finally as confirmed by the airline or railway; the table below is for reference only"). It is about fees, not about using the content.
- Quotations from images keep the punctuation as it looks; whether a comma is full-width or half-width cannot be told for certain from a picture.
- `報名手續` 7): `行程及價格以報名時作準` ("itinerary and price are as at the time of booking"). It is about prices, not about using the content. Our "check with the operator" wording covers it.
- `責任問題` 8): `本公司所持有有關顧客資料會嚴格保密。只會用於該名顧客在一般情況下旅遊有關服務時使用。` ("customer data held by the company is kept strictly confidential and used only for that customer's travel services"). It is about customer data. We collect none.
- `責任問題` 17): `有可能實況與行程單張上所登出圖片或介紹有所不同` ("conditions may differ from the pictures or descriptions in the itinerary sheet"). It is about the trip, not about the website.
- Footer: `深圳美味假期旅行社有限公司 Yummy holiday LTD. All Rights Reserved.` A rights notice, not a clause. We would copy facts (dates, prices, days, cities), not text or images.

## robots.txt

| Host | Read (UTC, 13 Nov) | Result |
|---|---|---|
| `www.yummyholiday.net` (the site) | 23:08:25 | **HTTP 404** (nginx's default 404 page). No robots.txt: every path allowed (RFC 9309). |
| `api.yummyholiday.net` (the data) | 23:47:13 | HTTP 200, `text/plain`, `last-modified: Tue, 14 Jan 2025 08:28:57 GMT`. The whole file, verbatim (24 bytes): |
| `img.yummyholiday.net` (images, PDFs) | 23:58:46 | **HTTP 404** (Aliyun OSS `NoSuchKey`). No robots.txt: every path allowed. |

```
User-agent: *
Disallow:
```

No group names AI or other bots. There is no Crawl-delay on any host, and no `Sitemap:` line.

## Tours

- **No sitemap.** `https://www.yummyholiday.net/sitemap.xml` is a 404, and no robots.txt names one. The site is client-rendered, so its pages carry no tour links in their HTML.
- **Discovery is one API call:** `GET https://api.yummyholiday.net/bussiness/line/index?limit=500` returned `data.total: 327`, `data.page: 1`, `data.last_page: 1` and **327 tours** in `data.rows` (2,884,182 bytes). Ids and codes are all distinct. `limit=500` is our choice; the site's own detail page calls this endpoint with `{"queryParam[is_hot]":1, limit:20}`. Whether the server caps `limit` is not known: it returned everything here.
- Every tour had at least one departure. There are **5,131 departures** in all (mean 15.7 per tour, at most 150), from 2026-11-14 to 2027-04-28.
- Days: 2 (49), 3 (125), 4 (25), 5 (62), 6 (42), 7 (2), 8 (20), 9 (2).
- Code prefix and `vehicle_name`: `BG` coach 148, `BL` coach 7, `AL` air 50, `AA` air 30, `KL` `西九` 41, `KG` `西九` 23, `CL` high-speed rail 25, `SG` ship 3. Japan, Korea and Taiwan tours seen are `AA`; mainland air tours are `AL`.
- Tour page link (for "view on the operator's site"): `https://www.yummyholiday.net/#/pages/detail/detail?id=<id>`. The detail page reads `id` (or `code`) from its route options, and the terms image itself links in the same `/#/pages/...?id=` form. That exact URL was **not opened** to check.

## Where each fact comes from

Three endpoints, all `GET` on `https://api.yummyholiday.net`, JSON `{"code":1,"msg":"返回成功","time":…,"data":…}` (`code: 1` means success). None needs a header, cookie or token. They come from `/assets/index-Wmh7KIjR.js` (the API functions) and `/assets/pages-detail-detail.Cs1xRcYE.js` (the tour page). Both file names are hashed builds and will change.

- **Listing:** `/bussiness/line/index?limit=<n>` → `data.rows[]`
- **Dates and prices for one tour:** `/bussiness/group/list?line_id=<id>` → `data.list[]` and `data.month_list[]` (`{year, month}`). The tour page calls it with `{line_id}` after the detail.
- **Detail:** `/bussiness/line/detail?id=<id>` → `data` (or `/bussiness/line/detailByCode?code=<code>`)

Observed on tour **5906** (`AA-J-TD05`, `【關東巡遊】東京・富士・鎌倉古都(紅葉)溫泉五天團`, Tokyo, 5 days, air), plus the listing for all 327.

| Fact | Where | Path | Example |
|---|---|---|---|
| Tour id | listing, detail | `rows[].id`; `data.id`; dates `list[].line_id` | `5906` |
| Tour code | listing, detail | `rows[].code`; `data.code`. Each departure has its own code, `<code>-YYMMDD` plus an optional `B` for a second group on the same day (`list[].code`) | `AA-J-TD05`; `AA-J-TD05-261119B` |
| Title | listing, detail | `rows[].name`. The tour page shows `website_name` instead when `is_website_name` is 1 and it is non-empty (5 of 327 tours) | as above |
| Days | listing, detail | `rows[].daycount` (number). For every departure, `return_date − start_date + 1` equals `daycount` (all 5,131 checked) | `5` |
| Nights | **not given** | No nights field. | – |
| Day-by-day headings | **not in any text field** | The tour page shows images (`data.descp_images`, `list[].promot_pages`) and a PDF (`list[].promot_files`, the `查看行程單` "view itinerary sheet" button). `data.descp`/`sell_point` is marketing prose (1 of 327 has day markers in it). `data.tips` is travel tips. | – |
| Cities | detail only | `data.dist_list` (comma list, country first). Not in the listing. | `日本,東京,富士` |
| Start / gathering point | **not in any text field** | Only the transport mode: `rows[].vehicle_name` (`巴士`, `飛機`, `西九`, `高鐵`, `船`); the detail has a numeric `vehicle_type` (`5` for 5906). The gathering place is probably in the itinerary PDF (**not verified**). The terms mention `西九` and Shenzhen/Guangzhou stations for rail tours. | `飛機` |
| "From" price | listing, detail | `rows[].price` (integer HKD; also `adult_price`, `child_price`, `baby_price`). The tour page shows `price` with `元起` ("from"). `price` equals `adult_price` on 263 of 327 tours; on the other 64 it is higher or lower. | `5399` |
| Departure dates | listing (all tours, one call) and the dates call | `rows[].group_list[].start_date` / `return_date` (ISO `YYYY-MM-DD`); also `rows[].formed_group_date[]`, `almost_formed_group_date[]`, `unformed_group_date[]`, `full_group_date[]`, `earliest_date`, `latest_date`. Dates call: `list[].start_date`. Several groups can share a date (842 extra groups). | `2026-11-19` |
| Per-date price | **dates call only** (the listing's `group_list` has no price) | `list[].price` (= `adult_price`; also `child_price`, `baby_price`). `is_prefer`, `prefer_adult`, `prefer_child` and `early_prefer_amount` hold early-booking discounts. | 5906: `5599` (Nov, Mar), `5699` (Dec–Feb), `8499` (24 Dec) |
| Full / closed | listing and the dates call | `group_enroll_status`, labelled in the page's script: `0` `收客中` (taking bookings), `1` `快成團` (nearly confirmed), `2` `已成團` (confirmed), **`3` `已满客` (full)**, **`4` `已取消` (cancelled)**. The tour page drops `4` and refuses to book `3` (`團已滿請選擇其他`, "the tour is full, please choose another"). The listing had no `4` (it seems to leave cancelled groups out: 27 groups for 5906 in the listing, 31 in the dates call, 4 of them `4`). `team_status` matches it (`''`=0, `P`=1, `G`=2, `F`/`N`=3, `Z`=4). `enroll_end_time_text` was empty everywhere: no closing date was seen. | 5906: 19 Nov full; 4 Feb cancelled |

**The "from" price and per-date prices do not agree on 5906.** The tour's `price` is `5399`, below every departure price (lowest `5599`). Several departures have `is_prefer: 1, prefer_adult: 200`, and 5599 − 200 = 5399, so the "from" price looks like the early-booking price. **Not verified.** The parser should take the listing's `price` as the "from" price and the dates call's `price` as the per-date price, as the site does. It should not compute one from the other.

**Several groups on one date.** The page's calendar keeps, for each date, the group with the best status (priority `2` > `1` > `0` > `3`) and its price. For us, a date is full only when every group on it is `3`, and cancelled groups (`4`) are dropped.

**Fields not to take.** The dates call also returns booking counts (`cur_enroll_headcount`, `start_headcount`, `early_prefer_used_headcount`). No personal names, phone numbers or staff notes were seen in the three tour responses. Image and PDF paths, `sell_point`, `descp` and `tips` are operator text and should not be copied.

## Number and date formats

- Prices: JSON integers in HKD (`5399`, `8499`). `early_prefer_amount` is a string (`"200.00"`). No currency field; the terms quote `港幣` (HKD).
- Dates: ISO `YYYY-MM-DD` everywhere; `create_time` is `YYYY-MM-DD hh:mm:ss`. `expire_date` is `0000-00-00` on 298 tours, `null` on 14, and a date on 15; what it means is **not known**.
- Days: integer `daycount`.

## Discovering tours and nightly cost

| Route | Requests per night | At 3 s each (plus response time) | Within the rules? | Fits the 170-minute job? |
|---|---|---|---|---|
| Listing only: code, title, days, "from" price, every date with its status; **no per-date price, no cities** | 1 (about 2.9 MB) | seconds | yes | yes |
| Listing + dates call per tour (adds per-date prices) | 1 + 327 = 328 | about 16 min | yes | yes |
| Listing + dates + detail per tour (adds `dist_list` cities) | 1 + 654 = 655 | about 33 min | yes | yes |
| As above, but detail only for tours not seen before (cities rarely change) | about 330 after the first night | about 17 min | yes | yes |

The dates call's size grows with the departures (28.5 kB for 31 groups). The listing response is large (2.9 MB) but it is one request.

## Fixtures

**None saved.** The raw responses stay under `.superpowers/raw-pages/yummy/` only. If the owner approves, good fixture candidates are 5906 (air, full, cancelled and discounted dates, several groups per date) and a 2-day `BG` coach tour and a `西九` rail tour from the listing. A fixture should keep only the fields under "Where each fact comes from".

## Every URL fetched (12 + 2 page fetches; robots.txt not counted)

All were GETs through `createFetcher`. "Bytes" is the size of the decoded body. The ledger (`.superpowers/raw-pages/yummy/ledger.tsv`) also lists each time a saved robots.txt was reused instead of fetched again.

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | 23:08:25 | https://www.yummyholiday.net/robots.txt | 404, 148 bytes (no robots.txt) |
| 1 | 23:10:33 | https://www.yummyholiday.net/sitemap.xml | 404, 148 bytes (no sitemap) |
| 2 | 23:12:41 | https://www.yummyholiday.net/ | 200, 1,450 bytes (empty app shell: `<div id="app"><!--app-html--></div>`) |
| 3 | 23:16:28 | https://www.yummyholiday.net/assets/index-Wmh7KIjR.js | 200, 395,071 bytes (API base URL, request client, all API paths, routes, menu loader) |
| 4 | 23:26:02 | https://www.yummyholiday.net/assets/pages-detail-detail.Cs1xRcYE.js | 200, 70,590 bytes (tour page: which calls, status labels) |
| 5 | 23:39:06 | https://www.yummyholiday.net/assets/pages-common-footer.BjcQXW5t.js | 200, 873 bytes (footer: rights line and ICP number only; no terms link) |
| 6 | 23:43:53 | https://www.yummyholiday.net/assets/pages-common-navBar.Dq1DVW4c.js | 200, 17,601 bytes (menu: content pages are `/pages/content/content?id=&pageId=`) |
| – | 23:47:13 | https://api.yummyholiday.net/robots.txt | 200, 24 bytes (`User-agent: *` / `Disallow:`) |
| 7 | 23:47:17 | https://api.yummyholiday.net/website/menu/list | 200 JSON, 1,878 bytes (11 menu items; `旅遊細則` is content page 7) |
| 8 | 23:49:20 | https://api.yummyholiday.net/website/page/detail?id=7 | 200 JSON, 570 bytes (terms page: three images) |
| 9 | 23:52:02 | https://api.yummyholiday.net/bussiness/line/index?limit=500 | 200 JSON, 2,884,182 bytes (all 327 tours, 5,131 departures) |
| 10 | 23:56:06 | https://api.yummyholiday.net/bussiness/group/list?line_id=5906 | 200 JSON, 28,551 bytes (31 departures with prices and status) |
| 11 | 23:57:27 | https://api.yummyholiday.net/bussiness/line/detail?id=5906 | 200 JSON, 4,550 bytes (detail: `dist_list`, no day text) |
| – | 23:58:46 | https://img.yummyholiday.net/robots.txt | 404 (OSS `NoSuchKey`; no robots.txt) |
| 12 | 23:58:51 | https://img.yummyholiday.net/uploads/20261103/1b3a46ee1eca9e138e74f9215193d8bf.jpg | 200, 4,654,381 bytes (terms image `旅遊細則及責任問題`, version 20261104(I)) |
| – | 00:16:27 (14 Nov) | https://img.yummyholiday.net/robots.txt | not requested: the 404 saved at 23:58:46 was reused (logged in the ledger as `(cache)`) |
| 13 | 00:16:30 (14 Nov) | https://img.yummyholiday.net/uploads/20250203/65be3698b7db9fb466076d5436fe652b.jpg | 200 `image/jpeg`, 133,055 bytes (terms image 1: membership notice) |
| 14 | 00:16:35 (14 Nov) | https://img.yummyholiday.net/uploads/20260603/4bf4ce7b8fffebab8b71c08496e9a224.jpg | 200 `image/jpeg`, 3,083,002 bytes (terms image 3: `手續費，訂金，餘款`) |

#13 and #14 were the 2 extra fetches allowed after the investigation, made by a second probe script (`fetchBytes`, default options) that would send only those two URLs and would stop at the first refusal, block or non-200. Neither was refused.

**Order of fetches.** The brief's order was sitemaps, terms, listing, tour pages, scripts. The site has no sitemap and renders nothing on the server, so scripts #3–#6 had to come first, to find the API, the terms page and the tour calls. The terms (#7–#8) came before the listing (#9). Only one tour (two calls, #10–#11) could be read, and #12 went on the newest terms image rather than a second tour.

**Not fetched:** any itinerary image or PDF; a second or third tour (a coach or rail tour); the `pages-content-content` and `pages-filter-filter` scripts; `hk.yummyholiday.cn`; any staff endpoint; any POST.

## Not verified

- Whether the itinerary PDFs (`promot_files`) have a text layer with day headings and the gathering point.
- That the dates call answers the same for coach and rail tours. Only one air tour was read; the listing's fields look the same across all kinds.
- Why `price` differs from `adult_price` on 64 tours, and whether the "from" price is always the early-booking price.
- Whether the dates call includes past departures (5906's first was 5 days ahead), and what `enroll_status`, `is_website_show` (0 on every departure) and `expire_date` mean.
- Whether the server caps `limit` on the listing.
- The tour page link form `/#/pages/detail/detail?id=<id>` (inferred from the code and the terms page's own link, not opened).
- Whether `hk.yummyholiday.cn` is a live second site.
