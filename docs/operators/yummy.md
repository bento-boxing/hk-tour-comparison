APPROVED 2026-11-14: owner approved the reduced fields (no day headings, no gathering point; the route taken from the operator's own city list, `dist_list`)

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
| Cities | detail only | `data.dist_list` (comma list). Not in the listing. In the investigation only 5906 was read, and its list starts with the country; the fixture capture (see "Scraper and fixtures") found a list with no country (`清遠`) and one starting with a province (`雲南,大理,…`). | `日本,東京,富士` |
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

None were saved in the investigation. The scraper's fixtures are under "Scraper and fixtures" below.

## Owner decision (2026-11-14)

Approved with the reduced fields: no day headings and no gathering point, the route taken from the operator's own city list (`dist_list`). Everything else as recommended above: the three tour endpoints only, plain GETs, no extra headers, the booking counts never kept.

Later the same day (Task 30 review): a province on the list is dropped when one of its cities is listed too, wherever either sits (the list is a set of tags, not an order), so `雲南,大理,瀘沽湖,麗江,昆明` is the four cities. A province with no city of its own on the list stays a stop.

## Scraper and fixtures (2026-11-14)

The scraper is `packages/scraper/src/operators/yummy/`. Its first-run floor is **104**, a third of the 312 tours the practice crawl would have saved, and it is in the nightly matrix (see "Practice crawl" below). Until that crawl it had a provisional floor of 196 (60% of the 327 tours listed on 2026-11-14) and was kept out of the nightly job.

**Requests.** Only three paths on `https://api.yummyholiday.net`, all plain GETs through the run's polite fetcher with no extra headers of any kind: `/bussiness/line/index?limit=500` once a night, then per tour `/bussiness/line/detail?id=<id>` and `/bussiness/group/list?line_id=<id>`. Two requests per tour every night (about 655 a night, some 33 minutes at 3 s each); nothing is cached across nights. Never a staff endpoint, a POST, an image or a PDF. Refusals are counted separately for the details and for the dates, each in a row and started again only by a success of its own kind, so details that answer cannot hide refused dates. A refusal is any answer that is not a success: none (an HTTP 403, 429, a 5xx or no answer at all), not JSON (a block page) or a code other than 1. When either count reaches 3, nothing more is requested that night, neither details nor dates. (Fix round 1: the first version had one count for both, which each tour's answering detail reset, so refused dates would never have stopped the run.)

**Discovery** reads the listing once. It throws (the run fails as `discover-error` and last night's tours stay) unless the answer has code 1 and a list of rows, `last_page` is 1, the number of rows equals `total`, and every row has a whole-number tour id. Each row gives the tour's page, `https://www.yummyholiday.net/#/pages/detail/detail?id=<id>`: the "view on the operator's site" link and the tour's identity in a run.

**The allow-list** (`public.ts`) keeps only: from the detail, `id`, `code`, `name`, `is_website_name`, `website_name`, `daycount`, `price` and `dist_list`; from each group of the dates answer, `id`, `start_date`, `return_date`, `group_enroll_status` and `price`; from the listing, its `total` and `last_page` (the two counts discovery checks) and each row's tour fields (not its `group_list`). Each answer's `code` is kept too. Booking counts, prose, tips and image and PDF paths are never kept.

What the parser reads, and its rules:

- **Code, days**: `code`, `daycount` (a whole number of at least 1).
- **Title**: `website_name` when `is_website_name` is the number 1 and `website_name` has text, else `name` (as the tour page does; the API sends the flag as a number, and the text `"1"` is not accepted).
- **Route**: `dist_list` split at ASCII and full-width commas, each name trimmed, empty ones dropped, in the operator's order, one name per entry of `dayHeadings`. They go through the shared place matching like any heading: a country name gives no stop. The tour sets `dropRegionWithListedCity` (a ScrapedTour opt-in that normaliseTour honours; no other operator sets it): a region-only stop (a province) is dropped when a city of that region is also a stop, before or after it, and a repeat that leaves side by side is removed. A tour none of whose names is recognised fails as `no-stops`; there is no title fallback.
- **"From" price**: the detail's `price`, as given (normaliseTour still shows the lowest departure price when there is one, as for every operator).
- **Departures**: from the dates call. Groups with `group_enroll_status` 4 (cancelled) are dropped. The groups of one date become one departure, at the price of the group the site would show: the best status (2 > 1 > 0 > 3), then the lowest price. A date is full, and left out, only when every group left on it is 3. A group status other than 0 to 4 makes the tour a parse failure. A group without a real date is skipped. Past dates are kept for normaliseTour to drop.
- **Start and end**: none (`null`, read as Hong Kong, as for any operator that states none). `vehicle_name` is not read.
- **Nights**: none.

**What the fixture capture verified or contradicted** (4 requests, 2026-11-14 13:14:59–13:15:10 UTC, ledger lines 15–18 of `.superpowers/raw-pages/yummy/ledger.tsv`; the listing and tour 5906 were reused from the investigation, not fetched again):

- **The coach and rail tours answer the dates call the same way as the air tour**: the same `{"code":1,…,"data":{"list":[…],"month_list":[…]}}` and the same group fields. (The coach tour's groups lack `is_discount`, which is not read.)
- **Past departures**: the earliest group answered was on the capture day itself (5662's 14 November, cancelled); no earlier date was answered for any of the three tours. The listing (07:52 Hong Kong the same day) had already left out every cancelled group of both tours, as it did for 5906.
- **`dist_list` is not always "country first"**: 5906 `日本,東京,富士` (country first), 5662 `清遠` (no country), 6033 `雲南,大理,瀘沽湖,麗江,昆明` (a province first). The shared matching reads `雲南` as a region; by the owner's decision (see above) it is dropped because cities of Yunnan are listed, so 6033's route is its four cities.
- **A second group's code** ends in `U` on 5662 (`BG-R-ET02-261114U`), not only `B`. Group codes are not read.
- **The "from" price** is below every departure on 6033 (4999 against 6699), which fits the early-booking reading (`prefer_adult` 1700), but above `adult_price` on 5662 (699 against 599, no discount): the early-booking reading does not explain every tour.
- **Is `dist_list` in visiting order?** The three tours cannot settle it:

| Tour | Places the title names | `dist_list` |
|---|---|---|
| 5906 `AA-J-TD05` (air) | 東京, 富士, 鎌倉 | 日本, 東京, 富士 |
| 5662 `BG-R-ET02` (coach) | 佛岡 | 清遠 |
| 6033 `KL-Y-BL08` (rail) | 麗江, 大理, 昆明, 瀘沽湖 (and 香港西九龍直達昆明: by train straight to Kunming) | 雲南, 大理, 瀘沽湖, 麗江, 昆明 |

  5906's list leaves out 鎌倉 and 5662's names the prefecture (清遠) for the title's county (佛岡), so the list is not always a full route. 6033's list has the title's four cities in another order, which fits a loop out of Kunming (arrive by train, then Dali, Lugu Lake, Lijiang, back to Kunming) but cannot be checked: the itinerary is only in images and a PDF. The scraper keeps the list's order and makes no claim about it.

Fixtures (`packages/scraper/src/operators/yummy/fixtures/`), each with `<name>.expected.json` (`verifiedByOwner: false`, notes on every judgment call):

| Fixture | Tour | Why |
|---|---|---|
| `simple` | 5662 `BG-R-ET02`, 佛岡 2-day coach (`巴士`) | One city, two groups on every date, 10 cancelled groups, dates with a nearly-confirmed and a full group |
| `multi-city` | 6033 `KL-Y-BL08`, Yunnan 8-day rail (`西九`) | Four cities after a province, cancelled dates, a full and a confirmed group on one date, "from" price below every departure |
| `edge` | 5906 `AA-J-TD05`, Kanto 5-day air (`飛機`) | A date with every group full, dates with a full and a confirmed group, two all-cancelled dates, a city not in the places list (`富士`) |
| `listing` | the listing, cut to 5 rows | Discovery: 6212 (the first row), 6033, 6021 (`is_website_name` 1), 5906, 5662; `total` set to 5 to match |

They are the raw answers saved under `.superpowers/raw-pages/yummy/` (outside git) put through `public.ts` and, for the tours, joined as fetchPage joins them (`{"detail": …, "dates": …}`); nothing else was changed, except the listing's rows and `total` as stated. Unmatched city names in the three tours: `富士` (5906) only; 佛岡 is in no list, only the title. No place was added.

## Practice crawl (2026-11-14)

`pnpm scrape --operator yummy --dry-run` from 14:12 to 14:48 UTC: **36 minutes** for the listing and 329 tour pages (two requests each), well inside the 170-minute job. Log: `.superpowers/raw-pages/yummy/dry-run-1.log` (git-ignored).

| | Pages |
|---|---|
| Discovered, fetched | 329, 329 (no refusal) |
| Would be saved | **312 tours** |
| Skipped no-departures | 7 |
| Parse failures | **10 (3.0%)**, all `no-stops` |
| Run checks | ok |
| Unmatched names | 61 |

**First-run floor: 104**, a third of the 312. With it, `yummy` joined the nightly matrix.

The 10 parse failures, each a tour none of whose `dist_list` names is recognised:

| Tour id | Code | Unmatched names (`dist_list`) |
|---|---|---|
| 6207 | `KG-D-GL03` | 潮汕 |
| 6206 | `KG-D-GH03` | 潮汕 |
| 6179 | `AA-T-AF05` | 台灣 |
| 6150 | `AA-R-ZM09` | 蒙古, 烏蘭巴托, 貝加爾湖 |
| 5783 | `BG-R-RR03` | 清远 |
| 5685 | `BG-E-YR02` | none: an empty `dist_list` |
| 5651 | `BG-E-VK02` | none: an empty `dist_list` |
| 5617 | `AL-S-JK06` | 陕西, 山西 |
| 5587 | `AL-Y-MA08` | 云南 |
| 5505 | `AL-M-DG06` | 陕西, 山西 |

The most frequent unmatched names (pages each appeared on; the log's top 15 in its order, which cuts through the names on 2 pages: 遼寧 and 陕西 are on 2 pages too):

| Name | Pages | Name | Pages | Name | Pages |
|---|---|---|---|---|---|
| 西江 | 7 | 響沙灣 | 3 | 德化 | 2 |
| 長江三峽 | 6 | 儋州 | 2 | 東營 | 2 |
| 宜章 | 5 | 南澳島 | 2 | 浙江 | 2 |
| 銅仁 | 4 | 山西 | 2 | 海花島 | 2 |
| 信宜 | 3 | 平南 | 2 | 潮汕 | 2 |

**Open: a places pass**, to be done separately, with before-and-after sweeps over every operator's saved dry-run logs (as for Charming and EGL): province-only lists such as `陕西,山西` written with Simplified characters (also `云南`, and `清远` for 清遠), the region 潮汕, a 台灣-only list, and Mongolia (蒙古, 烏蘭巴托; 貝加爾湖 is in Russia). No place was added with this crawl; the two tours with an empty `dist_list` stay failures whatever the places list holds.

## Places pass (task 34, 2026-11-15)

The open places pass above is done, with offline before-and-after sweeps over every operator's saved crawl log (`.superpowers/sdd/00-plan/task-34-changes.tsv`, git-ignored; every changed route read).

- **Simplified spellings** are recognised in general, not one alias at a time: the shared places index also matches each city's and region's names in their Simplified form, from the generated `names.zh-Hans.json` (`清远` → 清遠, `揭阳` → 揭陽, `陕西` → 西北, `云南` → 雲南). A Simplified form that is a Traditional name of another place is not added; countries are matched by their data names only. Over the other operators' logs it changed only right routes (EGL's `神户` is Kobe, Big Line's `鲁朗`, `凯米`, `埃托沙` are Lulang, Kemi and Etosha), apart from 阿格拉 (the mainland name of Agra) inside `阿格拉比特儲水池` in Tunisia, now a guard.
- **Province-only lists** become region stops: `陕西 | 山西` is 西北 → 華北 (山西 is now a name of 華北, where the data keeps 大同, 平遙, 太原), `云南` is 雲南, `浙江`, `安徽` are 上海及華東, `遼寧` is 東北三省.
- **Added**: 潮汕 (an alias of 汕頭; at first a place of its own, changed in the review), 東北 as a second name of 東北三省 (beside Chinese stops it no longer reads as Japan's Tohoku: AL-D-KZ08 was 吉林 → 長白山 → 東北 (日本)), 長江三峽, 西江千戶苗寨 (with `西江`; `西江花…` in Zhongshan is a guard), 宜章, 汝城, 常德, 銅仁, 信宜, 電白, 恩平, 徐聞, 南澳島, 儋州 (with `海花島`), 平南, 金秀, 靖西, 巴馬, 德化, 吉安, 宜春, 新餘, 上猶, 龍南, 井岡山 (BL-J-BA06 read it as Okayama), 桐鄉, 文成, 橫店, 彭水, 彌勒, 丘北, 廣南, 東營, 賽里木湖 (`賽裏木湖`), 丹陽 (Korea), Mongolia (蒙古, 烏蘭巴托; group 南亞及中亞) and 貝加爾湖 (Russia); aliases 富士 (富士山), 響沙灣 (鄂爾多斯), 小七孔 (荔波), `天眼` and `中國天眼` (平塘), 巴拿山 (峴港).
- **Guards for short names** (review): `文成公主`, `彌勒佛`, `平南路`, `太平南`, `金華火腿`, `富士蘋果`, `吉安慶修院`, `廣南省`, `奧巴馬`, `青松觀` and others (Traditional and Simplified); 丹陽, 全州, 廣南, 吉安, 青松 are collision names.
- **Not added**: 鳳凰 (inside 鳳凰城, 鳳凰嶺 and dish names), 長壽 (`長壽之鄉`), 南沙 (EGL's `南沙港` is a ferry pier), 無量山, 花江大橋, 中亞 (several countries), 西九 (Hong Kong), 嘉儀 (a misspelling of 嘉義), 溫泉 and 感謝周 (not places).

**Yummy after the pass (offline, the practice crawl's log):** **319 would be saved, 3 `no-stops`, 7 no departures: 3 parse failures (0.9%)**, against 312 / 10 (3.0%). Still failing: the 台灣-only list (a country) and the two tours with an empty `dist_list`. The floor stays 104.

## Every URL fetched (investigation: 12 + 2 page fetches; robots.txt not counted)

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

**Not fetched in the investigation:** any itinerary image or PDF; a second or third tour (a coach or rail tour: fetched later for the fixtures, see "Scraper and fixtures"); the `pages-content-content` and `pages-filter-filter` scripts; `hk.yummyholiday.cn`; any staff endpoint; any POST.

For the fixtures (Task 30, after the owner's approval), 4 more, by a probe script through `createFetcher` with undici's `EnvHttpProxyAgent` installed as `cli.ts` does, which would stop at the first refusal, block or non-200 (none came), plus the fetcher's own read of `api.yummyholiday.net/robots.txt` (not counted; not saved; it allowed all four):

| # | UTC (2026-11-14) | URL | Result |
|---|---|---|---|
| 15 | 13:14:59 | https://api.yummyholiday.net/bussiness/line/detail?id=5662 | 200 JSON, 10,189 bytes |
| 16 | 13:15:03 | https://api.yummyholiday.net/bussiness/group/list?line_id=5662 | 200 JSON, 45,882 bytes (58 groups) |
| 17 | 13:15:07 | https://api.yummyholiday.net/bussiness/line/detail?id=6033 | 200 JSON, 4,433 bytes |
| 18 | 13:15:10 | https://api.yummyholiday.net/bussiness/group/list?line_id=6033 | 200 JSON, 8,692 bytes (9 groups) |

## Not verified

- Whether the itinerary PDFs (`promot_files`) have a text layer with day headings and the gathering point.
- ~~That the dates call answers the same for coach and rail tours.~~ Verified for one coach and one rail tour by the fixture capture (see "Scraper and fixtures").
- Why `price` differs from `adult_price` on 64 tours, and whether the "from" price is always the early-booking price.
- Whether the dates call includes past departures: in the fixture capture its earliest group was the capture day itself (5662, cancelled), never an earlier date; whether a departed group is ever answered is still not known (the parser keeps any, and normaliseTour drops them). What `enroll_status`, `is_website_show` (0 on every departure) and `expire_date` mean is not known.
- Whether `dist_list` is in visiting order (see "Scraper and fixtures": the three tours cannot settle it).
- What the API answers for a tour id it no longer has (none was asked for).
- Whether the server caps `limit` on the listing.
- The tour page link form `/#/pages/detail/detail?id=<id>` (inferred from the code and the terms page's own link, not opened).
- Whether `hk.yummyholiday.cn` is a live second site.
