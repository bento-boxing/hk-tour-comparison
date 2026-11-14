OWNER DECISION PENDING

DATES NOT AVAILABLE WITHIN THE RULES (a plain GET of a tour's booking page gives the dates, per-date prices and status for one calendar month only; the other months load through an ASP.NET postback, a `POST` with the page's `__VIEWSTATE`, and the listing JSON names at most 6 later dates per status, without a year; the day-by-day itinerary exists only as a PDF under `/tourpdf/`, which robots.txt disallows)

# Sunflower Travel 新華旅遊 (`sunflower`): operator investigation

- Capture date: **2026-11-14** (Hong Kong). The pages were fetched 2026-11-13 23:13–23:58 UTC, which was 07:13–07:58 on 14 November in Hong Kong.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, one at a time, 3 s per site), with undici's `EnvHttpProxyAgent` installed as `cli.ts` does. All were GETs with no extra headers, cookies or tokens. Page fetches used: **12 of 12**, plus robots.txt once (not counted). Two of the 12 were redirect hops the fetcher followed (a 302 and a 301). Every request is listed under "Every URL fetched".
- Raw responses and the ledger are in `.superpowers/raw-pages/sunflower/` (git-ignored). The probe script is outside the repository.
- No block page, captcha, JavaScript challenge, login wall, 403 or 429 was met. Cloudflare fronts the site (`server: cloudflare`, `cf-ray`), with ASP.NET behind it (`x-powered-by: ASP.NET`). Every page answered a plain GET.

## Who the operator is

- **Sunflower Travel Service Limited 新華旅遊有限公司**, Travel Industry Council licence **350196**. The licence number is printed in the footer of every page fetched (`Copyright © 2020 Sunflower Travel Service Limited. All rights reserved. 牌照號碼 : 350196`) and on the terms PDF (`牌照號碼：350196`). A web search (company name only) found the TIC register entry for "SUNFLOWER TRAVEL SERVICE LTD" with the same licence number and a head office in Kwun Tong. That matches the terms PDF's head office (`九龍觀塘觀塘道398-402號 Eastcore 6樓602-603室`).
- Official site: **https://www.sunflower.com.hk/** (it redirects to `/app`). Online booking is under `https://www.sunflower.com.hk/OnlineBooking/`. Related sites linked from the home page and not looked at: `sunnyholidays.com.hk`, `sunflowerlife.hk`.
- Identification: **confident.**

## Recommendation

**REDUCED LISTING POSSIBLE, with an owner decision.** Three reasons:

1. **No prohibiting clause was found, but there are no website terms of use.** The site's only terms document is a booking-terms PDF for customers (read; details below). It has no clause about automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use. The footer has a `使用條款` (terms of use) entry, but it is **inside an HTML comment** and links nowhere, so there are no terms of use to read. The pages carry `All rights reserved.`, which is a rights notice, not a clause.
2. **robots.txt allows everything needed except the itinerary PDFs.** The tour list JSON (`/App/Tour/Get`) and the booking pages (`/OnlineBooking/`) are allowed. The day-by-day itinerary exists only as `https://www.sunflower.com.hk/tourpdf/<code>.pdf`, and `Disallow: /tourpdf/` forbids it. None was fetched. So **day-by-day headings cannot be shown.**
3. **Dates and per-date prices are complete for one month only.** A GET of `/OnlineBooking/?TourCode=<code>` serves a calendar of one month (the first month with departures, as far as two samples show). Each departure date in it has its "from" price and status. The previous/next month links are `javascript:__doPostBack(...)`, which is a POST with the page's `__VIEWSTATE`. That is outside the rules and was not sent. For later months, the only allowed source is the listing JSON's `tdp_confirm` / `tdp_hardpush` lists. These give **at most 6 dates per status, as `D/M` with no year**, and **only dates that have a status**. Dates without a status in later months cannot be found at all.

**What a reduced listing would show** (370 tours, all by plain GET of allowed URLs, about 19 minutes a night):

- **Shown:** tour code, title, days (from the `#<n>天團` tag on the booking page; the code's 5th–6th characters agree on the samples), region/area/subarea (cities in a coarse form), gathering point for the Guangdong coach tours (from the code suffix and the title, see below), "from" price (original and discounted), and the first calendar month's departure dates, each with its price and its status (`保證成團` "guaranteed" or `快將成團` "about to be guaranteed").
- **Also possible, if the owner accepts more requests:** for each later date the listing names (at most 6 per status, no year), one GET of `/OnlineBooking/?date=YYYYMMDD&TourCode=<code>` gives that date's prices per group and seats left (`尚餘名額`). The URL pattern is the page's own (the calendar cells use it), but for a date outside the shown month **we built the URL ourselves** (fetch #9). It worked: it showed 15 January 2027's two groups. The year has to be guessed from the order of the dates.
- **Not shown:** day-by-day headings (PDF, disallowed); later-month dates that have no status; a complete date list for any tour whose departures run past the first month; any "full" or "closed" marker. No such marker was seen. Days without a departure are plain cells with no link, and a full date may look the same, but this is **not verified**.
- **Not covered at all:** the 246 listing entries without an online booking code (`ItinCode` empty: cruises, private groups, Hong Kong day trips, an air-ticket entry, and some tours). Their dates exist only in free text (`DepartureText`, 66 of them) or in the disallowed PDFs.

**Owner decision needed:** (a) accept a reduced listing as above, with dates complete only for the first month and no day-by-day itinerary; and (b) whether the nightly job may use the per-date booking-step URL (`?date=…`) for later dates the listing names. These pages are step 3 of the booking flow (`選擇報名人數及填寫資料`, "choose the number of people and fill in details"). A GET only shows the form. Nothing is submitted.

**What asking Sunflower would need to cover**, if the owner wants the full data:

- permission to read the itinerary PDFs under `/tourpdf/` (about 616 files), or another source of the day headings;
- a way to get every month's dates and per-date prices without the `__doPostBack` POST, e.g. a GET parameter for the month, or a feed;
- the rate (one request at a time, at least 3 s apart, User-Agent `tour-comparison-bot/0.1`);
- publishing those facts on a personal, non-commercial comparison site with a link back to the booking page, copying no descriptions or images.

## robots.txt (`https://www.sunflower.com.hk/robots.txt`, read 2026-11-13 23:13:21 UTC)

HTTP 200, `text/plain`, `last-modified: Mon, 04 Sep 2017 06:50:06 GMT`. The whole file, verbatim (CRLF line ends; it has no final newline):

```
User-agent: *
Disallow: /theme/2010/wedding/
Disallow: /tourpdf/
Disallow: /hotepackpdf/
Disallow: /admin/ 
Disallow: /testing/
```

- One group, `User-agent: *`. No group names AI or other bots. No `Crawl-delay`. No `Sitemap` line.
- `/App/...`, `/App/Tour/Get`, `/OnlineBooking/...` and `/OnlineBooking/package_terms_and_conditions.pdf` are allowed. `/tourpdf/` (the itinerary PDFs) is **disallowed**. `/pricelistpdf/` and `/visa/` (optional-extras price lists and visa notes, linked from the listing) are allowed but were not needed or fetched.
- `/sitemap.xml` does not exist (HTTP 404, the site's own "page not found" page).
- One quirk of the probe: when the fetcher followed the 301 to `http://www.sunflower.com.hk/OnlineBooking/…` (fetch #8), it asked for the `http://` origin's robots.txt, and the probe served it the saved `https://` copy (same host) instead of requesting it. So the `http://` robots.txt was **not fetched**. A scraper should request the `https://…/OnlineBooking/?TourCode=…` form directly (fetches #9 and #11 did, with no redirect).

## Terms

| Document | URL | Read | Result |
|---|---|---|---|
| `條款及細則` (terms and conditions; the footer link, and the link in the booking form's "I have read and agree" box) | https://www.sunflower.com.hk/OnlineBooking/package_terms_and_conditions.pdf | 2026-11-14 (fetched 23:26:30 UTC on 13 Nov) | HTTP 200, 2,815,072 bytes, 3 pages, **images only (no text layer)**. Read by eye from page images (110 dpi whole pages; the numbered clauses on pages 1 and 3 again at 250 dpi). Contents below. |
| `使用條款` (terms of use) | – | – | **Does not exist as a link.** It is in the footer only inside an HTML comment: `<!-- <div class="col s12 m2"> <h6>條款及細則</h6> <ul> <li>使用條款 </li> <li>隱私政策</li> …`. Same on the home page and the cookie page. |
| `Cookie政策` (cookie policy) | https://www.sunflower.com.hk/App/Cookie | 2026-11-14 (fetched 23:57:54 UTC on 13 Nov) | HTTP 200. It explains cookies and how to turn them off in browsers. No clause on use of the site or its content. |
| `個人私隱政策` (privacy policy) | https://www.sunflower.com.hk/aboutus/privacy/privacy.pdf | not fetched | Out of budget. A privacy policy is not expected to restrict use of the site, but this was **not checked**. |

**The terms PDF** has three pages. Page 1 is `旅遊細則及責任事項` ("tour terms and responsibilities"): deposits, payment, cancellation, `責任細則` (liability, clauses (一)–(十二)), `旅客參與活動免責條款` (activity disclaimer), `其他特殊情況` (special cases), insurance, and a privacy statement. Page 2 is `旅行團或郵輪假期注意事項` ("notes for tours and cruises", 15 points). Page 3 is `自悠行套票、機票、酒店 訂購條款與責任細則` (package, air ticket and hotel terms, sections (一)–(五)). The PDF's metadata title is `ATAB08SS` (a tour code), and the page footers read `F001/2510`, `R001/TOUR/2408` and `P001/2408`.

Clauses on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use (personal / non-commercial): **none.** Every clause is about booking, payment, cancellation, travel documents, liability, insurance or personal data. Because the PDF is images, this was not a text search. It is a careful read of every section heading and every numbered clause on pages 1 and 3, and of the whole of page 2. The deposit and cancellation tables at the top of page 1 were read at the lower resolution only.

The only clauses that mention the website or what the company "reserves":

- `本公司的個人資料(私隱)政策聲明詳載於本公司之網頁內。` ("our personal data (privacy) policy statement is set out on our website"). Privacy, not use of the site.
- `(十) 本公司保留接受報名與否之最後權利。` ("the company reserves the final right to accept or refuse a booking"). About bookings.
- `以上所有細則，均以本公司最終處理情況為準。` ("all of the above terms are subject to the company's final handling"). About the terms.

Rights notices (not clauses), verbatim: `Copyright © 2020 Sunflower Travel Service Limited. All rights reserved. 牌照號碼 : 350196` (site footer), and `Copyright © 2016 Sunflower Travel Service Limited. All rights reserved. 牌照號碼: 350196` (booking pages).

A note on prices, from the booking pages: `費用根據2026年12月2日的成人佔半房價格而定。` ("the price is based on the adult twin-share fare for 2 December 2026"). It is about the price, not about using the content.

## Where each fact comes from

Three sources were read: the **listing JSON** (`GET /App/Tour/Get?Region=&Area=&Subarea=&keyword=`, `{"status":true,"data":[…]}`, 616 entries); the **booking page** of `KKFE05WR` (Korea, by air, 5 days) and `CFAG03MK` (Guangdong coach, 3 days, Mong Kok pick-up); and the **booking step page** for one date of `KKFE05WR` (`?date=20270115`).

The listing page `/App/Tour/<region>` is an empty Vue template. Its script loads the list with `axios.get('/App/Tour/Get', {params: {Region, Area, Subarea, keyword}})`, a plain GET. An empty `Region` returns every region in one response (1,968,761 bytes).

| Fact | Where | Path / selector | Example |
|---|---|---|---|
| Tour code | listing JSON; booking page | `data[].ItinCode` (empty for 246 entries); the PDF name `data[].link` (`<code>.pdf`, present on all 616); booking page `(<code>)` after the title, and `#javascript_hdfLongTourPackageCode` holds the departure group code | `KKFE05WR`; group `KKFE05-261201WR-A` |
| Title | listing JSON; booking page | `data[].Title` (HTML allowed); `SubTitle`, `Description` are marketing text | `暢遊冬日秘境釜山慶州食足13餐五天團` |
| Days | booking page | `#Content_lbtnday` text `#5天團` / `#3天團`. Also characters 5–6 of the code (`KKFE`**`05`**`WR`, `CFAG`**`03`**`MK`), which agrees on both samples but is **inferred, not stated**. Titles often say it too (`五天團`, `3天`). | `#5天團` |
| Nights | **not given** | No nights field anywhere served. | – |
| Day-by-day headings | **only in the itinerary PDF** `https://www.sunflower.com.hk/tourpdf/<link>` (booking page `#Content_hplBrochurePDF`, `行程單張`) | **Disallowed by robots.txt** (`Disallow: /tourpdf/`). Not fetched. | – |
| Cities / country | listing JSON | `data[].region` (`日韓`, `中國長線`, …), `area` (`韓國`), `subarea` (`釜山、慶州`); also keywords in `theme3` | `日韓 / 韓國 / 釜山、慶州` |
| Start / gathering point | **partly**: listing JSON and booking page | Guangdong coach tours come in variants by code suffix: `LW` (title ends `關口集散`, "border checkpoint gathering"), `MK` (`旺角集散`, Mong Kok), `TO` (`將軍澳集散`, Tseung Kwan O), `YL` (`元朗集散`, Yuen Long). The booking page's description adds the place in free text. Flight tours: no gathering point seen (it is in the PDF, or sent later). | `CFAG03MK`: `旺角居民 專屬優惠 包來回程接送 : 旺角金雞廣場 近洗衣街 集合/解散` |
| "From" price | listing JSON; booking page | JSON `minprice` (number) = `pricetext` (original), `discount` / `discounttext` (after discount), `discountamt`. Booking page: `td.boxtext` `優惠價 HKD:` / `原價 HKD:` `div.pricetab.pricebox`, with the base date in `span.priceboxtext`. | `minprice 3299`, `discounttext "2,699"` |
| Departure dates | booking page (one month); listing JSON (partial) | Booking page: `table#Content_cdrDateOfDeparture`, month heading in the inner `td[width="70%"]` (`2026年12月`); each departure is a `td.Calcell.Ava-Calcell…` with `onclick="window.location='?date=YYYYMMDD&TourCode=<code>#ancPaxSelection'"`. Non-departure days are `td.Calcell` without `onclick`. **Other months only by `__doPostBack` (POST).** JSON: `tdp_confirm`, `tdp_hardpush` = `"D/M,D/M,…"`, **no year, at most 6, then `...`** (152 of 740 lists are cut). | Dec 2026: 28 departures on `KKFE05WR` |
| Per-date price | booking page (one month); booking step page (any known date) | Calendar cell `span.price` (`$2,999起`, already discounted, the discounts in `span.promotext`). Booking step page `?date=YYYYMMDD&TourCode=<code>`: table `.ABTourStyle` rows `團號 / 尚餘名額 / 暫定航空公司 / 成人佔半房價 / 小童佔半房價 / 小童不佔房價` per departure group, plus `單人房附加費` (single supplement) and taxes. | 2027-01-15 `KKFE05-270115WR-A`: 6 seats, `TW`, `HK$3,299`; group `-B`: 8 seats, `HK$3,499` |
| Full / closed marker | **not seen** | Status by cell class: `Ava-Calcell-G` + `保證成團` (blue, guaranteed), `Ava-Calcell-H` + `快將成團` (green, about to be guaranteed), plain `Ava-Calcell` (bookable, no status). Seats left: `尚餘名額` on the booking step page. No `額滿` / `滿` / `截止` text anywhere in the samples. | – |

Other notes:

- The calendar shows the **first month with departures**: November for `CFAG03MK` (first date 22 Nov), December for `KKFE05WR` (first date 1 Dec; no November dates). Two samples only.
- `?date=20270115` did **not** move the calendar. It still showed December 2026. It only opened the booking step for that date. So the GET `date` parameter cannot be used to page through months.
- `CheckUpdate.ashx` (`GET https://www.sunflower.com.hk/OnlineBooking/Json/CheckUpdate.ashx?LongCode=…&UpdateChanges=…`) is called by the booking page's script. It looks like a "has this changed" check and was not needed or sent.
- `eff_from` / `eff_to` (`M/D/YYYY 0:00:00`) are the brochure validity dates, not departure dates.

## Number and date formats

- Prices: JSON numbers (`minprice: 3299`) and strings with commas (`"3,299"`). Pages: `$2,999起`, `HK$3,299`, `HKD: 2,699`. All HKD.
- Dates: calendar `?date=YYYYMMDD`; month heading `YYYY年M月`; listing `D/M` with no year; booking step `出發日期 ： 2027年1月15日`.
- Days: `#5天團`; titles `五天團`, `5天`, `3天`.

## Discovering tours and nightly cost

**Discovery:** one GET, `https://www.sunflower.com.hk/App/Tour/Get?Region=&Area=&Subarea=&keyword=`. There is no sitemap. On 2026-11-14 it held **616 entries** (all with distinct `rID` and `link`):

| Region | Entries | With `ItinCode` (online booking) |
|---|---|---|
| 中國長線 (China long-haul) | 181 | 126 |
| 中國短線 (Guangdong short trips, mostly coach) | 112 | 103 |
| 郵輪 (cruises) | 65 | 0 |
| 長線 (long-haul) | 64 | 55 |
| 日韓 (Japan, Korea) | 53 | 47 |
| 包團 (private groups) | 51 | 0 |
| 東南亞 (South-East Asia) | 45 | 24 |
| 台灣 (Taiwan) | 22 | 15 |
| 香港 (Hong Kong day trips) | 22 | 0 |
| 機票 (air tickets) | 1 | 0 |
| **Total** | **616** | **370** |

The 370 bookable entries are the listable group tours. 69 of the 103 Guangdong ones are Mong Kok, Tseung Kwan O and Yuen Long pick-up variants (`MK`/`TO`/`YL`) of a border-gathering tour (`LW`); the variants have their own prices. 69 of the 370 have no dates in either listing list.

**Requests per night** (3 s apart, plus response time):

| Route | Requests per tour | Per night | Time | Within the rules? |
|---|---|---|---|---|
| Listing JSON + booking page (first month) | 1 | 1 + 370 = 371 | about 19 min | yes |
| + booking step page for each later date the listing names | 1 + up to 12 | 371 + up to 1,452 (the dates listed; those in the first month would not need it) | up to about 1 h 31 min | yes (owner decision b) |
| + other months via `__doPostBack` | 1 + months | – | – | **no** (POST with `__VIEWSTATE`) |
| + itinerary PDF | +1 | +370 | +19 min | **no** (robots.txt) |

All of these fit the 170-minute nightly limit.

## Every URL fetched (12 page fetches; robots.txt not counted)

All were GETs through `createFetcher`. "Bytes" is the size of the decoded body. The ledger (`.superpowers/raw-pages/sunflower/ledger.tsv`) also lists each time the saved robots.txt was reused instead of fetched again.

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | 23:13:21 | https://www.sunflower.com.hk/robots.txt | 200, 133 bytes |
| 1 | 23:15:33 | https://www.sunflower.com.hk/sitemap.xml | 404, 1,663 bytes (site's "page not found"; there is no sitemap) |
| 2 | 23:17:25 | https://www.sunflower.com.hk/ | 302 → `https://www.sunflower.com.hk/app` (set an `ASPSESSIONID…` cookie, which was not stored or sent back) |
| 3 | 23:17:29 | https://www.sunflower.com.hk/app | 200, 191,154 bytes (home page; footer links, licence number) |
| 4 | 23:26:30 | https://www.sunflower.com.hk/OnlineBooking/package_terms_and_conditions.pdf | 200, 2,815,072 bytes (terms PDF, 3 pages, images only) |
| 5 | 23:31:23 | https://www.sunflower.com.hk/App/Tour/%E6%97%A5%E9%9F%93 (`/App/Tour/日韓`) | 200, 186,821 bytes (listing page: Vue template, no tours in the HTML) |
| 6 | 23:40:00 | https://www.sunflower.com.hk/App/Tour/Get?Region=%E6%97%A5%E9%9F%93&Area=&Subarea=&keyword= | 200, 163,249 bytes (JSON, 53 entries) |
| 7 | 23:42:45 | https://www.sunflower.com.hk/OnlineBooking?TourCode=KKFE05WR | 301 → `http://www.sunflower.com.hk/OnlineBooking/?TourCode=KKFE05WR` (note: `http`) |
| 8 | 23:42:51 | http://www.sunflower.com.hk/OnlineBooking/?TourCode=KKFE05WR | 200, 122,521 bytes (booking page, December 2026 calendar) |
| 9 | 23:50:54 | https://www.sunflower.com.hk/OnlineBooking/?date=20270115&TourCode=KKFE05WR | 200, 175,647 bytes (calendar still December; booking step for 15 Jan 2027 with groups A/B, seats and prices) |
| 10 | 23:54:58 | https://www.sunflower.com.hk/App/Tour/Get?Region=&Area=&Subarea=&keyword= | 200, 1,968,761 bytes (JSON, all 616 entries) |
| 11 | 23:56:33 | https://www.sunflower.com.hk/OnlineBooking/?TourCode=CFAG03MK | 200, 105,272 bytes (coach tour, November 2026 calendar) |
| 12 | 23:57:54 | https://www.sunflower.com.hk/App/Cookie | 200, 69,432 bytes (cookie policy; no use clause) |

**Not fetched:** any `/tourpdf/` itinerary (disallowed); the privacy policy PDF; any `__doPostBack` month change (POST); `CheckUpdate.ashx`; `/App/API/GetTourTable` and `/App/API/LoadIMG` (menu and images, not needed); any script file (the data requests are inline in the pages); a third tour of a different kind (for example long-haul or a cruise); `/pricelistpdf/` and `/visa/` PDFs.

Before fetch #1, a run that requested only robots.txt was used to learn the rules. Its page request was stopped inside the probe before it was sent (nothing reached the server; it is not in the ledger and not counted).

## Fixtures

**None saved.** The operator is waiting for an owner decision. The raw pages stay under `.superpowers/raw-pages/sunflower/` only.

## Not verified

- Whether the booking page always shows the first month that has departures (two samples).
- How a full or closed date appears: no such date was seen. It may be a cell without a link, which would look like a day with no departure.
- Whether `尚餘名額` reaches `0` or disappears when a group is full.
- Whether the `tdp_*` lists always hold the earliest 6 dates of each status (true for `KKFE05WR` in December).
- Whether the code's 5th–6th characters always equal the days (two samples, and the counts look plausible).
- The deposit and cancellation tables at the top of the terms PDF's page 1 were read only at the lower resolution.
- The privacy policy, and whether any other terms exist on other Sunflower sites.
- Whether long-haul tours, cruises or Taiwan tours use the same booking page layout (only Korea and Guangdong were seen).
- The `http://` robots.txt was not requested (see robots.txt above). It is the same host, so it is expected to be the same file.
