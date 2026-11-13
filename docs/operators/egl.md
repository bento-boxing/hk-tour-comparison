OWNER DECISION PENDING

# EGL Tours 東瀛遊 (`egl`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`); pages fetched 2026-11-12 22:13–22:31 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **10 of 10** in Task 14, plus **1** in Task 14b (the terms page, allowed by the owner on 2026-11-12).

## Recommendation

**HOLD: the terms could not be read within the rules.** The terms page holds no terms text. It is a list of ten booking-terms PDF documents, which are outside the one extra fetch the owner allowed. So it is still not known whether EGL's terms prohibit automated access or reproduction, and the PROCEED/HOLD test cannot be applied.

- The footer link `條款及細則` goes to `https://www.egltours.com/website/html/content.html?page=terms_and_conditions`, which is an empty shell. Its script (`includeHTML(page)` in `/website/html/header/assets/js/w3include.js`) loads the real content from `page + ".html?v=" + <start of the hour>`, that is `https://www.egltours.com/website/html/terms_and_conditions.html`.
- **Task 14b fetched that page once** (owner decision of 2026-11-12, one extra fetch). It is titled `EGL 報名條款及細則` and contains only a heading and a table of ten links to PDF files (listed under "Terms" below). It loads nothing else: there is no script, include or frame. **The page itself has no clause of any kind**: nothing about automated access, robots, scraping, crawling, copying, reproduction or permitted use of content.
- The terms themselves are in the ten linked PDFs. They are separate documents, not text the page loads, and there are ten of them, so the brief's allowance (the page, plus at most one URL it loads its text from) does not cover them. **None was fetched**, as the brief requires ("If the text needs anything else, stop and record that"). Whether they contain a relevant clause is unknown. By their titles (`報名細則及責任問題`, "registration terms and liability"), they are booking terms like Jetour's, which had no such clause, but that is a guess, not a finding.
- **Test result:** neither "no prohibiting clause" nor "personal, non-commercial use only" can be established while the terms documents are unread, so the first line stays `OWNER DECISION PENDING`.
- **To decide:** the owner can read the PDFs directly, or allow up to ten more fetches of `https://www.egltours.com/pdf_src/terms/…`. robots.txt does not disallow `/pdf_src/terms/`; only `/pdf_src/visa/` and `/pdf_src/tour/tourpdf/` are disallowed. The four tour documents matter most: `tour/japan_tour_terms.pdf`, `tour/tour_disclaimer.pdf`, `tour/localtour_disclaimer.pdf` and `tour/cruise_disclaimer.pdf`. The PDFs would need text extraction before they can be quoted.
- Everything else needed is reachable within robots.txt (see below).
- The served tour page HTML has no copyright or rights notice (`©`, `&copy;`, `版權`, `Copyright` and `All rights` do not occur in `/website/itinerary/HTGSZK02`); its only terms link is `條款及細則`.
- Context, from robots.txt (not terms): EGL names AI crawlers explicitly. Our User-Agent is not among them and falls under `User-agent: *`:

  ```
  # Added 2026 - AI crawlers
  # Search / referral bots allowed (they cite egltours.com and send traffic)
  ...
  # Bulk training crawlers blocked (no referral traffic)
  User-agent: GPTBot
  Disallow: /
  ```

## Terms (`https://www.egltours.com/website/html/terms_and_conditions.html`, read 2026-11-13)

The page's whole visible text (apart from its inline CSS) is this heading and these ten links, verbatim:

```
EGL 報名條款及細則
日本旅行團細則責任條款                              → https://www.egltours.com/pdf_src/terms/tour/japan_tour_terms.pdf
旅行團報名細則及責任問題                            → https://www.egltours.com/pdf_src/terms/tour/tour_disclaimer.pdf
自由行細則及責任問題                                → https://www.egltours.com/pdf_src/terms/fit/fit_disclaimer.pdf
門票細則及責任問題 (門券車票、自駕遊及一天遊)       → https://www.egltours.com/pdf_src/terms/fit/fit_ticket_disclaimer.pdf
當地遊報名細則及責任問題                            → https://www.egltours.com/pdf_src/terms/tour/localtour_disclaimer.pdf
機票細則及責任問題                                  → https://www.egltours.com/pdf_src/terms/fit/fit_flight_disclaimer.pdf
酒店細則及責任問題                                  → https://www.egltours.com/pdf_src/terms/fit/fit_hotel_disclaimer.pdf
郵輪假期 (旅行團)報名細則及責任問題                 → https://www.egltours.com/pdf_src/terms/tour/cruise_disclaimer.pdf
郵輪假期 (自由行)細則及責任問題                     → https://www.egltours.com/pdf_src/terms/fit/fit_cruise_disclaimer.pdf
代辦個人簽證細則責任條款                            → https://www.egltours.com/pdf_src/terms/tour/visa-terms.pdf
```

Clauses about automated access, robots, scraping, crawling, copying, reproduction or permitted use of content in this text: **none** (the page has no clauses at all). The PDFs were not read.

## robots.txt (`https://www.egltours.com/robots.txt`, read 2026-11-13)

The complete `User-agent: *` group, verbatim from the saved file (lines 1–41 of 83; the group runs until the next `User-agent` line, and the comments inside it are part of the file):

```
User-agent: *
Disallow: /cas-b2c/
Disallow: /cas-protect-url/
Disallow: /cas5-b2c/
Disallow: /egltours/MecmsRs.do
Disallow: /egltours/showAfterSalesForm.do
Disallow: /egltours/showFitTeaPartyLogin.do
Disallow: /itour/
Disallow: /tour/fitPaxInfo
Disallow: /tour/questionnaire/
Disallow: /tour/showPaymentForm.action
Disallow: /tour/tourPaxInfo
Disallow: /travel/pages/tour_view/
Disallow: /travel/saveCallcenter
Disallow: /travel/travel/mice/mail.jsp
Disallow: /travel/travel/swt/mail.jsp
Disallow: /travel/travel/swt/swt_contactus.jsp
Disallow: /travel/travel/yep/mail.jsp
Disallow: /travel/pdf/
Disallow: /pdf_src/visa/
Disallow: /pdf_src/tour/tourpdf/
Disallow: /EGLTBS/

# Comment SEO-addon at 2024 suggest by agency
Disallow: /local-travel/search/*
Disallow: /trip-packages/flight?scopes=*
Disallow: /trip-packages/hotel?scope=*
Disallow: /trip-packages/related_packages/*

# Comment SEO-addon at 2024
Disallow: /website/search-result/*
Disallow: /website/location-search-result/*
Disallow: /website/search-result-cruise/*

# Create Payment Request to Payment Gateway
Disallow: /nfit-cart-b2c-web/
Disallow: /cart-tbs/
Disallow: /cart-guru/

# Added 2026 - member / online service pages, no SEO value
Disallow: /tour/indexOnline3in1
```

The rest of the file is the AI-crawler groups quoted above (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User` and `PerplexityBot` allowed; `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider` and `meta-externalagent` disallowed from `/`) and `Sitemap: https://www.egltours.com/sitemap.xml`. Our User-Agent `tour-comparison-bot/0.1` matches none of the named groups, so only the `User-agent: *` group applies to it.

No rule in that group matches `/website/itinerary/` or `/api/` (no `Disallow` line begins with either, and no wildcard rule can match them), so **`/website/itinerary/<CODE>` and `/api/v1/tours/<CODE>/dates` are allowed.** No Crawl-delay.

## Tour pages in the sitemap

- `https://www.egltours.com/sitemap.xml` is one `urlset` (no index) with 1,232 URLs.
- Tour pages: **`/website/itinerary/<CODE>` (573)** and `/website/itinerary-premier/<CODE>` (2): **575** in all. Everything else (`/website/tour-location/…` 542, `/website/tour-line/…`, `/promo/…`, `/local-travel/…`, `/blog/…`, `/website/company-info/…`) is not a tour page.
- Codes are 8 characters, e.g. `HTJSJG06`; the last two digits match the day count in the samples. Prefixes: `HT` 478, `MT` 95 (the sample `MTJ3TA06` flies from **Macau**), `HE` 2 (premier), `HF` 1.
- An inline script sends `/website/itinerary/hc…` to `/website/cruise`; no `hc` codes were in the sitemap.

## Where each fact comes from

The tour page HTML has everything except the full list of departure dates and the per-date prices. Those come from one separate JSON request per tour (below), which robots.txt allows.

| Fact | Where | Selector / JSON path |
|---|---|---|
| Tour code | page | `.block-item--daily-itinerary-calendar-picker[data-tour-code]`; also `<script type="application/json">` with `product_code`, visible `團號：HTJSJG06`, and the URL |
| Title | page | first `<script type="application/ld+json">` (Product) → `name` (has `\uXXXX` escapes; JSON.parse handles them) |
| Days | page | hero `<p>` that contains `.block-item--itinerary-hero-price`: text `6天．` (note the full-width `．`); also the highest `dayNumber` in the day plans |
| Nights | not stated | No nights field. Titles sometimes mention hotel nights (`2晚北湯澤…`), which are not the tour's nights. |
| Day headings | page | `.block-item--daily-itinerary-plan-accordion[data-daily-itinerary-plans-json]` → JSON array; each item has `dayNumber`, `title` (may be `""`, as in `MTJ3TA06`) and `journeyTextRows[][].location` (the day's stops, e.g. `香港`, `直航札幌`, `拉麵橫丁`) |
| Start / end point | page | the transport block after the heading `出發交通資料` / `回程交通資料`: the first `p.egl-h5` is the origin (`香港`, `澳門`, `深圳羅湖口岸(地面)門前廣場(EGL旗號集合)`). Day 1's first `journeyTextRows` location is the same place. |
| "From" price | page | JSON-LD `offers.price` (a **string**, e.g. `"16899"`), `priceCurrency` `HKD`. The visible hero price `<span>` is empty in the HTML (filled by script). Also `data.sellingPrice` in the dates JSON. |
| Departure dates | **separate request** | `GET https://www.egltours.com/api/v1/tours/<CODE>/dates?currencyCode=HKD` → `data.dates[].departureDate` (ISO `YYYY-MM-DD`) |
| Per-date price | separate request | same JSON → `data.dates[].sellingPrice` (integer HKD; differs per date, e.g. 17999 / 17599 / 19199 / 16899) |
| Full / closed | separate request | same JSON → `data.dates[].isFull` (boolean). Also `isGuarantee` (成團), `isLessAvailableSeats` (few seats), `isOffline`, `tourPlanCodes` (e.g. `HTJSJG06-261227HB`), `carrierCodes`. No `isFull: true` date was seen in the three samples. |

**Where the dates request comes from.** The raw HTML shows the dates only as a heading line without a year (`出發日期： 12月21、22、24、27日`). The page's calendar (`ItineraryCalendarPicker` in `/assets/client/assets/website-BI98BOXS.js`, a hashed name that will change) calls `getAvailableDates(code, "HKD")` = `GET /api/v1/tours/${code}/dates?currencyCode=HKD` (a relative path; requesting it on `www.egltours.com` returned the data). It was fetched three times through `createFetcher`: HTTP 200, plain JSON, no login, cookie or token. It is **not** disallowed (robots.txt has no `/api/` rule). The bundle also shows `GET /api/v1/tours/${code}/tour-plans?selectedDate=…&reservedSeats=2&currencyCode=HKD` (per-date package detail), which was not needed and not fetched. `/itour/api/v1` exists in the bundle and **is** disallowed (`/itour/`); it is not needed.

Sample response (abridged):

```json
{"isSuccess":true,"data":{"productCode":"HTJSJG06","currency":"HKD","sellingPrice":16899,"dates":[
 {"tourPlanCodes":["HTJSJG06-261221"],"departureDate":"2026-12-21","isGuarantee":true,"isLessAvailableSeats":false,
  "isOffline":false,"isFull":false,"sellingPrice":17999,"carrierCodes":["HX"]}, …]}}
```

## Gathering / departure point text (exact)

- `HTGSZK02` (2-day Zhongshan): transport summary `深圳集散`; `深圳羅湖口岸(地面)門前廣場(EGL旗號集合)`; `12:30 集合 / 12:45 出發 (逾時不侯)`; `中途站 : 深圳灣口岸站地鐵C出口(EGL旗號集合)`; `深圳灣口岸站地鐵 C出口(EGL旗號集合)`; `13:30 集合/13:45出發<逾時不侯>`; return `深圳灣口岸 及 羅湖口岸 (解散)`; note `集合及解散地點: 【 深圳羅湖口岸 / 深圳灣口岸 】`; day 2 stops end `深圳灣口岸 及 深圳羅湖口岸(解散)`.
- `HTJSJG06` (Hokkaido): `乘坐香港航空或大灣區航空公司直航往返(日本時間快香港1小時)`; origin `香港` `上午08:30至09:10左右起飛`; day 1 stops `香港` › `直航札幌` › `拉麵橫丁`.
- `MTJ3TA06` (Tokyo, from Macau): `乘搭澳門航空往返(日本時間快澳門1小時)`; origin `澳門` `上午09:30左右起飛`; day 1 stops `澳門` › `東京成田機場`; `※ 不設延期返澳服務。`
- No page used the words `集合地點` or `出發地點` as a label.

## Number and date formats

- Prices: ASCII digits everywhere they are needed (JSON-LD string `"16899"`, JSON integers). Prose has `HK$1500`, `$4,000`, `HKD500`. One full-width digit seen, in prose only (`７.` in a numbered note on `HTGSZK02`).
- Dates: the HTML heading has **no year** and lists several months in one line (`11月21、27、28、12月4、5、11、12、18、19、25、26日`); the JSON has ISO dates. Use the JSON.
- Days: `6天．` with a full-width full stop `．` (U+FF0E).

## Fixtures (`packages/scraper/src/operators/egl/fixtures/`)

These fixtures are held outside the repository until the owner decides on this operator; they are committed to this path only if it is approved.

**Before they are committed** (controller ruling, 2026-11-12): the day-plan JSON in `data-daily-itinerary-plans-json` must not carry day prose. The values of `description` (up to 102 characters in the held copies) and `accomodation` (up to 120) must be cut to their first 20 characters plus `…`, and so must any other key holding free text rather than a heading, place, meal label or date (`lunch` and `dinner` reach 70 characters and should be looked at then). This is to be done by a tested `trimFixture` option, not by hand, and the option used is to be recorded here. `title` and `location` stay whole. The option has not been written yet, because EGL is not approved.

Saved with `pnpm --filter @hktours/scraper fixture --from <saved page> <output>` (trimmed by `trimFixture`), with **no `--keep` selector**. EGL's day headings are not element text: the accordion element `.block-item--daily-itinerary-plan-accordion` is empty in the HTML, and the headings (`title`, `journeyTextRows[][].location`) live only in its `data-daily-itinerary-plans-json` attribute, where strings are cut only above 120 characters. The longest heading string in the three samples is 30 characters, so none is cut (checked: 61 heading strings, 0 ending in `…`). A `--keep` selector would not change them, because it applies to element text and to page-data strings that repeat a kept element's text. If a longer heading appears, the keep mechanism would need to cover that attribute, which it does not today. Regenerate with:

```
pnpm --filter @hktours/scraper fixture --from <saved itinerary page> <output>
```

The date JSON files are the raw API responses, copied unchanged: they hold only codes, dates, prices and flags.

| File | Source | Why |
|---|---|---|
| `multi-city.html` + `multi-city.dates.json` | `/website/itinerary/HTJSJG06` | 6 days, Sapporo / Noboribetsu / Otaru / Kitahiroshima; 4 dates with 4 different prices; `isLessAvailableSeats` on two |
| `simple.html` + `simple.dates.json` | `/website/itinerary/HTGSZK02` | 2 days, one place (中山); gathers in Shenzhen; 11 dates, two at a higher price |
| `edge.html` + `edge.dates.json` | `/website/itinerary/MTJ3TA06` | **Starts in Macau** (Air Macau); every day `title` is empty, only stops are given |

Checked by eye: no personal data (only the company's published hotlines). No hand trimming was needed. Long day descriptions inside the day-plan JSON attribute are cut by `trimFixture` (strings over 120 characters); image URLs (not images) remain in that JSON.

## Every URL fetched (Task 14: 10 page fetches; Task 14b: 1; robots.txt not counted)

### Task 14

| # | UTC | URL | Result |
|---|---|---|---|
| – | 22:13:20 | https://www.egltours.com/robots.txt | 200 |
| 1 | 22:13:54 | https://www.egltours.com/sitemap.xml | 200 |
| 2 | 22:16:11 | https://www.egltours.com/website/itinerary/HTJSJG06 | 200 |
| 3 | 22:18:37 | https://www.egltours.com/assets/client/assets/website-BI98BOXS.js | 200 (to find the dates request) |
| 4 | 22:20:45 | https://www.egltours.com/api/v1/tours/HTJSJG06/dates?currencyCode=HKD | 200 JSON |
| 5 | 22:29:37 | https://www.egltours.com/website/html/content.html?page=terms_and_conditions | 200 (empty shell) |
| 6 | 22:29:41 | https://www.egltours.com/website/itinerary/HTGSZK02 | 200 |
| 7 | 22:29:45 | https://www.egltours.com/api/v1/tours/HTGSZK02/dates?currencyCode=HKD | 200 JSON |
| 8 | 22:29:49 | https://www.egltours.com/website/itinerary/MTJ3TA06 | 200 |
| 9 | 22:29:53 | https://www.egltours.com/api/v1/tours/MTJ3TA06/dates?currencyCode=HKD | 200 JSON |
| 10 | 22:31:03 | https://www.egltours.com/website/html/header/assets/js/w3include.js | 200 (to find the terms text URL) |

### Task 14b (1 page fetch; owner allowed one, plus at most one URL the page loads its text from)

| # | UTC | URL | Result |
|---|---|---|---|
| – | – | https://www.egltours.com/robots.txt | **not requested again**: `createFetcher` was given the copy saved in Task 14 (read 22:13:20 UTC, under 2 hours earlier; RFC 9309 allows caching for up to 24 hours), so no URL was requested twice |
| 11 | 2026-11-13 00:01:05 | https://www.egltours.com/website/html/terms_and_conditions.html | 200, 4,514 characters (heading and ten PDF links; no clause text). Requested without the `?v=<hour>` cache-busting query the site's script adds. |

The optional second fetch was not used: the page loads no text from another URL. Not fetched: the ten PDFs (outside the allowance).
