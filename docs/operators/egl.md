APPROVED 2026-11-13: controller applying the owner's stated rule (ten terms PDFs read, no prohibiting clause; robots.txt obeyed)

# EGL Tours 東瀛遊 (`egl`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`); pages fetched 2026-11-12 22:13–22:31 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **10 of 10** in Task 14, plus **1** in Task 14b (the terms page, allowed by the owner on 2026-11-12), plus **10** on 2026-11-13 (the ten terms PDFs, allowed by the owner that day; fetched 08:32 UTC with `fetchBytes`).

## Recommendation

**PROCEED under the owner's delegated rule.** All ten terms documents were fetched and read on 2026-11-13. None has a clause about automated access, robots, crawling, scraping, copying, reproduction, intellectual property, or permitted use of the website or its content, and none limits use to personal or non-commercial use. They are booking, payment, cancellation, liability and privacy terms for customers. robots.txt allows every URL needed, and the tour page checked for one (`HTGSZK02`) has no copyright or rights notice (see below).

- **Test result:** "no clause restricting automated access or reuse of content". Details per document under "Terms documents (PDFs)" below.
- The documents mention EGL's website only as a place to book and pay, to find the privacy policy (`本公司的個人資料(私隱)政策聲明詳載於本公司之網頁內。`, "our personal data (privacy) policy statement is set out on our website"), to check meeting times, and in notes on prices. Three documents have a note on the prices listed on the website: in two they hold only at the moment of booking, e.g. `fit_flight_disclaimer.pdf`: `本公司網站內所列出的預訂機票價格，只為即時之訂購價格` ("the air ticket prices listed on our website are only the prices for booking at that moment"); in the hotel terms they are set for guests from outside the hotel's country or region. These are about the prices, not about using the content.
- Not read: the privacy policy on the website (not fetched; a privacy policy is not expected to restrict site use, but it was not checked). No website terms of use other than `條款及細則` were looked for; the tour page's only terms link is `條款及細則`.
- The footer link `條款及細則` goes to `https://www.egltours.com/website/html/content.html?page=terms_and_conditions`, which is an empty shell. Its script (`includeHTML(page)` in `/website/html/header/assets/js/w3include.js`) loads the real content from `page + ".html?v=" + <start of the hour>`, that is `https://www.egltours.com/website/html/terms_and_conditions.html`.
- **Task 14b fetched that page once** (owner decision of 2026-11-12, one extra fetch). It is titled `EGL 報名條款及細則` and contains only a heading and a table of ten links to PDF files (listed under "Terms" below). It loads nothing else: there is no script, include or frame. **The page itself has no clause of any kind**: nothing about automated access, robots, scraping, crawling, copying, reproduction or permitted use of content.
- The terms themselves are in the ten linked PDFs. They are separate documents, not text the page loads, so Task 14b's allowance did not cover them and it fetched none. **The owner allowed fetching all ten on 2026-11-13; each was fetched once** (robots.txt does not disallow `/pdf_src/terms/`; only `/pdf_src/visa/` and `/pdf_src/tour/tourpdf/` are disallowed), and their text was extracted with `pdftotext`. Every page of every PDF has a text layer; none is a scanned image. Results under "Terms documents (PDFs)" below.
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

Clauses about automated access, robots, scraping, crawling, copying, reproduction or permitted use of content in this text: **none** (the page has no clauses at all). The PDFs are covered in the next section.

## Terms documents (PDFs), read 2026-11-13

All ten were fetched once each on 2026-11-13 (08:32:02–08:32:38 UTC, all HTTP 200, `application/pdf`) and read the same day. Text was extracted with `pdftotext` (layout and plain modes). **Every page of every document has a text layer** (at least 845 non-space characters per page); the only images are one or two small pictures per document, all about 1–1.5 in wide and of the same shape (two were viewed: both the EGL logo). Eight say they exist only in Chinese and the Chinese version prevails (e.g. `本細則責任條款只備有中文版本，㇐概以中文版本為準`); `fit_flight_disclaimer.pdf` says the same with `中文譯版`, and `localtour_disclaimer.pdf` does not say. No English version is linked.

How they were checked: the extracted text of each, with whitespace removed (so words split across lines or columns still match), was searched for `版權`, `知識`, `產權`, `複製`, `轉載`, `翻印`, `抄`, `擷取`, `下載`, `商業`, `商用`, `個人用途`, `自動化`, `爬`, `機械人`, `機器人`, `程式`, `軟件`, `robot`, `crawl`, `scrap`, `spider`, `copyright`, `reproduc`, `網站`, `網頁`, `商標`, `版面`, `圖像`, `使用本`, `瀏覽`, `侵`, and every `不得`, `禁止`, `嚴禁`, `不可`, `未經`, `保留…權`, `擁有` and `資料` was looked at in context. Each document's section headings were listed as well. Every hit was about booking, payment, documents, liability, personal data, or a reference for customers (government, Travel Industry Authority, attraction or JR Pass pages). The documents were not read line by line in full.

| # | Document (title in the PDF) | URL | Read | Pages | Text layer | Clauses about automated access, robots, crawling, scraping, copying, reproduction, IP or permitted use of the website or its content |
|---|---|---|---|---|---|---|
| 1 | `日本旅行團 - 細則責任條款` | https://www.egltours.com/pdf_src/terms/tour/japan_tour_terms.pdf | 2026-11-13 | 2 | yes | none |
| 2 | `旅行團 - 細則責任條款` | https://www.egltours.com/pdf_src/terms/tour/tour_disclaimer.pdf | 2026-11-13 | 2 | yes | none |
| 3 | `自由行 細則責任條款` | https://www.egltours.com/pdf_src/terms/fit/fit_disclaimer.pdf | 2026-11-13 | 3 | yes | none (price note only, see Recommendation) |
| 4 | `細則責任條款` (listed as `門票細則及責任問題`) | https://www.egltours.com/pdf_src/terms/fit/fit_ticket_disclaimer.pdf | 2026-11-13 | 2 | yes | none |
| 5 | `當地遊 細則責任條款` | https://www.egltours.com/pdf_src/terms/tour/localtour_disclaimer.pdf | 2026-11-13 | 2 | yes | none |
| 6 | `機票/簽證 細則責任條款` | https://www.egltours.com/pdf_src/terms/fit/fit_flight_disclaimer.pdf | 2026-11-13 | 2 | yes | none (price note only, see Recommendation) |
| 7 | `酒店 細則責任條款` | https://www.egltours.com/pdf_src/terms/fit/fit_hotel_disclaimer.pdf | 2026-11-13 | 2 | yes | none (price note only, see Recommendation) |
| 8 | `郵輪旅行團 - 細則責任條款` | https://www.egltours.com/pdf_src/terms/tour/cruise_disclaimer.pdf | 2026-11-13 | 2 | yes | none |
| 9 | `郵輪套票(自由行) - 細則責任條款` | https://www.egltours.com/pdf_src/terms/fit/fit_cruise_disclaimer.pdf | 2026-11-13 | 2 | yes | none |
| 10 | `代辦個人簽證-細則責任條款` | https://www.egltours.com/pdf_src/terms/tour/visa-terms.pdf | 2026-11-13 | 1 | yes | none |

The PDFs and their extracted text are kept outside the repository (git-ignored), with no copy in the repository.

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

Committed after the owner's approval (2026-11-13). The copies held outside the repository (`.superpowers/held-fixtures/egl/fixtures/`, trimmed with the earlier `--keep`-free mode) were re-trimmed in **allow-list mode** (`trimFixture`'s `allow` option), the standard the Jetour and Travel Expert fixtures were brought to: only the text `parse.ts` reads is kept, and every other text node, JSON string and text-carrying attribute is emptied. This replaces the 2026-11-12 ruling's cut of `description`, `accomodation`, `lunch` and `dinner` to 20 characters: those values are now empty. Trimming the untrimmed saved pages (under `.superpowers/raw-pages/egl/`, outside git: `itin-HTJSJG06.html` → `multi-city.html`, `itin-HTGSZK02.html` → `simple.html`, `itin-MTJ3TA06.html` → `edge.html`) with the same command gives the same text and structure; the files differ only in whitespace (blank lines, and runs of spaces inside some `class` attributes). To regenerate:

```
LD='script[type="application/ld+json"]'
PLANS='.block-item--daily-itinerary-plan-accordion'
pnpm --filter @hktours/scraper fixture \
  --allow 'p:has(> .block-item--itinerary-hero-price)' \
  --allow '[data-hiifly-fill-tile] > p' \
  --allow '[data-hiifly-fill-tile] + * p.egl-h5' \
  --allow-key-in "$LD" '@type' --allow-key-in "$LD" name --allow-key-in "$LD" price \
  --allow-key-in "$PLANS" title --allow-key-in "$PLANS" location \
  --from <saved itinerary page> <output>
```

The allow-list, one line per thing `parse.ts` reads: the hero line with the day count (`6天．`), the two transport headings (`出發交通資料`, `回程交通資料`) and the places of the blocks after them (`p.egl-h5`, for the start and end points); in the JSON-LD `@type` (to find the `Product`), `name` (title) and `price` (the "from" price); in the day-plan JSON attribute `title` and `location` (the day's stops). The tour code is in the `data-tour-code` attribute, which holds no Chinese text and is kept as it is; `dayNumber` and the other numbers and booleans are always kept. `--allow-key-in` (added for EGL) limits a key to the JSON of the elements its selector matches: the page also uses `title` and `name` for gallery captions, image names and the navigation settings, which the parser does not read and which are emptied. The heading strings are cut only above 300 characters (`KEEP_TEXT_LIMIT`); the longest is 30.

The date JSON files are the raw API responses, copied unchanged: they hold only codes, dates, prices and flags.

| File | Source | Why |
|---|---|---|
| `multi-city.html` + `multi-city.dates.json` | `/website/itinerary/HTJSJG06` | 6 days, Sapporo / Noboribetsu / Otaru / Kitahiroshima; 4 dates with 4 different prices; `isLessAvailableSeats` on two |
| `simple.html` + `simple.dates.json` | `/website/itinerary/HTGSZK02` | 2 days, one place (中山); gathers in Shenzhen; 11 dates, two at a higher price |
| `edge.html` + `edge.dates.json` | `/website/itinerary/MTJ3TA06` | **Starts in Macau** (Air Macau); every day `title` is empty, only stops are given |

Checked after trimming (2026-11-13): the only Chinese text left is the hero line, the transport headings and places, the JSON-LD title and brand name (`東瀛遊 EGL Tours`), the day titles and stops, and twelve UI labels that are JSON keys (not values) of the page's translations script, such as `客戶意見表` (the longest is 14 characters). No run of 25 or more Chinese characters and punctuation; no images, styles, code scripts or inline event handlers; no personal data; LF line endings. No image URLs remain: every `url` value in the JSON is emptied. No hand trimming was needed.

## Every URL fetched (Task 14: 10 page fetches; Task 14b: 1; terms PDFs: 10; robots.txt not counted)

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

The optional second fetch was not used: the page loads no text from another URL. Not fetched in Task 14b: the ten PDFs (outside that allowance; fetched later, below).

### Terms PDFs (10 fetches; owner allowed all ten on 2026-11-13)

Fetched with `createFetcher(...).fetchBytes` (same robots.txt check, queue, 3 s spacing and User-Agent as `fetchText`), once each, in the order of the terms page. No retry was needed.

| # | UTC | URL | Result |
|---|---|---|---|
| – | – | https://www.egltours.com/robots.txt | **not requested again**: the fetcher was given the copy saved in Task 14 (read 2026-11-12 22:13:20 UTC, about 10 h 19 min before the first PDF; within RFC 9309's 24 hours). It does not disallow `/pdf_src/terms/`. |
| 12 | 2026-11-13 08:32:02 | https://www.egltours.com/pdf_src/terms/tour/japan_tour_terms.pdf | 200, 836,519 bytes |
| 13 | 2026-11-13 08:32:09 | https://www.egltours.com/pdf_src/terms/tour/tour_disclaimer.pdf | 200, 1,052,166 bytes |
| 14 | 2026-11-13 08:32:13 | https://www.egltours.com/pdf_src/terms/fit/fit_disclaimer.pdf | 200, 818,058 bytes |
| 15 | 2026-11-13 08:32:16 | https://www.egltours.com/pdf_src/terms/fit/fit_ticket_disclaimer.pdf | 200, 571,725 bytes |
| 16 | 2026-11-13 08:32:20 | https://www.egltours.com/pdf_src/terms/tour/localtour_disclaimer.pdf | 200, 421,669 bytes |
| 17 | 2026-11-13 08:32:23 | https://www.egltours.com/pdf_src/terms/fit/fit_flight_disclaimer.pdf | 200, 711,406 bytes |
| 18 | 2026-11-13 08:32:27 | https://www.egltours.com/pdf_src/terms/fit/fit_hotel_disclaimer.pdf | 200, 627,845 bytes |
| 19 | 2026-11-13 08:32:30 | https://www.egltours.com/pdf_src/terms/tour/cruise_disclaimer.pdf | 200, 1,339,046 bytes |
| 20 | 2026-11-13 08:32:34 | https://www.egltours.com/pdf_src/terms/fit/fit_cruise_disclaimer.pdf | 200, 1,162,958 bytes |
| 21 | 2026-11-13 08:32:38 | https://www.egltours.com/pdf_src/terms/tour/visa-terms.pdf | 200, 585,395 bytes |

## Practice crawl (Task 19)

`pnpm scrape --operator egl --dry-run`, run once on **2026-11-13** UTC (2026-11-14 in Hong Kong), **21:22:11–22:36:44 UTC (74 min 33 s)**, through `createFetcher` (one fetcher, 3 s spacing; each tour is two requests, the page and its dates JSON, so at most 1,148 requests with the sitemap and robots.txt). No 403, 429, bot challenge, retry or unfetched page.

| | Count |
|---|---|
| Tour pages discovered (sitemap) | 573 |
| Tour pages fetched | 573 (0 not fetched) |
| Tours that would be saved | **495** |
| Skipped, no upcoming departures | 28 (not failures) |
| Parse failures | **50 (8.7%)**: 19 `no-stops`, 31 `parser returned null` |
| Run checks | ok |
| Distinct unmatched names | 2,455 |

**Timing for the nightly job:** 74.5 minutes for the whole crawl, inside the scrape job's 170-minute timeout.

The 19 `no-stops` pages were missing places, not parser faults: Okinawa (9 pages, `直航沖繩`), Bali (3), Brunei (3), Sri Lanka (2), Taoyuan (1), and one Shaoguan tour whose headings name only sights (`丹霞山風景區`).

## Places pass (Task 19 Step 6)

All from the printed unmatched names and the day headings each page line carries; no page was re-fetched. Commit `feat(core): places from EGL's practice crawl`.

- **New countries**, each with its `group`: Indonesia 印度尼西亞 (`southeast-asia`), Brunei 汶萊 (`southeast-asia`), Sri Lanka 斯里蘭卡 (`south-central-asia`), India 印度 (`south-central-asia`), Kyrgyzstan 吉爾吉斯 (`south-central-asia`), Qatar 卡塔爾 (`middle-east`). One region each, plus Korea's 忠清道 and 全羅道.
- **259 new cities.** The largest groups: Japan 61 (Hokkaido, Tohoku, Kanto, Chubu, Kansai, Chugoku, Shikoku and Kyushu towns that EGL's Japan tours name), mainland China 69, Taiwan 18, Europe 49, plus South and Southeast Asia, the Middle East, North Africa, Australia and New Zealand.
- **41 alternate spellings** on existing cities. Most are EGL's own spellings: `艾芙` (Edfu), `高安堡` (Kom Ombo), `洪加達` (Hurghada), `希爾克內斯` (Kirkenes), `洛士托` (Luosto), `杜邦力` (Dubrovnik), `巴塞隆那`, `卡薩布蘭卡`, `加柏都斯亞` (Cappadocia), `華倫丹` (Volendam), `巴杜華` (Budva) and so on. There are also variant characters: `凱裡`, simplified `长沙`, `鐮倉`, and the Kangxi-radical forms `⾹港`, `狄⾂港` and `⽠啦雪蘭莪`.
- **`直航沖繩`.** 沖繩 was in the list, but only as a **region**, and regions match only a whole heading token, never a name inside one. Only city names are found inside longer names. The fix is in the data, not the rule: 沖繩 is now also a city (Okinawa Island, aliases `沖縄`, `沖繩本島`), as 濟州 is for Jeju, so `直航沖繩` and `沖繩MAIN` find it. No matching rule was changed.
- **27 `notPlaces`**, for names that matched a place they are not:
  - on existing routes: `十和田湖` read as 和田 (Hotan); `復活節島巨石像` as Easter Island; `大理石` as 大理; `韓國版聖托里尼` as Santorini; `麥地那市集` (a medina) as Medina; `何維克大道` (Höheweg) as Vík; `拉珀斯維爾` as Perth; `華倫丹-北海小漁村` as 北海; `華沙戰船博物館` as Warsaw; and more;
  - guards for the new names: `伊勢丹`, `昭和新山`, `桃園機場`, `青井阿蘇`, `卡薩布蘭卡山谷` (a Chilean valley).
- **Estimate, offline** (the logged headings re-processed with the new data): every one of the 19 `no-stops` pages now has a route. Distinct unmatched names fall from 2,455 to 2,046, and what is left is sights, shops, activities and notes (`〔註1〕`, `珍珠養殖中心`, `📸大教堂`).
  - 334 of the 573 routes change, nearly all by gaining stops. The removals are the wrong cities listed above. Every other removal was checked by hand: either a longer name now wins (南投 → 杉林溪 in `南投．杉林溪生態渡假園`), or a repeat collapsed.
  - The Jetour and Travel Expert fixture tests pass unchanged.
- **Known limits, not changed:**
  - Overnight alternatives written `布里格/特施/夕昂/菲斯普` or `林茲/韋爾斯` give every alternative as a stop, as the shared rule does for any `/`.
  - Flight hubs named plainly (`杜拜/多哈`) appear on routes.
  - `〔註1〕` (full-width tortoise-shell brackets) is not dropped as a note.

## Pages the parser rejected (`parser returned null`, 31)

The log does not say why a page was rejected, so 8 of the 31 were fetched once each with their dates JSON (below, "Null-page probe"). They show four causes:

| Cause | Pages fetched | What it is | Done |
|---|---|---|---|
| **No dates on sale.** The dates API answers `{"productCode":"","currency":"",…,"status":"No Available Dates","dates":[]}`, with no code and no currency, so the check that the JSON is for this tour in HKD failed. | HTENBT12, HTCWGK07 | A real tour with nothing on sale | **Fixed.** That answer (empty code, empty currency and no dates) now reads as a tour with no departures, which the runner skips as `no-departures`. An answer without a code that does list dates is still rejected. |
| **A closing arrival day.** The plans run one day past the hero count (`5天．` with days 1–6). The extra day is a note such as `平安抵港，開心行程結束!*10月25日起回程航班，抵港日已踏入第6天*`, for a flight home that lands after midnight. It has no meal and no hotel. | HTKCEE05, HTKSMS05, HTLBAA06 (Bhutan) | A real tour wrongly rejected | **Fixed.** Exactly one day past the hero count, with no meal and no hotel, is dropped, and the hero count stands. A day with a meal or hotel, or two extra days, still disagree and are rejected. |
| **One plan list for two variants.** HTASCB08 (8 days) and HTASCB10 (10 days) share a list where day 8 is given twice, tagged `【ASCB08】` and `【ASCB10】`. | HTASCB08 | A real tour wrongly rejected | **Fixed.** When a day is tagged with this tour's code without its first two letters, days tagged with another code are dropped, as are untagged days past the hero count; the tag is removed. This also takes the 8-day variant's last day out of HTASCB10's headings. |
| **"Not found" page served with HTTP 200.** Title of the tour, body `404 找不到頁面` and `此旅行團已額滿，以下為您推薦其他精選熱門行程` (MTK3FF05) or `我們目前找不到您正在尋找的旅遊團` (HTJAMK06). No tour code, no day plans. | MTK3FF05, HTJAMK06 | Not a tour: the sitemap still lists a tour that is full or withdrawn | **Left rejected.** It still counts as a parse failure. No dates request is made for it. |

**Not fetched (23):** HTKPAA05, HTKSEE05, HTKCEA07, HTKSEA05, HTKSGB05, HTKPEA05, HTKSED05, HTKSGE05, HTKCFF05, HTKPMV05, HTKSMY05, HTKPMA05, HTKSMT05, HTKSMF05, HTKSMB05, MTK3MG05, MTK3EE05, HTJKME07, HTJKMA05, HTLBAB06, HTEWSW10, HTENFD09 and HTENFI09. Their cause is not known. By analogy with the pages fetched, the 15 Korean `HTK…` pages and HTLBAB06 are probably the arrival day, the `MTK3…` and `HTJK…` pages may be "not found" pages, and the three European pages may be "no dates". Their siblings did parse: 14 `HTK…` pages, for example, passed in the same crawl.

**Estimated parse-failure rate after these changes (estimate only, not re-crawled):**

| Pages | Before | After |
|---|---|---|
| `no-stops` | 19 | 0 (offline re-processing of the logged headings) |
| `parser returned null`, fetched | 8 | 2 (the "not found" pages) |
| `parser returned null`, not fetched | 23 | between 0 and 23 (about 4 if the analogies above hold) |
| **Rate** | **8.7%** | **0.3% to 4.4%, about 1%** |

- **Tours that would be saved:** at least 499, which is 495 plus the 4 fetched pages that now parse and have dates. More would be saved if the 19 former `no-stops` pages and the unfetched arrival-day pages have dates on sale. That is not known: the log does not record their dates. Since `f045ac1`, a page with no dates is skipped as `no-departures` before its stops are looked at.

## First-run floor

`minExpectedTours: 165`: a third of the 495 tours that would have been saved in the practice crawl of 2026-11-13. It replaces the provisional 190, which was based on pages listed. A first real run that saves fewer than 165 tours fails `below-minimum`, and nothing is saved. EGL is in the nightly matrix from commit `ci: egl joins the nightly matrix`.

## Null-page probe (8 page fetches, each with its dates request)

One run of a throwaway script through `createFetcher` (same proxy setup as the CLI, User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s spacing), capped at 16 requests including robots.txt. **15 requests**, all HTTP 200. No refusal, retry or challenge. The pages without a tour code got no dates request. Bodies and the ledger are kept outside git under `.superpowers/raw-pages/egl/nulls/`.

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| 1 | 22:47:45 | https://www.egltours.com/robots.txt | 200 (requested again: the Task 14 copy was over 24 hours old) |
| 2 | 22:47:49 | https://www.egltours.com/website/itinerary/HTKCEE05 | 200, arrival day |
| 3 | 22:47:53 | https://www.egltours.com/api/v1/tours/HTKCEE05/dates?currencyCode=HKD | 200, 4 dates |
| 4 | 22:47:57 | https://www.egltours.com/website/itinerary/HTKSMS05 | 200, arrival day |
| 5 | 22:48:01 | https://www.egltours.com/api/v1/tours/HTKSMS05/dates?currencyCode=HKD | 200, 3 dates |
| 6 | 22:48:05 | https://www.egltours.com/website/itinerary/MTK3FF05 | 200, "not found" page, no code |
| 7 | 22:48:09 | https://www.egltours.com/website/itinerary/HTJAMK06 | 200, "not found" page, no code |
| 8 | 22:48:13 | https://www.egltours.com/website/itinerary/HTLBAA06 | 200, arrival day |
| 9 | 22:48:18 | https://www.egltours.com/api/v1/tours/HTLBAA06/dates?currencyCode=HKD | 200, 19 dates |
| 10 | 22:48:21 | https://www.egltours.com/website/itinerary/HTENBT12 | 200 |
| 11 | 22:48:26 | https://www.egltours.com/api/v1/tours/HTENBT12/dates?currencyCode=HKD | 200, "No Available Dates" |
| 12 | 22:48:29 | https://www.egltours.com/website/itinerary/HTASCB08 | 200, shared variant plan |
| 13 | 22:48:33 | https://www.egltours.com/api/v1/tours/HTASCB08/dates?currencyCode=HKD | 200, 9 dates |
| 14 | 22:48:37 | https://www.egltours.com/website/itinerary/HTCWGK07 | 200 |
| 15 | 22:48:41 | https://www.egltours.com/api/v1/tours/HTCWGK07/dates?currencyCode=HKD | 200, "No Available Dates" |
