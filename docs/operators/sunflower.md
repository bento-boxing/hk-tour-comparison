APPROVED 2026-11-14: owner approved a reduced listing (the first calendar month's dates with their own prices; the later dates the listing names, shown at the tour's "from" price marked 起; no per-date booking-step pages, no itinerary)

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

## Fix round 1 (2026-11-14)

- **Listing dates that have just passed** are dropped instead of moved a year on (rule above). On the capture date both rules keep all 1,452 listed dates (the furthest 321 days ahead); run on 21 November 2026, the first rule would have kept the 23 listed dates of 14–20 November as dates in 2027, the new one drops them.
- **Full cells** are excluded by their class, `Ava-Calcell-F`, as well as by their missing link.
- **Redirects**: the shared fetcher has an opt-in, per request (`fetchText(url, { sameOriginRedirectsOnly: true })`), that refuses a redirect to another origin before it is requested; the other operators do not set it and their fetching is unchanged. Sunflower sets it on both of its requests.
- **Guangdong short trips read their route from the title** (owner decision 2026-11-14; rule under Route above). Over the 103 `中國短線` tours of the saved listing (offline; table in `.superpowers/sdd/00-plan/task-31-title-stops.tsv`): 98 routes come from the title, 5 from the subarea (CFPS02LW/MK/TO/YL, whose title names 從化 and 增城, Guangzhou districts not in the places list, and CGEE03MY, a 潮汕 tour), none from the area. Read by hand: no title stop is wrong. Hotel names (`珠海拱北口岸希爾頓歡朋酒店`) name the city the tour stays in; concerts (`林峯演唱會-廣州站`) are in the city the tour goes to; `深中通道` and `湖南永州` give no stop; `澳門水舞間` gives 澳門, where the show is (CFMD03SD, CSMM02*: kept, the tours go to the show). Some titles name more places than the route keeps, since the shared rules take one city per word (`2天佛山中山美食團` gives 佛山; `2天澳門珠海中山純玩團` gives 澳門). The wrong stops are the 5 subarea fallbacks: 中山 (and 深圳 for the Hong Kong pick-ups) on CFPS02*, and 廣州, 中山, 深圳 on CGEE03MY. No place or guard was added (a `notPlaces` guard cannot fix a missing place; adding 從化, 增城 or 潮汕 is for the owner).
- Over all 370 tours the counts are unchanged: 245 with city stops, 59 area or region only, 66 no stops (at most 67 parse failures of 370, 18.1%, against the 20% check).

## Every URL fetched (investigation: 12 page fetches; task 31: 3 more; robots.txt not counted)

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

Task 31 (2026-11-14, UTC), through `createFetcher` with undici's `EnvHttpProxyAgent` as `cli.ts` installs it; robots.txt was read once more (`https://www.sunflower.com.hk/robots.txt`) before the first:

| # | UTC (2026-11-14) | URL | Result |
|---|---|---|---|
| 13 | 14:06:04 | https://www.sunflower.com.hk/OnlineBooking/?TourCode=LTZB08SP | 200, 112,406 bytes (Shandong, November calendar, a `額滿` cell) |
| 14 | 14:06:10 | https://www.sunflower.com.hk/OnlineBooking/?TourCode=BTTK09SP | 200, 107,877 bytes (Turkey, November calendar, one date) |
| 15 | 14:06:14 | https://www.sunflower.com.hk/OnlineBooking/?TourCode=WTPJ05SD | 200, 104,539 bytes (Taiwan, December calendar) |

**Not fetched:** any `/tourpdf/` itinerary (disallowed); the privacy policy PDF; any `__doPostBack` month change (POST); `CheckUpdate.ashx`; `/App/API/GetTourTable` and `/App/API/LoadIMG` (menu and images, not needed); any script file (the data requests are inline in the pages); a third tour of a different kind (for example long-haul or a cruise); `/pricelistpdf/` and `/visa/` PDFs.

Before fetch #1, a run that requested only robots.txt was used to learn the rules. Its page request was stopped inside the probe before it was sent (nothing reached the server; it is not in the ledger and not counted).

## Fixtures

See "Scraper and fixtures (2026-11-14)" below. The raw pages stay under `.superpowers/raw-pages/sunflower/` only.

## Owner decision (2026-11-14)

A reduced listing: (a) accepted, with dates complete only for the first calendar month and no day-by-day itinerary; (b) declined: the per-date booking-step pages (`?date=…`) are **not** used. The later dates the listing names are listed without a price of their own and shown at the tour's "from" price followed by 起.

## Scraper and fixtures (2026-11-14)

The scraper is `packages/scraper/src/operators/sunflower/`. Registered with a **provisional** first-run floor of 222 (60% of the 370 tours with a booking code on 2026-11-14, rounded down; no crawl has been measured). It is **not in the nightly matrix**: it joins after a measured crawl sets the real floor.

**Requests.** Only two paths on `https://www.sunflower.com.hk`, always in the `https://` form, plain GETs through the run's polite fetcher with no extra headers: `/App/Tour/Get?Region=&Area=&Subarea=&keyword=` once a night, then `/OnlineBooking/?TourCode=<ItinCode>` once per tour (about 371 requests a night, some 19 minutes at 3 s each). Never a `?date=` booking step, a `/tourpdf/` itinerary (disallowed by robots.txt), a `__doPostBack` POST for another month, or `CheckUpdate.ashx`. Both requests ask the fetcher to follow a redirect only within `https://www.sunflower.com.hk` (`sameOriginRedirectsOnly`, fix round 1): a redirect anywhere else, such as the investigation's 301 to `http://` for `/OnlineBooking?TourCode=…` without the slash, is not requested and the page counts as not fetched (never as gone).

**Discovery** reads the listing once. Only entries with a non-empty `ItinCode` are tours (370 on 2026-11-14); the others (cruises, private groups, Hong Kong day trips, an air-ticket entry, some tours) are left out, not counted as failures, and logged as one line with their number by region. A booking code that is not plain letters and digits, an answer that is not JSON, `status` other than `true`, no `data` list, or no entry with a booking code makes discovery throw (the run fails as `discover-error` and last night's tours stay). A code on more than one entry keeps the first (logged). Each tour's identity and "view on the operator's site" link is its booking page URL.

**The allow-list** (`public.ts`): from each listing entry only `ItinCode`, `Title`, `region`, `area`, `subarea`, `minprice`, `discount`, `discounttext`, `tdp_confirm` and `tdp_hardpush`; from the booking page only `#Content_lbtnday` and the calendar table `#Content_cdrDateOfDeparture`, with each element's `id`, `class`, `onclick` and `width` and the text of the days tag, the month heading (`td[width="70%"]`) and each `span.price`. `SubTitle`, `Description`, `TourMainTourName`, `promotext`, images, PDF links, the promotion notes in the calendar cells, holiday names, statuses as text, scripts and the booking form are never kept. fetchPage joins the run's date, the listing entry and the trimmed page as one JSON text for the parser.

What the parser reads, and its rules:

- **Code, title**: `ItinCode`; `Title` with any HTML removed (`<br>` a space, entities decoded; `<環島>`, `<榴槤>` and `<皇城根下尋古韻…>` are not tags and stay), whitespace collapsed, compatibility ideographs read as the ordinary character (Unicode NFC).
- **Days**: the booking page's `#Content_lbtnday` (`#5天團`). Without it the page is a parse failure; the code's characters are never used.
- **Route**: `subarea` split on `、`, ASCII and full-width commas and the middle dots `‧` (U+2027), `．` (U+FF0E), `·`, `・` (judgment call: the brief names only `、` and commas, but 6 Shandong and Fujian subareas list their cities with `‧`, and 4 Shanxi ones `山西．陝西`), one name per entry of `dayHeadings`, through the shared place matching. `area` is the tour's `fallbackRoute` (the opt-in read only when the subarea gives no stop, its unmatched words not reported). `region` is never read for the route. **Guangdong short trips** (`region` `中國短線`, owner decision 2026-11-14, fix round 1) read the title first: the title, with its brackets and marks (`【】《》「」()`, `▪`, `：`, `+`, …) turned into spaces, is the route line when it names a stop by the shared rules (Hong Kong left out, and Shenzhen for an `LW` tour, as normaliseTour does); it is then the tour's `fallbackRoute` with no `dayHeadings`, so the shared rules read it and its other words (`旺角集散`, `純玩團`, concert names) are never reported as unmatched. When the title names no stop, the subarea and the area are read as for any tour. The tour also sets `dropRegionWithListedCity`, so a province listed beside one of its own cities (`廣西、桂林`, `雲南、昆明、…`) is not a stop.
- **"From" price**: `discount` when it is a price (HK$100 or more), else `discounttext`, else `minprice`. All 370 tours had a discount on 2026-11-14.
- **Departures, the shown month**: every `td.Calcell` with a class starting `Ava-Calcell` (`Ava-Calcell`, `-G` 保證成團, `-H` 快將成團, holiday cells `holcell` included) whose `onclick` holds `?date=YYYYMMDD`, at its `span.price` (`$2,999起`, or `$2,999+` where the date has no promotion). A full cell (`Ava-Calcell-F`, `額滿`) is left out by its class (fix round 1), and a cell without a date link is not a departure either.
- **Departures, later**: the `D/M` dates of `tdp_confirm` and `tdp_hardpush` outside the month the calendar shows, with **no price of their own**. Year: the first date on or after the run's date (Hong Kong) with that day and month, dropped when that is more than 335 days ahead (fix round 1: the first version moved a date that had just passed a year on, `13/11` on 14 November becoming 13 November next year; the furthest real date in the saved listing is 321 days ahead); one that is not a real calendar date is dropped; the trailing `...` and any other text are ignored. A listed date in the shown month is never added (the calendar is the source for that month).
- **Gathering point**: only for `中國短線` (Guangdong) tours, by code suffix: `LW` → `深圳關口` (read as the Shenzhen border, kind `sz`, as other operators' border checkpoints are; the operator's text, `關口集散`, names no checkpoint), `MK` → `香港旺角`, `TO` → `香港將軍澳`, `YL` → `香港元朗` (all read as Hong Kong, kind `hk`). Start and end are the same (`集散`). Any other tour: none.
- **Nights**: none. No full marker is read.

**Dates without a price of their own, on the website.** They were already supported: `departures.price_hkd` may be null; the search counts such a date at the tour's stored from-price (`coalesce(d.price_hkd, t.from_price_hkd)`) for the window price, the price filter and sorting; the date list shows that price followed by 起, and a chain leg on such a date shows it with 起 and makes the chain total 起. The one change: normaliseTour's from-price, which is the stored price those dates are shown at, now also counts the operator's own "from" price whenever an upcoming departure has no price of its own (the lower wins). Without it, a Sunflower tour whose listing "from" price is below every price of the shown month (BTTK09SP: 10,899 against 11,399; LTZB08SP: 3,899 against 4,599) would show its later dates above the price the operator states.

**What the fixture pages verified or contradicted** (3 new booking pages, 2026-11-14 14:06 UTC, task 31 requests #13–#15 in the ledger; the listing and the KKFE05WR and CFAG03MK pages were reused from the investigation):

- **A full marker exists.** LTZB08SP's 17 November is `td.Calcell.Ava-Calcell-F` with the text `額滿` (full), `onclick=""` and a price. It has no date link; the parser leaves it out by its class as well (fix round 1). The same date is in the listing's `tdp_confirm` (`17/11`): a full date can stay in the listing lists, so a later-month date the listing names may be full (it cannot be checked within the rules).
- **The first month with departures** is shown on all five pages (KKFE05WR December, CFAG03MK, LTZB08SP and BTTK09SP November, WTPJ05SD December).
- **Long-haul, China long-haul and Taiwan pages** use the same layout (`#Content_lbtnday`, the same calendar table and cell classes). WTPJ05SD shows some prices as `<p class="dollarsign">$</p>2,999+` instead of `$2,999起`.
- **The listing's "from" price is not always in the first month**: its base date (`費用根據…的成人佔半房價格而定`) was 2 December (KKFE05WR), 22 November (CFAG03MK), 26 December (LTZB08SP), 10 February 2027 (BTTK09SP) and 16 December (WTPJ05SD).
- **Dates with no status** are in neither listing list (BTTK09SP's 27 November), as the investigation said.
- **Does `subarea` name cities?** Mostly, but not for Guangdong: 99 of the 103 `中國短線` tours have the same `廣州、中山、深圳` (the other 4 are Macau), whatever the tour visits (CFAG03MK goes to 韶關). So those tours read their route from the title (owner decision, fix round 1; see Route above and "Fix round 1" below). Elsewhere it names cities (`釜山、慶州`, `昆明、大理、麗江、香格里拉`), a province or region (`江原道`, `貴州`), a sub-region (`北疆`, `川西`) or a multi-country area (`西歐`, `北歐`, `中亞細亞`).

**Places, over all 370 tours** (the listing's `area`/`subarea`, offline, places/data.json as of 2026-11-14, gathering points applied): **245 with at least one city stop, 59 with region-only stops, 66 with no stops** (`no-stops`). 297 routes come from the subarea, 7 from the area fallback. The no-stops tours: 西歐 13, 長江三峽 12, 北歐 7, 中亞細亞 6, 巴爾幹半島 4, 澳洲 4 (a country), 西葡 3, 環島遊 3 (Taiwan), 東歐 2, 新西蘭 2 (a country), single Korean places (華川, 永宗島, 全州, 楊平, 內藏山, 昆池岩), 北非, 西澳州, 馬來西亞. Unmatched names (tours; a no-stops tour reports its subarea names, countries included): 西歐 13, 長江三峽 12, 山西 7, 北歐 7, 中亞細亞 6, 澳洲 4, 巴爾幹半島 4, 東營 3, 中原古都 3, 環島遊 3, 西葡 3, 尼山 2, 鳳凰 2, 川西 2, 彌勒 2, 普者黑 2, 北疆 2, 新西蘭 2, 東歐 2, 北非 2, and 20 names once (金華, 泰山, 冠豸山, 泰寧, 石林, 蒙自, 怒江, 華川, 永宗島, 青松, 濟扶島, 全州, 楊平, 內藏山, 對馬島, 昆池岩, 陸龍灣, 馬來西亞, 西澳州, 地中海). No place was added: none is a clear, frequent city (東營 is a city, on 3 tours each of which has other cities; 鳳凰 as an alias would match inside 鳳凰城, Phoenix).

Fixtures (`packages/scraper/src/operators/sunflower/fixtures/`), each a `<name>.page.json` (the run's date, the trimmed listing entry and the trimmed booking page, as fetchPage joins them) with `<name>.expected.json` (`verifiedByOwner: false`, notes on every judgment call):

| Fixture | Tour | Why |
|---|---|---|
| `air-korea` | KKFE05WR, Busan 5 days | All three status classes, holiday cells, every listed date in the shown month |
| `coach-mongkok` | CFAG03MK, Shaoguan 3 days (Mong Kok pick-up) | Gathering point `MK`, the route from the title (韶關), one later date |
| `china-long-haul` | LTZB08SP, Shandong 8 days | The `額滿` cell, `‧` in the subarea, eight later dates, the "from" price below the shown month |
| `long-haul` | BTTK09SP, Turkey 9 days | One date in the shown month, later dates into 2027, the "from" price below the shown month |
| `taiwan` | WTPJ05SD, Taipei 5 days | `$2,999+` prices, a later date across the year end |
| `listing` | the listing, cut to 8 entries | Discovery: the five tours and one entry without a booking code from each of 郵輪, 包團, 香港 |

## Not verified

- Whether the booking page always shows the first month that has departures (five samples now: all did).
- How a full or closed date appears: **seen in task 31** (LTZB08SP 17 November: `Ava-Calcell-F`, `額滿`, no date link; the parser leaves it out). Whether a full date in a later month is still in the listing's lists: likely (17/11 was), not checked.
- Whether `尚餘名額` reaches `0` or disappears when a group is full.
- Whether the `tdp_*` lists always hold the earliest 6 dates of each status (true for `KKFE05WR` in December).
- Whether the code's 5th–6th characters always equal the days (two samples, and the counts look plausible).
- The deposit and cancellation tables at the top of the terms PDF's page 1 were read only at the lower resolution.
- The privacy policy, and whether any other terms exist on other Sunflower sites.
- Whether cruises use the same booking page layout (cruises have no booking code, so they are not tours here). Long-haul (BTTK09SP), China long-haul (LTZB08SP) and Taiwan (WTPJ05SD) pages do.
- Whether `subarea` names the tour's cities: not for Guangdong (`廣州、中山、深圳` on 99 of 103, so those tours read the title); mostly elsewhere (see "Scraper and fixtures").
- Whether a Guangdong title's places are the tour's stops: read by hand for all 103 (see "Fix round 1"), not against the itineraries, which are PDFs robots.txt disallows.
- The `http://` robots.txt was not requested (see robots.txt above). It is the same host, so it is expected to be the same file.
