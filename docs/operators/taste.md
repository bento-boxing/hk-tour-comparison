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

The scraper is `packages/scraper/src/operators/taste/`. It is registered with a **provisional** first-run floor of **186** (60% of the 311 products the list held on 2026-11-20, all of them group tours as far as seen) and is **not** in the nightly matrix (`.github/workflows/nightly-scrape.yml`) until a measured practice crawl has set its floor (`awaitingMeasuredCrawl` in `cli.test.ts`). The operator row is migration `0006_taste_operator.sql` (tag colour `#007a7a`, a teal).

**Requests.** Only three path shapes on `https://tastetravel.com.hk`, plain GETs through the run's polite fetcher with no extra headers, each following a redirect only within that origin (`sameOriginRedirectsOnly`): `/tour/select/page/<offset>` with offset 0, 10, 20, … until the last list page; then, per tour, `/tour/detail/tour_id/<n>` once and `/tour/event/tour_id/<n>` once (the dates are not asked for when the tour page got no answer). Never `/tour/download/…` or `/tour/whatsapp/…` (click counters), a PDF, an image, a search or a booking step. A test pins that a run requests nothing else. The `ci_session` cookie every answer sets is never kept or sent back: the fetcher (Node's `fetch`) has no cookie store and sends only its User-Agent (the task 45 ledger records the headers sent on every request: the User-Agent alone).

**Discovery.** List pages are read in order from offset 0. A list entry (`.list-tour-box a.list-tour`) is a **group tour** when it links a tour page (`https://tastetravel.com.hk/tour/detail/tour_id/<n>`), its title starts with a tour code (`CAK03 - …`; the title after it may be empty, as SJS12's is) and it gives a day count (`span.desc-day`, `3天`). Anything else (a ticket, hotel or package, should the site list one) is left out, not a failure, and counted in one log line by why (`no tour code`, `no day count`, `not a tour page link`; fixed texts, so the public log shows them). Every one of the 55 cards seen (list pages 1, 16 and 32, and the home page) is a group tour by this rule; no other kind of product was seen. The list ends only at a page whose pager has no `下一頁` (next page) link. Guards, each failing discovery with a fixed text (the run fails as `discover-error` and nothing is saved, rather than a list read in part marking the rest inactive): a list page not fetched or not a list page; a page with entries that is not the page its offset asks for, by the pager's current-page marker (`<a class="selected">16</a>`; this also checks that `/page/0` answers as page 1; fix round 1); a page whose entries all appeared on earlier pages; an empty page that still links a next page (fix round 1); a list still linking a next page after 60 pages (600 entries); no group tour at all; and entries read more than 10% fewer than the product count the first page states (`共為您找到<span>311</span>條商品`, the same 311 on pages 1, 16 and 32; fix round 1). A tour listed on two pages (the list is paged by offset, so an entry can shift during the night) is kept once and counted in the log; one shifted back onto a page already read is missed that night, so marked inactive. A summary line gives the site's product count, the entries found, the pages read, the tours and the entries left out (counts only).

**The allow-list** (`public.ts`): from the tour page only the title (`.detail-name`), the code (`.detail-number`), the days line (`行程天數：N天` inside `.detail-day`), the "from" price (`.detail-price .tig span`), each day's line (`#tour_days_detail .detail-desc-day-box .detail-desc-desc`) and the gathering options' places (below), as text; from the dates answer only each element's `date` and `title` (status). The description, highlights, tags, fee notes, the rest of the booking notes, the remarks, the WhatsApp and PDF links, scripts and the dates' colours are never kept. The dates answer is parsed as JSON, never evaluated; an answer that is not a JSON list makes the tour "not fetched" (logged by its code).

What the parser reads, and its rules:

- **Code**: `.detail-number` (`團號：CAK03`), letters, digits, `_` and `-`. **Days**: `行程天數：N天`, 1 to 60. **"From" price**: the number in `.detail-price .tig span` (`HKD<span>699</span> 起`), HK$100 or more. A page without any of the three is a parse failure, with a fixed reason; none is ever taken from the title, the code or the list card.
- **Title**: `.detail-name` as text (any HTML removed; `<全包價>` is not a tag and stays). It may be empty.
- **Link back and identity**: `https://tastetravel.com.hk/tour/detail/tour_id/<n>`.
- **Route**: each day's line, the site's `⇨` read as `→` (the long-haul lines often join places with `⇨` and no space, `香港⇨大阪`, which the shared rules would read as one word), through the shared place matching. Places named only inside `【】` (attraction and restaurant names) are not read, as for every operator (see "Places" below). **The title is the fallback route** (`fallbackRoute`, owner ruling in task 45 fix round 1, as Big Line and Sunflower have it): read, by the shared fallback rules, only when the day lines give no stop. It is read as it is, so `【】` in it are dropped too: reading inside them was tried and gives wrong places (a Foshan town's distillery museum read as the Jiangxi city 九江). The site gives no region or category to fall back on instead.
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

## Known route errors (task 45 fix round 1)

Wrong stops the shared rules give on the five Taste tours read. They are pinned in the fixtures as the code gives them today and marked there as known errors, **not intended**. None is fixed in this task: the shared place rules (`packages/core/src/stops.ts`) and the places data serve every operator, and a change needs the replay sweep over every operator's saved logs (a separate task, driven by the practice crawl).

1. **羅馬 (Rome) on GAF04 (Fujian, fixture `rail-fujian`).** A day line describes a hotel's Roman-style architecture: the name 羅馬 followed by the word for architecture, in one chunk. The shared rules match a city name anywhere inside a longer chunk.
2. **雲林 (Yunlin, Taiwan) on SJS12 (Japan, fixture `air-japan`).** From a Japanese temple's name (雲林 followed by the word for temple), written in angle brackets. The shared rules do not drop angle brackets, and on this site they also carry real places (`<開羅>`), so they cannot simply be dropped.
3. **杜拜 (Dubai) and 伊斯坦堡 (Istanbul) on EED09 (Egypt, fixture `air-egypt`), three times each.** From `杜拜/多哈/伊斯坦堡`, a choice of transit hub on the first, eighth and last day. The shared rules read each `/` alternative as a stop when the line has no transit word (`轉機`, `中轉`, …). Every Taste long-haul tour written this way will do the same. No transit-hub rule was built (coordinator's ruling, fix round 1).

## What the practice crawl must check

(The review's eight points, task 45.)

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
| `air-egypt` | EED09 (586), Egypt 9 days | Air tour from Hong Kong airport, `⇨` day lines, 26 dates into 2027; the known wrong stops 杜拜 and 伊斯坦堡 |
| `rail-fujian` | GAF04 (1175), Fujian 4 days | High-speed rail from West Kowloon; the known wrong stop 羅馬 |
| `air-japan` | SJS12 (1114), Japan 12 days | The last tour of the list, one date, `香港⇨大阪`; the known wrong stop 雲林 |
| `coach-huizhou` | LHA02 (1170), Boluo 2 days | A 2-day hotel-stay trip, Shenzhen-border gathering, no stops even with the title (`博羅` not in the data) |
| `list-first`, `list-middle`, `list-last` | list pages 1, 16, 32, cut to 4, 4 and 1 cards | Discovery, and how the last page shows |

## Not verified

- How a full or closed date appears, if at all (no full date seen in 67 dates).
- Whether the dates data ever carries a price, or other statuses than the three seen (none in 67 dates).
- Whether every itinerary PDF has a weekday price table, and whether holiday dates have their own prices (one PDF read).
- Whether the "all tours" listing holds every tour of every category, including category 103 and `特色團隊`, without duplicates (pages 1, 16 and 32 read; the count 311 is the site's own, and consistent with 32 pages).
- Whether `/tour/select/page/0` answers as the first page: the investigation read page 1 as `/tour/select`, and the site's own pager links it as `/tour/select/page`. The scraper asks for `/page/0` (the brief's shape); discovery now fails if the pager does not mark it page 1, and the practice crawl must check it.
- A list short enough for one page: assumed to show no pager at all (the missing current-page marker is then accepted on the first page); not seen.
- What a list offset past the end answers (not requested: the scraper stops at the page with no next link).
- Whether listing prices and dates always match the tour page and dates data (not compared).
- Whether `/sitemap.xml` exists.
- The `惡劣天氣安排` and `付款方法` pages, and any website terms of use not linked from the footer.
- Whether the code's last two digits always equal the days (23 tours agree; not used).
- A cruise's page (GFC05, `tour_id` 1201, not fetched): assumed to have the same layout as the other tour pages.
