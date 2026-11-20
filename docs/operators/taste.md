APPROVED 2026-11-19: owner approved a reduced listing (every departure date shown at the tour's "from" price marked 起, the site having no price per date; no full marker, so a full date may be listed as bookable; the list pages, then each tour's page and its dates answer)

MOSTLY REACHABLE WITHIN THE RULES. robots.txt does not exist (HTTP 404 on both hosts), and every fact except two answers a plain GET: tour code, title, days, day-by-day route, gathering point (as free text), "from" price, and the full list of departure dates, each with a status. **Missing:** a price for each date (no page or data address has one; the only per-date pricing is a weekday/weekend table inside each tour's itinerary PDF) and any full/closed marker (none seen).

# Taste Travel 味力之旅 (`taste`): operator investigation

- Capture date: **2026-11-20** (Hong Kong). The requests were made 2026-11-19 21:09–21:15 UTC, which was 05:09–05:15 on 20 November in Hong Kong.
- All requests to the operator's host went through `createFetcher` (User-Agent `tour-comparison-bot/0.1 (+https://ganbintuen.com; hello@ganbintuen.com)`, robots.txt obeyed, one at a time, 3 s per site). undici's `EnvHttpProxyAgent` is installed only when the environment names a proxy, as `cli.ts` does; none was set, so the requests went direct. All were GETs with the fetcher's own headers only (the ledger records the headers sent: the User-Agent alone). No cookie was stored or sent back. Page fetches used: **12 of 12**, plus robots.txt on two hosts (not counted). One of the 12 was a redirect hop (a 307). Every request is listed under "Every URL fetched".
- Raw responses, the ledger and the probe script are in the agent's scratchpad (outside the repository) and are not committed.
- No block page, captcha, JavaScript challenge, login wall, 403, 429 or 503 was met. The server answers as `Apache`, with no CDN or bot protection seen. It is a CodeIgniter site: every answer set a `ci_session` cookie, which was not stored or sent back.

## Who the operator is

| What | Value | Source |
|---|---|---|
| Brand | **味力之旅 / TASTE TRAVEL** | The site's `<title>` (`味力之旅`), footer (`@Copyright 2023 味力之旅 AlI Rights Reserved`), and logo |
| Licence holder | **TASTE TRAVEL INTERNATIONAL LIMITED 味力之旅高鐵遊(國際)集團有限公司**, trade names `TASTE TRAVEL` and `味力之旅` | Travel Industry Council register, https://www.tichk.org/en/travel-agent-information/22492-0 (read 2026-11-20 with WebFetch; not an operator host). The register gives a head office in Fo Tan, branches in Kowloon, Tsuen Wan, Tuen Mun, Yuen Long, Kwun Tong and Causeway Bay, and the business as outbound package tours (retail and wholesale), ticketing, air-plus-hotel, corporate travel, MICE, hotel, cruise packages and local tours. |
| Licence number | **353465** | The same register page; also printed under the logo on the site's terms image (`牌照號碼：353465`, request #11). |
| Official site | **https://tastetravel.com.hk/** | The register names `https://www.tastetravel.com.hk` as the website. dns.google gives both `tastetravel.com.hk` and `www.tastetravel.com.hk` the same address, `116.251.204.85`. Every link on the site uses `https://tastetravel.com.hk/` (no `www`). |

Identification: **confident.** The site's about page (`/about`) names the company as `香港味力之旅高鐵遊(國際)集團有限公司` / `Taste Travel International Limited`. That is the register's name with `香港` in front; the English name matches exactly. The terms image carries the register's licence number and the site's address.

Web searches for `tastetravel.com.hk`, "Taste Travel" and `味力之旅` with "licence" found nothing useful. A search restricted to tichk.org found the register entry. The site's own home page carries no licence number.

## Recommendation

**Go ahead with a reduced listing, after one owner decision on prices.** No robots.txt exists, so nothing is disallowed. No website terms of use were found, and the booking terms say nothing about automated access or copying. Every page and the dates data address answered a plain GET with no extra header.

What a nightly run could show, by plain GET of allowed URLs:

- tour code, title, days, the day-by-day route (place names per day), the gathering point (free text), the "from" price (HKD), and **every departure date** the site lists, each with its status: `已成團` (confirmed), `快成團` (about to be confirmed) or `收客中` (taking bookings);
- a link back to the tour: `https://tastetravel.com.hk/tour/detail/tour_id/<n>`.

What it cannot show:

- **a price for each date.** Neither the tour page nor the dates data has one. Only the tour's "from" price (`HKD 699 起`) is given. The one itinerary PDF read has a small price table by day of the week (Sunday–Thursday and Friday–Saturday, adult and child). Reading those tables would mean fetching one PDF per tour each night (311 more requests) and extracting text from a designer's PDF in which the digits are in a font without a text map. That is fragile, and the table may not cover holiday dates. **Not recommended.**
- **a full or closed marker.** None was seen (three tours' dates, 51 dates in all). Whether a full date disappears, stays as `已成團`, or gets another status is **not known**.

**Owner decisions:**

1. **Prices:** show every date at the tour's "from" price followed by 起 (as Sunflower's later dates are shown), **or** also read each tour's itinerary PDF for its weekday/weekend price table (311 more requests a night, fragile; not recommended), **or** ask Taste Travel for per-date prices.
2. **Full dates:** accept that a full date may be listed as bookable. Visitors would be told to check on the operator's site.
3. **Which pages a night:** listing pages + tour page + dates data per tour (about 654 requests, about 36 minutes), or listing pages + dates data only (about 343 requests, about 19 minutes) without the day-by-day route and gathering point. The first is recommended: the route is what the site's search uses.

**If the owner wants to ask Taste Travel first** (not required by anything found), a request would cover: per-date prices and full dates (a feed, or a field in `/tour/event/tour_id/<n>`); the rate (one request at a time, at least 3 s apart, once a night, about 650 requests, User-Agent `tour-comparison-bot/0.1`); and publishing those facts on a personal, non-commercial comparison site with a link back to the tour page, copying no descriptions or images.

## Terms

| Document | URL | Read | Result |
|---|---|---|---|
| `旅遊細則及責任` (footer link; travel terms and responsibilities) | https://tastetravel.com.hk/leaflet/select/leaflet_id/5 (page) showing https://tastetravel.com.hk/assets/uploads/leaflet/5_0.jpg | Yes: page (#2) and image (#11, 1654 × 7178 pixels, read by eye in eight strips) | Booking terms headed `【旅遊細則及責任事項】`, marked `2025年1月1日起生效（修定版）` (effective 1 January 2025, revised). Sections: `訂金及付款` (deposits and payment), `臨時取消及退款` (cancellation and refunds), `費用包括` / `費用不包括` (what the price includes and excludes), `責任細則` (liability, clauses (一)–(十一)), `其他特殊情況` (special cases, (一)–(八) and notes), `因迫不得已的理由而取消旅行團` (cancellation for unavoidable reasons). |
| Website terms of use, privacy policy, disclaimer | none linked | – | **None found.** The footer links are `公司簡介`, `分行地址`, `報紙廣告`, `宣傳單張`, `客戶意見`, `聯繫我們`, `銀行户口資料`, `惡劣天氣安排`, `旅遊細則及責任`, `付款方法`, `上傳入數紙`. None is a terms-of-use, privacy or copyright page. `惡劣天氣安排` (bad weather) and `付款方法` (payment methods) were not read. |

Clauses on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use: **none in the booking terms.** It was a careful read of every heading and numbered clause; the terms are an image, so this was not a text search. Whether the site has website terms of use elsewhere: **not known** (none is linked).

The only clauses that mention leaflets or media, (九) and (十) of `責任細則`, say that pictures and menus shown on `行程單張、宣傳單張或宣傳媒體` (itinerary leaflets, flyers or media) are `只作參考用途` (for reference only). That is about accuracy, not about use of the content.

Rights notice (not a clause), verbatim from every page's footer: `@Copyright 2023 味力之旅 AlI Rights Reserved`.

## robots.txt

| Host | Read (UTC, 2026-11-19) | Answer |
|---|---|---|
| `https://tastetravel.com.hk/robots.txt` | 21:09:45, and again 21:10:24 (the first run did not keep the body) | **HTTP 404**, 1,130 bytes, `text/html`: the site's CodeIgniter page `404 Page Not Found` / `The page you requested was not found.` |
| `https://www.tastetravel.com.hk/robots.txt` | 21:09:58 | **HTTP 404**, 1,130 bytes, the same page |

- There is **no robots.txt**. Under RFC 9309, and in `createFetcher`, a 404 means every path is allowed for every bot. No Crawl-delay, so the fetcher's 3 s applies. No Sitemap line.
- This is not a sign of the operator's wishes either way: the site states none.
- Later runs of the probe reused the saved 404 answer instead of asking again (marked `reused 404` in the ledger).

## How the site works

A server-rendered PHP (CodeIgniter) site. Addresses are path segments: `/tour/select/<key>/<value>/…/page/<offset>`.

| Page | URL pattern | What it holds |
|---|---|---|
| All tours | `/tour` (307 → `/tour/select`), then `/tour/select/page/<offset>` with offset 0, 10, 20, … 310 | 10 cards a page; `共為您找到<span>311</span>條商品` (311 products found). Pagination is CodeIgniter's (`data-ci-pagination-page`), last page `/tour/select/page/310`. |
| By category | `/tour/select/cateparent/<n>/page`, `/tour/select/cateparent/<n>/category/<m>/page` | Main menu: 6 `廣東短線` (Guangdong short tours), 10 `中國高鐵` (China by high-speed rail), 1 `中國長線` (China by air), 3 `東南亞` (South-East Asia, Japan, Korea, Taiwan, a cruise), 7 `世界長線系列` (long-haul), 63 `特色團隊` (featured groups, a grouping of tours from the other categories). Also 103 (`廣東 + 福建`, `+ 湖南`, …, on the home page only). Not needed: the "all" list covers them. |
| Other filters | `/tour/select/tag/<n>/page`, `/area/<n>`, `/tour_days/<n>`, `/startDate/YYYY-MM-DD/endDate/YYYY-MM-DD`, `/tour_keyword/<text>`, `/order/tour_price/ascend/asc` | Not needed. |
| Tour page | `/tour/detail/tour_id/<n>` (numeric id; seen 249 to 1239) | Code, title, days, highlights, day-by-day itinerary, price notes, booking notes with the gathering point, the "from" price, a link to the itinerary PDF. **No dates in the HTML**: the calendar (FullCalendar) is empty and filled by script. |
| Dates data | `/tour/event/tour_id/<n>` | A JSON array (served as `text/html`) of `{backgroundColor, borderColor, textColor, title, date}`. The page's script loads it with `$.get(...)` and `eval`. Plain GET, no parameters, no token, no cookie. Our request sent no `X-Requested-With` header (jQuery would add one in a browser) and got HTTP 200 with the data. |
| Itinerary PDF | `/assets/uploads/tour/<n>/pdf.pdf` | A one-page A3 leaflet (Adobe Illustrator). Read for one tour (#8). |

**Never to be requested by a scraper:** `/tour/download/tour_id/<n>` and `/tour/whatsapp/tour_id/<n>`. The page's script calls them when a visitor clicks "view PDF" or "WhatsApp booking", so they look like click counters. Requesting them would distort the operator's statistics. Also never: `/contact/select/tour_id/<n>/date/…` (the e-mail booking form), `/advice` (customer feedback form), `/receipt/select` (payment-slip upload).

**Other products:** the site shows only tours. No tickets, hotels or air-plus-hotel products were seen on the listing. A cruise (GFC05, `東南亞`) and a Maldives trip (`tour_id` 1005, `東南亞`) appear on the home page as tour cards with days and dates, so they would be listed like any tour. Leaflets, newspaper ads and bank details are image pages.

## Where each fact comes from

Samples: the listing page 1 (10 tours), the tour pages of CAK03 (Guangdong coach, 3 days, `tour_id` 693) and EED09 (Egypt, 9 days, `tour_id` 586), and the dates data of 693, 586 and GAF04 (Fujian by high-speed rail, 4 days, `tour_id` 1175).

| Fact | Where | Path / selector | Example |
|---|---|---|---|
| Tour code | tour page; listing | `.detail-number` `團號：CAK03`. Listing: `.list-tour-desc-title` starts `<code> - `. The booking notes also give `行程編號: CAK03-010926` (code plus the itinerary's effective date). | `CAK03`, `EED09`, `FYA10` |
| Title | tour page; listing | `.detail-name`; listing `.list-tour-desc-title` after `<code> - `. Titles carry marketing words and often the days. | – |
| Days | tour page; listing | `.detail-day` `行程天數：3天`; listing `span.desc-day` `10天`. The code's last two digits agree on every sample (`CAK`**`03`**, `EED`**`09`**, `FYA`**`10`**), but that is inferred, not stated. | `3天` |
| Nights | **not given** | – | – |
| Day-by-day route | tour page | `#tour_days_detail .detail-desc-day-box`: `.detail-desc-day` (`第 1 天`) and `.detail-desc-desc`, places joined by `→` or `⇨`. One box per day (3 on CAK03, 9 on EED09). | EED09 day 2: `開羅⇨ … ⇨ 阿斯旺 …`; CAK03 day 1: `深圳（福田/深圳灣）關口集合 → … 江門 …` |
| Gathering point | tour page, free text | The first `#tour_notice .detail-desc-text` (`預定須知`), the lines after `集合時間地點`; also often day 1's first words. Note: two elements share the id `tour_notice`. | CAK03: `落馬洲火車站(福田口岸1號門)` or `深圳灣口岸` (two choices); EED09: `集合時間地點 : 香港國際機場` |
| "From" price | tour page; listing | `.detail-price .tig span` (`HKD<span>699</span> 起`); listing `span.desc-price` (`$11999 起`). HKD, per person. | `699`, `21998` |
| Departure dates | **dates data** | `/tour/event/tour_id/<n>`: every element's `date` (`YYYY-MM-DD`). All future dates, it seems: CAK03 18 dates from 2026-11-21 to 2027-01-01; EED09 26 dates to 2027-06-24 (weekly); GAF04 7 dates in December. The listing cards show only the `已成團` and `快成團` dates (at most 6 per status seen, `D/M`, no year), never `收客中` ones, so the cards are not a full list. | `2026-11-21` |
| Status per date | dates data | `title`: `已成團` (`#d9534f`), `快成團` (`#4E8BEE`), `收客中` (`#ff9900`). Listing classes `date-status-yes` (已成團) and `date-status-no` (快成團). | CAK03: 1 已成團, 1 快成團, 16 收客中 |
| Per-date price | **not on any page or in the dates data** | Only in the itinerary PDF, as a table by weekday. CAK03's PDF: `日至四` (Sunday–Thursday) adult $699 / child (no bed) $539; `五至六` (Friday–Saturday) adult $739 / child $569, `起`. The digits sit in a font with no text map, so a plain text extraction drops them; they were read here from the raw font bytes. The PDF also says `生效日期：01-09-2026` (effective 1 September 2026). | – |
| Full / closed marker | **not seen** | No `額滿`, `滿額`, `截止`, `售罄` or similar on any page or in the dates data read. | – |
| Link back | – | `https://tastetravel.com.hk/tour/detail/tour_id/<n>` (the site's own links; no canonical tag, no `www`). | `…/tour_id/693` |

No `<meta name="description">`, Open Graph, canonical link or JSON-LD on the tour pages.

## Number and date formats

- Prices: `HKD<span>699</span> 起` (tour page), `$11999 起` (listing), `$699` in the PDF. Whole HKD, no commas.
- Dates: `YYYY-MM-DD` (dates data); `D/M` with no year (listing cards); `DD-MM-YYYY` (PDF effective date).
- Days: `3天`, `行程天數：3天`.

## Discovering tours and nightly cost

**Discovery:** the "all tours" listing, `/tour/select/page/<offset>`, 10 tours a page. On 2026-11-20 it held **311 products** (32 pages). There is no sitemap link and none was requested (`/sitemap.xml`: not known). Nothing in the listing marks a non-tour product; all cards seen have a code, days, a price and dates.

**Requests per night** (at least 3 s apart, plus response time; the answers here took under a second):

| Route | Requests | Time | Within the rules? |
|---|---|---|---|
| 32 listing pages + 311 dates data | about 343 | about 19 min | yes (no route, no gathering point) |
| + 311 tour pages | about 654 | about 36 min | yes (recommended) |
| + 311 itinerary PDFs (weekday prices) | about 965 | about 54 min, about 460 MB a night (one PDF was 1.5 MB) | robots.txt allows it; **not recommended** (fragile, heavy) |

All fit the 170-minute nightly limit.

**What could make a nightly run fragile:**

- The listing is paged by offset. If tours are added or removed during a run, a tour can be missed or seen twice. Dedupe by `tour_id`. (Corrected in task 45 fix round 1: a tour missed from a night's list is **marked inactive** that night by the save, like any tour missing from a successful run; it comes back the next night it is listed.)
- The dates data is served as `text/html` and parsed by the page with `eval`. A scraper must parse it as JSON (never evaluate it) and treat a non-JSON answer as "not fetched".
- The site is one Apache server with no CDN. 650 requests at 3 s spacing should be light, but it is a small site.
- Card dates and "from" prices on the listing may differ from the tour page (not compared).

## Personal data

None of individuals was seen. The pages carry the company's WhatsApp booking numbers (`wa.me/…` links) and branch details on the contact page (not fetched). None is recorded here.

## Every URL fetched (12 page fetches; robots.txt not counted)

All were GETs through `createFetcher` with only its User-Agent header. Times are UTC on 2026-11-19. "Bytes" is the size of the body as received.

| # | UTC | URL | Result |
|---|---|---|---|
| – | 21:09:45 | https://tastetravel.com.hk/robots.txt | 404, 1,130 bytes (no robots.txt: all allowed) |
| – | 21:09:58 | https://www.tastetravel.com.hk/robots.txt | 404, 1,130 bytes (the same) |
| – | 21:10:24 | https://tastetravel.com.hk/robots.txt | 404 again (asked once more so its body was kept; later runs reused it) |
| 1 | 21:10:27 | https://tastetravel.com.hk/ | 200, 75,583 bytes (home page: menu, categories, footer) |
| 2 | 21:10:57 | https://tastetravel.com.hk/leaflet/select/leaflet_id/5 | 200, 9,188 bytes (terms page; the terms are an image) |
| 3 | 21:11:01 | https://tastetravel.com.hk/about | 200, 16,099 bytes (company name) |
| 4 | 21:11:50 | https://tastetravel.com.hk/tour | 307 → `https://tastetravel.com.hk/tour/select` |
| 5 | 21:11:54 | https://tastetravel.com.hk/tour/select | 200, 59,926 bytes (listing page 1 of 32, 311 products) |
| 6 | 21:12:14 | https://tastetravel.com.hk/tour/detail/tour_id/693 | 200, 23,626 bytes (CAK03, Guangdong, 3 days) |
| 7 | 21:12:34 | https://tastetravel.com.hk/tour/event/tour_id/693 | 200, 2,197 bytes (dates data, 18 dates) |
| 8 | 21:12:45 | https://tastetravel.com.hk/assets/uploads/tour/693/pdf.pdf | 200, 1,538,536 bytes, `application/pdf` (itinerary leaflet, weekday price table) |
| 9 | 21:12:50 | https://tastetravel.com.hk/tour/detail/tour_id/586 | 200, 28,311 bytes (EED09, Egypt, 9 days) |
| 10 | 21:12:53 | https://tastetravel.com.hk/tour/event/tour_id/586 | 200, 3,173 bytes (dates data, 26 dates) |
| 11 | 21:14:32 | https://tastetravel.com.hk/assets/uploads/leaflet/5_0.jpg | 200, 5,271,728 bytes, `image/jpeg` (the terms) |
| 12 | 21:15:26 | https://tastetravel.com.hk/tour/event/tour_id/1175 | 200, 855 bytes (GAF04 dates data: 7 dates, all `收客中`; its listing card shows none) |

A first run asked only for the two robots.txt files; the page requests that would have followed were stopped inside the probe and never sent (6 lines `NOT SENT` in the ledger, not counted). After #12, a test request for `/contact` was refused by the probe's 12-request cap before it was sent (3 lines `REFUSED`, not counted).

**Not fetched:** any other listing page; `/sitemap.xml`; any `www.` page; the `惡劣天氣安排` and `付款方法` leaflets; `/contact`; the site's script files (not needed: the data request is inline in the tour page); a tour that looked sold out (none could be picked out); `/tour/download/…`, `/tour/whatsapp/…` (click counters).

Outside the operator's hosts, for identification only: web searches; DNS lookups at `dns.google` for `tastetravel.com.hk` and `www.tastetravel.com.hk`; WebFetch of the register pages https://www.tichk.org/en/travel-agent-information/22492-0 (this operator) and …/23308-0 (a different agency that a search returned; not this one).

## Owner decision (2026-11-19)

A reduced listing: (1) prices: every date is listed with no price of its own and shown at the tour's "from" price followed by 起 (as Sunflower's later dates are); the itinerary PDFs are not read; (2) full dates: accepted that the site cannot tell when a date is full, so a full date may be listed as bookable; (3) pages: the list pages, then each tour's page and its dates answer (about 654 requests a night).

## Scraper and fixtures (task 45, 2026-11-19)

The scraper is `packages/scraper/src/operators/taste/`. It was registered with a provisional first-run floor of 186 (60% of the 311 products the list held on 2026-11-20); since task 48 the floor is **93**, measured by the practice crawl (see "Practice crawl (2026-11-20) and task 48"). It is in the nightly matrix (`.github/workflows/nightly-scrape.yml`) since task 48 (`awaitingMeasuredCrawl` in `cli.test.ts`, now empty, keeps the matrix and the registered operators in step). The operator row is migration `0006_taste_operator.sql` (tag colour `#007a7a`, a teal).

**Requests.** Only three path shapes on `https://tastetravel.com.hk`, plain GETs through the run's polite fetcher with no extra headers, each following a redirect only within that origin (`sameOriginRedirectsOnly`): `/tour/select/page/<offset>` with offset 0, 10, 20, … until the last list page; then, per tour, `/tour/detail/tour_id/<n>` once and `/tour/event/tour_id/<n>` once (the dates are not asked for when the tour page got no answer). Never `/tour/download/…` or `/tour/whatsapp/…` (click counters), a PDF, an image, a search or a booking step. A test pins that a run requests nothing else. The `ci_session` cookie every answer sets is never kept or sent back: the fetcher (Node's `fetch`) has no cookie store and sends only its User-Agent (the task 45 ledger records the headers sent on every request: the User-Agent alone).

**Discovery.** List pages are read in order from offset 0. A list entry (`.list-tour-box a.list-tour`) is a **group tour** when it links a tour page (`https://tastetravel.com.hk/tour/detail/tour_id/<n>`), its title starts with a tour code (`CAK03 - …`; the title after it may be empty, as SJS12's is) and it gives a day count (`span.desc-day`, `3天`). Anything else (a ticket, hotel or package, should the site list one) is left out, not a failure, and counted in one log line by why (`no tour code`, `no day count`, `not a tour page link`; fixed texts, so the public log shows them). Every one of the 55 cards seen (list pages 1, 16 and 32, and the home page) is a group tour by this rule; no other kind of product was seen. The list ends only at a page whose pager has no `下一頁` (next page) link. Guards, each failing discovery with a fixed text (the run fails as `discover-error` and nothing is saved, rather than a list read in part marking the rest inactive): a list page not fetched or not a list page; a page with entries that is not the page its offset asks for, by the pager's current-page marker (`<a class="selected">16</a>`; this also checks that `/page/0` answers as page 1; fix round 1); a page whose entries all appeared on earlier pages; an empty page that still links a next page (fix round 1); a list still linking a next page after 60 pages (600 entries); no group tour at all; and entries read more than 10% fewer than the product count the first page states (`共為您找到<span>311</span>條商品`, the same 311 on pages 1, 16 and 32; fix round 1). A tour listed on two pages (the list is paged by offset, so an entry can shift during the night) is kept once and counted in the log; one shifted back onto a page already read is missed that night, so marked inactive. A summary line gives the site's product count, the entries found, the pages read, the tours and the entries left out (counts only).

**The allow-list** (`public.ts`): from the tour page only the title (`.detail-name`), the code (`.detail-number`), the days line (`行程天數：N天` inside `.detail-day`), the "from" price (`.detail-price .tig span`), each day's line (`#tour_days_detail .detail-desc-day-box .detail-desc-desc`) and the gathering options' places (below), as text; from the dates answer only each element's `date` and `title` (status). The description, highlights, tags, fee notes, the rest of the booking notes, the remarks, the WhatsApp and PDF links, scripts and the dates' colours are never kept. The dates answer is parsed as JSON, never evaluated; an answer that is not a JSON list makes the tour "not fetched" (logged by its code).

What the parser reads, and its rules:

- **Code**: `.detail-number` (`團號：CAK03`), letters, digits, `_` and `-`. **Days**: `行程天數：N天`, 1 to 60. **"From" price**: the number in `.detail-price .tig span` (`HKD<span>699</span> 起`), HK$100 or more. A page without any of the three is a parse failure, with a fixed reason; none is ever taken from the title, the code or the list card.
- **Title**: `.detail-name` as text (any HTML removed; `<全包價>` is not a tag and stays). It may be empty.
- **Link back and identity**: `https://tastetravel.com.hk/tour/detail/tour_id/<n>`.
- **Route**: each day's line, the site's `⇨` read as `→` (the long-haul lines often join places with `⇨` and no space, `香港⇨大阪`, which the shared rules would read as one word), through the shared place matching. Places named only inside `【】` (attraction and restaurant names) are not read, as for every operator (see "Places" below). **The title is the fallback route** (`fallbackRoute`, owner ruling in task 45 fix round 1, as Big Line and Sunflower have it): read, by the shared fallback rules, only when the day lines give no stop. It is read as it is, so `【】` in it are dropped too: reading inside them was tried and gives wrong places (a Foshan town's distillery museum read as the Jiangxi city 九江). The site gives no region or category to fall back on instead. **Connections are not stops** (task 48, `route.ts`, Taste only): before the shared rules read the day lines, a chunk whose `/` alternatives name two or more different places is a choice of connection and is taken out (`杜拜/多哈/伊斯坦堡`, `經深圳北/廣州南站`), unless the tour visits every place it names anyway (a chunk of its own elsewhere names it: `峴港/會安` on a tour of both stays); a hub Taste offers that the places data lacks counts as a place (`HUBS_NOT_IN_DATA`: 多哈, so `杜拜/多哈` is a choice). A lone alternative right beside a choice that goes is the same connection, and goes too, unless another chunk names that place: the chunk just before the choice on its line (`香港 → 杜拜 → 杜拜/赫爾辛基/伊斯坦堡`), or the first chunk of the next line when the choice ends its line (`杜拜` the morning after `杜拜/赫爾辛基`). A hub named anywhere else is a visit and stays (fix round 1: a day in Zurich on a tour flown in by `杜拜/蘇黎世/法蘭克福`, an Istanbul stopover day). A chunk naming a place right after 經, via (`途經深圳北站`), goes; the spaces around a `/` are closed up first (`廣州南站 / 深圳北站`). Hong Kong never counts. A choice naming one place or none stays as it is (`懷化南/鳳凰古城站`, `桂林北/桂林西站`, a choice of pastimes).
- **Gathering point** (start and end alike): in the booking notes (the first `#tour_notice .detail-desc-text`; two elements share that id), the text after `集合時間地點` on its own line (`集合時間地點 : 香港國際機場`), else each option line right after it (`A: <time> <place>`, `B: …`), each cut to its place (the letter, the time, and anything from `【`, `出門` (directions), a comma or a full stop on dropped), joined with ` / `. The shared rules then read it as the other operators' gathering points are: a Shenzhen checkpoint (`福田`, `深圳灣`, `羅湖`, …) is kind `sz`, so Shenzhen is not a stop; Hong Kong (`香港國際機場`, `香港西九龍高鐵站…`) is kind `hk`. Examples: CAK03 and LHA02 `落馬洲火車站(福田口岸1號門) / 深圳灣口岸` → `sz` (`落馬洲` is the Hong Kong side of the Futian crossing; the option names 福田口岸, and the tours start at the Shenzhen border); EED09 and SJS12 `香港國際機場` → `hk`; GAF04 `香港西九龍高鐵站G層團體集合處1號` → `hk`. No label or nothing after it: none (read as Hong Kong). No free text that fits no kind was seen.
- **Departures**: every date of the dates answer on or after the run's date (Hong Kong) whose status is `已成團`, `快成團` or `收客中`, once each, sorted, each with **no price of its own** (`priceHkd` null). The website already shows such a date at the tour's stored "from" price followed by 起, counts it at that price in the window price, the price filter and sorting, and chains it with 起 (built for Sunflower, task 31): nothing was changed for Taste. A date with any other status (or none) is skipped and logged with its date and status value (`taste: CAK03: date 2026-12-25 has the status * (ref …), skipped`: the status by the error-message rule, so a Chinese word shows by its reference in the public log and whole in a dry run), so a full or cancelled marker, should the site add one, is never shown as bookable. A bookable date not in `YYYY-MM-DD` form is skipped too, and counted in a log line with the tour code (fix round 1: `taste: CAK03: 2 bookable dates not in YYYY-MM-DD form, skipped`), so a change in the format shows in the run log. A tour with no date left is skipped as `no-departures`.
- **已成團 (confirmed to depart)**: the data model has no "confirmed to depart" marker (`ScrapedDeparture` is a date and a price; the `departures` table has no status), and no other operator keeps one (Yummy Holiday reads the same three statuses and keeps them all as plain dates; Sunflower's `保證成團` cells likewise). None was added: 已成團 dates are listed like the others.
- **Nights**: none.

**Task 45 requests** (8 of the 8 allowed, all through `createFetcher` as `cli.ts` sets it up, from a probe outside the repository that counted every request, robots.txt included, and refused a 9th; robots.txt was asked once and its saved answer reused by the probe's later runs). All answered at once; no block, challenge, refusal or error.

| # | UTC, 2026-11-19 | URL | Result |
|---|---|---|---|
| 1 | 21:32:23 | https://tastetravel.com.hk/robots.txt | 404 (still no robots.txt: everything allowed) |
| 2 | 21:32:27 | https://tastetravel.com.hk/tour/select/page/310 | 200 (the last list page) |
| 3 | 21:32:31 | https://tastetravel.com.hk/tour/select/page/150 | 200 (list page 16) |
| 4 | 21:32:56 | https://tastetravel.com.hk/tour/detail/tour_id/1175 | 200 (GAF04, Fujian by high-speed rail, 4 days) |
| 5 | 21:33:00 | https://tastetravel.com.hk/tour/detail/tour_id/1114 | 200 (SJS12, Japan, 12 days; the last tour of the list) |
| 6 | 21:33:04 | https://tastetravel.com.hk/tour/detail/tour_id/1170 | 200 (LHA02, a 2-day coach trip with a hotel stay) |
| 7 | 21:33:33 | https://tastetravel.com.hk/tour/event/tour_id/1114 | 200 (1 date) |
| 8 | 21:33:37 | https://tastetravel.com.hk/tour/event/tour_id/1170 | 200 (15 dates) |

**What the fixture pages verified or contradicted:**

- **How the list ends** (verified): the last page (offset 310) holds one card, and its pager has `首頁`, `上一頁` and page numbers but no `下一頁` or `尾頁`. Every other page read links `下一頁`. Pages 1, 16 and 32 all state 311 products (31 full pages and one card: consistent).
- **Non-tours** (consistent with the investigation): all 21 cards on the three list pages read have a tour page link, a code and a day count. Page 16 is short trips, mostly Guangdong (nine Guangdong hot-spring, hotel-stay and food trips of 2 and 3 days, and one 5-day Guizhou trip by high-speed rail); their pages (LHA02) have the same layout as any tour's (code, days, day lines, gathering point, "from" price, dates). The list is not in tour-id order (CAK03, id 693, is on page 16).
- **Tour page layout** (verified on three more pages, a rail, a Japan and a coach tour): the same selectors everywhere. Two gathering formats seen: options `A:`/`B:` on the lines after the label (coach tours: the two Shenzhen checkpoints), or the place on the label's own line (air tours).
- **Dates answers** (verified): 16 more dates (SJS12: 1, `已成團`; LHA02: 15, `收客中`), 67 in all with the investigation's: no other status, no price, no full marker. SJS12's title names a departure on 8 November that is not in its answer (fetched 19 November): the site seems to drop past dates itself. The parser drops them anyway.
- **Code and days** (still only inferred): the code's last two digits equal the days on all 21 cards and 5 tour pages read. Not used.

**Places** (the 5 tour pages read, real titles and full day lines, offline, `places/data.json` as of `bb9e504`): **3 with stops** from their day lines (EED09 Egypt, GAF04 Fujian, SJS12 Japan), **1 from the title fallback** (CAK03 Jiangmen: 江門), **1 with no stops** (LHA02 Boluo). Both Guangdong coach trips name their places in their day lines only inside `【】` (attraction and restaurant names); CAK03's title names 江門, 開平 and 新會 outside brackets, written as one word joined by `•`, which the shared rules read as 江門 alone. LHA02's one town named outside brackets, `博羅`, is not in the data, and its title names no place. Unmatched place names: 多哈 (EED09, a transit hub), 博羅 (LHA02), 東山島 (GAF04); the rest of the unmatched words are sightseeing and meal phrases. Three tours carry wrong stops (see "Known route errors"). **No place was added** (none is a clear, frequent city on this sample), so no replay was needed. Short trips, mostly Guangdong, are a large part of the list (page 16 is ten short trips, nine of them in Guangdong), and their places often sit only inside `【】`; the review estimated 25–45% of all tours `no-stops` without a fallback, and the title fallback found a place on only 3 of page 16's 10 card titles. A run with more than 20% parse failures (`no-stops` counts as one) fails its checks: the practice crawl must measure this.

## Known route errors

The three wrong stops task 45 found on its five sample tours are **fixed in task 48**, with the rest of the practice crawl's (next section):

1. **羅馬 (Rome) on GAF04** (fixture `rail-fujian`), from a hotel's Roman-style architecture: the guard `羅馬建築`.
2. **雲林 (Yunlin, Taiwan) on SJS12** (fixture `air-japan`), from a Japanese temple's name in angle brackets: the guard `雲林寺`.
3. **杜拜 (Dubai) and 伊斯坦堡 (Istanbul) on EED09** (fixture `air-egypt`), from `杜拜/多哈/伊斯坦堡`, a choice of transit hub: the Taste-only connections rule (`route.ts`).

What remains known-wrong after task 48, on the practice crawl's 311 tours (each left on purpose; see "What was left"):

- **GFM03 (Meizhou, Pingyuan): 佛山 (Foshan).** From the name of a hill with a reclining Buddha, which holds 佛山; its real towns are only inside `【】`. A guard for the hill's name could fix it, after a replay.
- **CAP03 (Zhanjiang): 廣州 (Guangzhou), and 湛江 missing.** 廣州 from the old name of Zhanjiang (廣州 followed by the word for bay), in a guild hall's name; 湛江 is named only inside `【】`.
- **NTN03: 湛江 (Zhanjiang).** From the name of a chicken dish, in `《》`, which the shared rules read.
- **CBC02: 順德 (Shunde).** Most likely from a congee shop's name, inside a quoted name.
- **FSB12 (Sichuan): 香格里拉 (Shangri-La, Yunnan) four times.** From `香格里拉鎮`, the town in Daocheng county (Sichuan). Not aliased to 稻城: in Charming's log `香格里拉鎮` also stands for the Yunnan city (beside 飛來寺, near Deqin).
- **SKE05, SKH05 (Korea): 松島 read as Busan's Songdo.** They mean Incheon's Songdo (a water taxi, an outlet mall). Same country; left as it was.
- **KKW03 (Jiangmen and Zhongshan): the route is 斗門 only.** Right but short: its other places are named only inside `【】`. Before task 48 the title fallback gave 江門 alone.

## What the practice crawl must check

(The review's eight points, task 45. The crawl of 2026-11-20 answers each: see "Practice crawl (2026-11-20) and task 48" below.)

1. That the first request, `/tour/select/page/0`, returns page 1: the pager marks page 1 (discovery now fails otherwise), and the first card is the same as on `/tour/select`.
2. That discovery reads 32 pages, finds about 311 tours, and logs no "left out" or "listed twice" lines (or few).
3. **The `no-stops` share, and the unmatched names**, by tour family (codes starting C/K/L/N, the Guangdong short trips, against G/F/S/E), and how many routes come from the title fallback. This decides whether the run can pass the 20% parse-failure check, and feeds a places task.
4. Wrong stops: transit hubs (`杜拜/多哈/伊斯坦堡`), city names inside longer words (羅馬, 雲林), and 九江-type clashes.
5. The gathering points that end up as kind `other`, for example a Hong Kong district not in the keyword list, such as 旺角.
6. Any status other than 已成團, 快成團 and 收客中 in the log, and any "not in YYYY-MM-DD form" line.
7. The number of tours saved and of `no-departures`, to set the measured floor.
8. Time taken: expected about 33–44 minutes for about 655 requests.

Fixtures (`packages/scraper/src/operators/taste/fixtures/`): each tour fixture is a `<name>.page.json` (the run's date 2026-11-20, the trimmed tour page and the dates, as fetchPage joins them) with `<name>.expected.json` (`verifiedByOwner: false`, notes on every judgement call). For the public repository the title and each day line keep only the pieces that name a place, cut to the place name (a title naming none becomes `N天`), by a script; the route of the full page, title fallback included, was checked to be the same. No fixture is the trimming function's output alone: `publicTourPage` keeps the whole title and day lines (the run needs them, to match places and report unmatched words), so its output from any saved page holds marketing text (fix round 1, item 8). The trimming step is exercised on page-shaped test answers instead (`test-responses.ts`: `⇨` lines, `【】` lines, booking notes). The list fixtures keep only each card's link, code and day count, the product count and the pager.

| Fixture | Tour or page | Why |
|---|---|---|
| `coach-jiangmen` | CAK03 (693), Jiangmen 3 days | Shenzhen-border gathering (two options), all three statuses, route from the title (day-line places only in `【】`) |
| `air-egypt` | EED09 (586), Egypt 9 days | Air tour from Hong Kong airport, `⇨` day lines, 26 dates into 2027; the transit-hub choice `杜拜/多哈/伊斯坦堡`, no stop since task 48 |
| `rail-fujian` | GAF04 (1175), Fujian 4 days | High-speed rail from West Kowloon; the guard `羅馬建築` (task 48; before, a wrong stop 羅馬) |
| `air-japan` | SJS12 (1114), Japan 12 days | The last tour of the list, one date, `香港⇨大阪`; the guard `雲林寺` (task 48; before, a wrong stop 雲林) |
| `coach-huizhou` | LHA02 (1170), Boluo 2 days | A 2-day hotel-stay trip, Shenzhen-border gathering; route 博羅, in the places data since task 48 (before, no stops even with the title) |
| `list-first`, `list-middle`, `list-last` | list pages 1, 16, 32, cut to 4, 4 and 1 cards | Discovery, and how the last page shows |

## Practice crawl (2026-11-20) and task 48

**The crawl.** `pnpm scrape --operator taste --dry-run`, 2026-11-19 23:01 to 23:37 UTC (07:01 to 07:37 on 20 November in Hong Kong): **about 36 minutes**, read from the log file's creation and last-write times (the log itself has no clock). Log: `.superpowers/raw-pages/taste/dry-run-2026-11-20.log` (git-ignored). 32 list pages; the list stated 311 products and 311 entries were found, none left out, none listed twice; 311 tour pages and dates answers fetched; no refusal, block or page not fetched; run checks ok. As crawled: **274 tours would be saved**, 30 skipped with no departures, **7 parse failures (2.3%), all `no-stops`**. No date had a status other than 已成團, 快成團 and 收客中, and no bookable date was in another format. Every tour states its gathering point: 161 are kind `hk` (Hong Kong airport 99, West Kowloon station 61, Kai Tak cruise terminal 1), 150 kind `sz` (the Shenzhen checkpoints), none `other`.

The review's estimate of 25 to 45% `no-stops` did not hold: most short trips name their first town outside `【】`, right after the Shenzhen gathering (LHA02, NCA03: 博羅).

**Read by program, not by eye** (task 48; the scripts read every `page` line of the log and normalise it again with the core, offline). Where each tour's route came from, by the first letter of its code (all 311 tours, those with no departures given a date so that their route counts too):

| Codes | Tours | Day lines | Title | None | As crawled → after task 48 |
|---|---|---|---|---|---|
| C (coach from the Shenzhen border, 2-3 days) | 29 | 27 | 1 | 1 | 28 / 1 / 0 |
| K (coach, 2-3 days) | 33 | 30 | 1 | 2 | 32 / 0 / 1 |
| L (coach, 2-3 days) | 28 | 26 | 1 | 1 | 27 / 1 / 0 |
| N (coach, 2-4 days) | 40 | 38 | 0 | 2 | 40 / 0 / 0 |
| P (coach, 3-5 days, Guangdong and its neighbours) | 14 | 14 | 0 | 0 | 14 / 0 / 0 |
| G (high-speed rail, 3-12 days) | 67 | 66 | 0 | 1 | 66 / 0 / 1 |
| F (China by air) | 45 | 45 | 0 | 0 | 45 / 0 / 0 |
| S (South-East Asia, Japan, Korea, Taiwan) | 43 | 43 | 0 | 0 | 43 / 0 / 0 |
| E (long-haul) | 12 | 12 | 0 | 0 | 12 / 0 / 0 |
| All | 311 | 301 | 3 | 7 | 307 / 2 / 2 |

The title routes as crawled: CAK03 and KKW03 江門, LMP02 深圳 (a Shenzhen trip; right). After task 48 KKW03's day lines give 斗門.

**The 7 `no-stops` tours, and the places their pages name.** NCA03 and LHA02: 博羅, outside brackets (now a place: route 博羅). NKW03: 斗門 (now a place); 江門 and 中山 only inside `【】`. KYT03: 惠陽 (now a place); 惠東 only inside `【】`. CTL02: 平海古城, the old town in Huidong (now an alias of 惠東). GFC05, a cruise: 芽莊 (Nha Trang, now a place) in a phrase outside brackets. KAN03: none outside `【】` (南昆山, 東莞 inside): **left**. One tour became `no-stops`: GBM03, whose two stops were both wrong (威尼斯 from a pool named after Venice, 文昌 from a temple hall); every place it names (興國, 贛州) is inside `【】`: **left**. So **2 `no-stops` (0.6%)** after task 48.

**The 9 `too-far` drops: all right.** NFB03 and NSH03 lose 西江千戶苗寨 (Guizhou) read from 西江 in a Zhongshan flower park's name and a West River dish: both are 3-day coach trips in Guangdong (N codes), not a rail tour to Guizhou. NYA03 and KPC03 lose 高山 (Takayama: a dish, a village's name), KKN03 威尼斯 (a pool), KYZ03 香格里拉 (a likeness, `廣東香格里拉`), NLH03 雲頂高原 (a hotel's villa area), CBE02 阿勒泰 (a lawn nicknamed so), GCD03 和田 (inside `和田園`). The rule assumes that a tour of at most 3 days leaving by road or rail stays within Guangdong, Guangxi, Hunan, Fujian, Jiangxi, Macau (and Seoul or Busan by air). Taste's seven rail tours of 3 days go to Guangdong, Hunan and Jiangxi: the assumption holds, and the rule was not changed. Three of the drops are no longer needed: guards now stop the wrong reading (`威尼斯泳道`, `廣東香格里拉`, `和田園`).

**Stops in a country the tour does not visit: 41 tours as crawled** (35 of them with dates), of the 44 whose stops span more than one country (the 3 right ones: ECCA09 Central Asia, SKJ06 Shanghai and Jeju, GDE05 Guangxi and northern Vietnam). Their shapes:

- *A choice of transit hub*, `A/B/C` (11 long-haul tours: EED09, EEB10, EEF10, EEE10, EEG12, ETA13, EEA10, EBA15, EUA08, EEC09, EMA09): Dubai, Istanbul, Helsinki, Frankfurt, Zurich or Paris at both ends of a tour of Egypt, Morocco, Europe or the Balkans. Also, inside China, `經深圳北/廣州南站` or `途經深圳北站` on 25 rail tours, which gave 深圳 and 廣州 at both ends of a tour of Yunnan, Guizhou, Guangxi, Hunan, Fujian, Sichuan or Shanghai (wrong places, not a wrong country).
- *A likeness*: 水上威尼斯, 海上威尼斯, 上海的威尼斯 (Venice), 海南杜拜 (Dubai), 南島敦煌 (Dunhuang, on a Malaysia tour), 海上桂林 (Guilin, on Ha Long Bay tours), 廣東香格里拉, 侗族香格里拉, 世外桃園 (Taoyuan, Taiwan).
- *A building, dish or name after another place*: 羅馬建築, 羅馬城牆, 羅馬浴場 (in Bath), 羅馬神殿 (in Évora), 雲林寺 (Japan), 胡志明陵, 胡志明故居 and 胡志明亭 (in Hanoi and Dongxing), 丹尼斯 (a hotel in Zhengzhou: Nice), 基尼斯 (a record: Nice), 雲頂天梯 (Genting), 漢堡雜錦 (a dish: Hamburg), 上海生煎 and 福州世祖 (snacks in Taipei), 高山蘭花 and 高山下午茶 (Takayama), 松江河 (Matsue), 長泰山 (in Korea: Tai'an).
- *A city name inside a longer word*: 會安排 (Hoi An, on a Shandong tour), 天童話 (Tendo), 桃園居 (Taoyuan), 艾芙拉 (Évora, read as Edfu through the alias 艾芙), 雅拉山口 (Yala), 尊勝塔林 and a 塔林 beside 少林寺 (Tallinn, now dropped as a lone collision name once 雅拉 and 尼斯 no longer stand beside it), 竹山 in a Dongxing village (Zhushan, Taiwan; now a collision name).

After task 48: **none** (EMA09's 杜拜 went in fix round 1, with `HUBS_NOT_IN_DATA`). The same guards also fixed wrong places inside China: 台山 from 雲台山 (Henan), 中山 from 中山廣場, 中山橋 and 中山陵 (Dalian, Lanzhou, Nanjing), 昆明 from 昆明湖 (Beijing), 蓬萊 from 蓬萊三島 (Huangshan), 黃山 and 張家界 in comparisons, 大連 from `最大連片`, 杭州 from `杭州之水`, 長沙 from `長沙炮台` (on a Huizhou and Shanwei coach trip), 淡水 from a lake in Tibet, 長春 from a monastery in Litang, 和順 from a phrase, 九寨溝 from `高原九寨溝`, 羊卓雍措 from a lake in Sichuan, 鳳凰古城 from `湘南的鳳凰古城`.

**Unmatched names that are real places**, by the number of tours naming them, after task 48 (the log's frequency list is mostly sightseeing, meal and hotel words): 關西空港 4 (an airport), 新都橋 3, 海螺溝 3, 灌縣古城 3, and on 2 tours each 理塘, 廣元, 南江, 楊淩, 太白縣, 額濟納旗, 酒泉, 海東, 新興, 陽春, 陽西, 龍門, 興安, 鳳凰縣, 原州, 巴拉格宗, 光霧山, 白帝城, 成田 (an airport). 博羅 (6 tours), 斗門 (4), 茂縣 (4), 理縣 (4), 惠陽 (2), 興國 (5, outside brackets on 4) and 武岡 (2) were added.

**What task 48 changed.**

1. `pnpm replay` read only `dry-run-<n>.log`, so it silently left out Taste's dated log: it now also reads `dry-run-<YYYY-MM-DD>.log`.
2. **The connections rule** (`route.ts`, Taste only; see "Route" above). On the crawl's day lines it changes 36 routes (the 11 long-haul tours above and 25 rail tours), each read and right. Fix round 1 narrowed the lone-hub step (EEE10 kept two chunks naming its Zurich and Frankfurt days; its route was the same) and added 多哈 (EMA09).
3. **The places data** (shared by every operator): eight towns (博羅, 惠陽, 斗門, 武岡, 興國, 茂縣, 理縣, 芽莊), two aliases (艾芙拉 for Évora, 平海古城 for Huidong), 56 `notPlaces` guards and the collision name 竹山 (fix round 1: 興國 a collision name too, and the guards 興國寺, 兴国寺, 东兴国门; the replay's 92 changes unchanged). `pnpm replay --base ecb7b98` over every saved log (Big Line, Charming, EGL, Sunflower, Yummy, Taste; Jetour and Travel Expert have no saved crawl log, only their fixtures, whose tests pass): 92 tours change route, 76 of Taste and 16 of the others, every one right. Big Line CPEK05BCA and CPEK05BD lose 昆明 (from 昆明湖), SGNSP05, SGHON05 and SGHDS08 a 胡志明市 read from the mausoleum in Hanoi (SGHDS08 keeps the real one), CTXN06W 蓬萊; Charming PCMSD loses 台山 (from 雲臺山), PCCGR and PCMSB 中山 (中山陵, 中山橋), PMJZE gains 茂縣; EGL HTVHDS07, HTVHCX05, HTVHLX05, HTVHEX05 and MTV3HB05 lose the mausoleum's 胡志明市 (HTVHDS07 keeps the real one), HTGSPP03 gains 斗門.

Together, as Taste's crawl would run with them (the replay re-reads the logged day lines and cannot apply a parser change, so the connections rule was applied to them by a script calling `withoutConnections`): **279 tours saved** (274 as crawled), **2 `no-stops`** (7), **no tour with a wrong country** (41), 103 of the 311 routes changed.

**The replay and Taste.** `pnpm replay` re-reads the logged day lines and cannot apply the Taste-only connections rule, so a replay shows Taste's routes with the hub stops (杜拜, 伊斯坦堡, …) and the 深圳 and 廣州 stations that the site no longer has, and its Taste counts are not what a run gives. Its before-and-after comparison of a places-data change stays valid.

**The floor: 93**, a third of the 279 tours the crawl would save with these changes, as for the other operators (Big Line 169 of 507, Yummy 104 of 312, Sunflower 116 of 350: a third of what the measured crawl would save). The provisional 186 was 60% of the listed products.

**The nightly run.** Each operator is its own job of the matrix, run side by side, each with the 170-minute limit. Taste's job would take about 36 to 40 minutes (the crawl's 36, plus installing), well inside it; the night's longest job stays Big Line's (132 to 152 minutes measured).

**What was left, on purpose.** Doha (多哈) is not added to the places data: EGL's day lines name it alone as a hub (Taste's rule lists it instead). `香格里拉鎮` is not aliased to Daocheng. The unmatched towns above are not added: their tours already have stops nearby, and several are risky short names (興安 is in `大興安嶺` and is a panda's name in Big Line's log; 陽春 is a noodle; 新興 is a common word; 龍門 is a gate). KAN03 and GBM03 stay `no-stops`: their places are only inside `【】`, which the shared rules drop for every operator. A general rule for likenesses (`水上X`, `X之奇`) was not made: each guard is a phrase seen in the log.

## Not verified

- How a full or closed date appears, if at all (no full date seen in 67 dates).
- Whether the dates data ever carries a price, or other statuses than the three seen (none in 67 dates).
- Whether every itinerary PDF has a weekday price table, and whether holiday dates have their own prices (one PDF read).
- Whether the "all tours" listing holds every tour of every category, including category 103 and `特色團隊`, without duplicates (pages 1, 16 and 32 read; the count 311 is the site's own, and consistent with 32 pages).
- (Answered.) Whether `/tour/select/page/0` answers as the first page: yes, by the practice crawl of 2026-11-20. Discovery, which fails unless the pager marks the page its offset asks for, read all 32 pages and 311 entries, the product count the site states.
- A list short enough for one page: assumed to show no pager at all (the missing current-page marker is then accepted on the first page); not seen.
- What a list offset past the end answers (not requested: the scraper stops at the page with no next link).
- Whether listing prices and dates always match the tour page and dates data (not compared).
- Whether `/sitemap.xml` exists.
- The `惡劣天氣安排` and `付款方法` pages, and any website terms of use not linked from the footer.
- Whether the code's last two digits always equal the days: they do on all 311 tours of the practice crawl (still not used).
- (Answered.) A cruise's page: GFC05 was read in the practice crawl with the same layout as any tour (code, days, price, day lines, dates).
