APPROVED 2026-11-14: controller applying the owner's stated rule (no prohibiting clause; robots.txt allows the pages used)

# Charming Holidays 翠明假期 (`charming`): operator investigation

- Capture date: **2026-11-14** (Hong Kong). The pages were fetched 2026-11-13 23:08–23:58 UTC, which was 07:08–07:58 on 14 November in Hong Kong.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, one at a time, 3 s per site), with undici's `EnvHttpProxyAgent` installed as `cli.ts` does. All were GETs with no extra headers, cookies or tokens. Page fetches used: **11 of 12**, plus robots.txt on one host (not counted). Every request is listed under "Every URL fetched".
- Raw responses and the ledger are in `.superpowers/raw-pages/charming/` (git-ignored). The probe script is outside the repository.
- No block page, captcha, JavaScript challenge, login wall, 403 or 429 was met. Every page answered a plain GET; the two 404s were sitemap URLs that do not exist. The server is IIS with PHP (WordPress). Every response set cookies (`cookiesession1`, and `PHPSESSID` on pages). They were not stored or sent back, and the pages came back complete without them.

## Which company this is

**Charming Holidays Limited, Chinese name 翠明假期, licence no. 350759. Official site `https://www.charming-online.com/`.**

- The brief called it `美麗假期`. That name is **wrong** for this company. The site's own pages, title and footer say `翠明假期`, and no Hong Kong tour operator called `美麗假期` turned up in web searches.
- The footer of every page fetched says, verbatim: `Copyright 2024 by 翠明假期 ｜ 牌照號碼：350759` ("Copyright 2024 by Charming Holidays | licence no. 350759"). The Travel Industry Council's published scheme lists for 2022–2024 also show licence `350759` as `Charming Holidays Ltd` (for example https://www.tichk.org/sites/default/files/2024-03/CHIS%202.0_disbursement%20list_202402.pdf). Whether the licence is current today was not checked against the Travel Industry Authority's register.
- The About page (`/?page_id=31`, `認識翠明假期 About Charming Holidays`) says: `翠明假期成立於一九八七年，為明報集團有限公司全資附屬機構。` ("Charming Holidays was founded in 1987 and is a wholly owned subsidiary of Ming Pao Holdings Limited."). The study-tour email in the footer is on `charming.mingpao.com`. It also says the company has branches in Los Angeles, New York, San Francisco, Vancouver and Toronto.
- Other links on the site: Facebook page `Charming Holidays Hong Kong 香港翠明假期`, Instagram `charmingholidayshk`. A brochure found in search results points to `charmingholidays.net` for Hawaii; that domain was not looked at and is probably the North American arm. **Not verified.**
- **Not related to WWPKG 縱橫遊**, as far as could be found. WWPKG is a separate group listed on GEM (stock code 8069), founded 1979, known for Japan tours. Charming Holidays says it is wholly owned by Ming Pao. Nothing on the site or in the searches links the two.
- **A possible mix-up for the owner to rule out.** `Charming China` and `Charming Tour` were brand names of a different agency, M&F Lucky Holiday 幸運假期, which closed at a day's notice and left about 1,500 customers affected (The Standard, https://www.thestandard.com.hk/news/article/318344/HK-travel-agency-shuts-down-without-notice-1500-customers-affected; SCMP, https://www.scmp.com/news/hong-kong/society/article/3335014/hong-kong-travel-agency-probed-announcing-closure-only-day-it-folds). That agency is gone. This investigation assumes the owner meant Charming Holidays 翠明假期, which is open and selling tours departing in 2027. **The owner should confirm.**

## Recommendation

**PROCEED.** Everything needed is in the tour page HTML as served, by plain GET of URLs robots.txt allows, and no terms clause restricts automated access or reuse.

- **One request per tour gives everything:** title, tour code, days, day-by-day headings, every departure date with its year, per-date prices, and the status of each date (`已成團` confirmed, `快將成團` nearly confirmed, plain, or `FU` full). They are in an inline `var dates = JSON.parse('…')` and also in a server-rendered table. No API call, POST or token is involved.
- **robots.txt** disallows only `/?page_id=2101`. Nothing needed is under it.
- **Terms.** The only terms document on the site is the booking terms PDF `旅行團報名及責任細則` (footer link `責任細則`). It has no clause on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use, and no personal or non-commercial limit. No website terms of use, `使用條款`, `免責聲明` or privacy-policy page is linked anywhere in the pages fetched. The footer has a copyright notice (quoted above).
- **Discovery** is by the site's own WordPress REST list `index.php?rest_route=/wp/v2/tour` (a JSON GET the page advertises; robots.txt allows it), 100 per page: **789 tour posts**, 8 requests.
- **Nightly cost** at 3 s: 8 + 789 = **797 requests, about 40 minutes** plus response time. Fits the 170-minute job.

Things to settle when the scraper is built, none of them a blocker:

1. Many of the 789 posts are old (published 2023–2025) and probably have no future dates. **Settled 2026-11-14** (see "Scraper and fixtures"): an old post's page is still served, HTTP 200, with its old dates in the table; they are skipped as no-departures.
2. Tours with two variants on one page (e.g. `GERD/E`, 11 or 12 days) need the table, not the JSON (see "Two variants on one page").
3. The REST response carries `x-robots-tag: noindex`. That asks search engines not to index the JSON. It does not forbid fetching it, and robots.txt allows it. If the owner prefers HTML only, the 108 destination listing pages linked from the menu can be used for discovery instead (more requests, and each tour appears on several listings).

## Terms

| Document | URL | Read | Result |
|---|---|---|---|
| 旅行團報名及責任細則 (tour booking and liability terms; footer link `責任細則`, also the `旅遊及責任細則` button on each tour page) | https://www.charming-online.com/wp-content/uploads/2026/09/F-001-All_TCOCT-260917.pdf | 2026-11-14 (fetched 23:21:46 UTC on 13 Nov) | HTTP 200, 427,509 bytes, 1 page, text layer present (PDF title `旅行團報名及責任細則 (A4) - 260917.docx`). No clause on automated access, robots, crawling, scraping, copying, reproduction, IP, linking or permitted use. |
| Website terms of use | – | – | **No link found.** The menu and footer of the home, listing, tour and About pages have no `使用條款`, `免責聲明`, `版權`, `條款及細則` or privacy-policy link. Their only terms link is the PDF above. |
| About page | https://www.charming-online.com/?page_id=31 | 2026-11-14 | Company history and a list of agents. No terms. |

How the PDF was checked: its text (`pdftotext`, whitespace removed) was searched for `版權`, `知識`, `產權`, `複製`, `轉載`, `翻印`, `抄`, `擷取`, `下載`, `商業`, `商用`, `個人用途`, `自動`, `爬`, `機械人`, `機器人`, `程式`, `軟件`, `robot`, `crawl`, `scrap`, `spider`, `copyright`, `reproduc`, `網站`, `網頁`, `商標`, `圖像`, `瀏覽`, `侵`, `連結`, `鏈接`, and every `不得`, `禁止`, `嚴禁`, `未經` and `擁有` was read in context. Every hit was about booking, deposits, documents, liability, insurance or personal data. Sections: `報名手續`, `費用包括`, `費用不包括`, `特殊情況及責任問題`, `航空公司責任問題`, `收集個人資料聲明` and others. The whole PDF was not read line by line.

The only mentions of the website, verbatim:

- `詳情以網頁或行程單張之「報名及責任細則」為準。` ("details are as in the booking terms on the web page or the itinerary leaflet"). About booking, not use of the site.
- `如「旅遊及責任細則」有所更新或修改，會以本公司網站內之最新版本為準。` ("if the terms are updated, the latest version on our website prevails"). Not about use.
- `當旅客在旅行社或經本公司電話報名或使用本公司網站或旅遊途中，向本公司提供閣下個人資料時，即表示旅客同意本公司對閣下個人資料作出收集、使用…` ("when travellers give us personal data, including by using our website, they agree to its collection and use…"). Personal data of customers; we give none.

Related text on the pages, verbatim:

- Footer: `Copyright 2024 by 翠明假期 ｜ 牌照號碼：350759`. A rights notice, not a clause.
- Each tour page, under the offers: `優惠名額有限，價目以報名及付訂金作準，團費及優惠如有任何調整或更改，恕不作另行通知` ("offers are limited; the price is the one at booking and deposit; fares and offers may change without notice"). About prices. Our "check with the operator" wording covers it.
- Each tour page: `日曆價格以港幣為單位` ("calendar prices are in HKD").

## robots.txt (`https://www.charming-online.com/robots.txt`, read 2026-11-13 23:08:11 UTC)

HTTP 200, `text/plain`, 66 bytes, CRLF line ends, no newline at the end. The whole file, verbatim:

```
User-agent: *
Disallow: /?page_id=2101
Disallow: /?page_id=2101*
```

One group, `User-agent: *`. No group names AI or other bots. No Crawl-delay. **No Sitemap line.** `/?tour=…`, `/?tour-destination=…`, `/?page_id=31`, `/index.php?rest_route=…` and `/wp-content/uploads/…` are all allowed. What page 2101 is was not looked at (the rule's prefix also covers ids such as `21010`; no tour URL uses `page_id`).

## Tour pages and how to discover them

- **No sitemap was found.** robots.txt names none; `/wp-sitemap.xml` (WordPress core) and `/sitemap_index.xml` (the site runs Yoast SEO) both gave **HTTP 404** with an empty body. Other sitemap URLs were not tried.
- **Tour URLs:** `https://www.charming-online.com/?tour=<slug>` (the canonical link). Slugs are mostly the brochure code, e.g. `f-26-mono-008-ghtg`, `f-26-china-094-pccgf`, `f-25-eur-010-gerd_gere`; older ones are URL-encoded Chinese titles, e.g. `8天-呼倫貝爾…-pcmhp`. Each tour page links `rest_route=/wp/v2/tour/<id>` as its JSON alternate (`47697` for GHTG).
- **REST list:** `GET https://www.charming-online.com/index.php?rest_route=/wp/v2/tour&per_page=100&_fields=id,slug,link,modified&page=<n>`. HTTP 200 JSON, no login. Headers `x-wp-total: 789`, `x-wp-totalpages: 8`, and a `Link: …; rel="next"`. Page 1 (newest first) was 98 `f-26-…` slugs plus 2 Chinese ones; page 8 (oldest, 89 items) had posts modified in 2023 (28), 2024 (37) and 2025 (24). **So the 789 include old tours.** How many have future dates is not known.
- **Listing pages:** `/?tour-destination=<slug>`. The menu links 108 of them, plus `/?ship-tour-category=all` and `…=selected-cruise-package`. The Italy listing held 6 tours, with no pagination.

## Where each fact comes from

Three tour pages were read: `f-26-mono-008-ghtg` (Italy 11 days, by air, 6 dates), `f-26-china-094-pccgf` (East China 6 days, by air, 19 dates) and `f-25-eur-010-gerd_gere` (Europe, two variants GERD 11 days and GERE 12 days on one page, 6 dates each). All three have the same layout. Everything below is in the HTML as served.

The inline script `var dates = JSON.parse('…');` is called **"dates JSON"** below. It is a map `{"<year>": {"<month>": {"<day>": item}}}` (month and day without leading zeros), plus three arrays `grouped`, `near_grouped`, `other` (empty on all three samples). Parse the string between `JSON.parse('` and `');` on the line that starts `var dates =`.

| Fact | Where | Selector / path | Example |
|---|---|---|---|
| Tour id | page | `var tour_id = '47697';`; also the JSON alternate link | `47697` |
| Tour code | page | `.tour-title` ends with `~ <CODE>` (`~ GHTG`, `~ PCCGF`, `~ GERD/E`). Per departure: dates JSON `item.TOUR_CODE`, the `tcode=` in each row's `詳情/預定` link, and on two-variant pages `.reservation-table-code` | `GHTG`; per date `GHTG11M-261226`, `PCCGF06R-261215A`, `GERD11E-261219` |
| Title | page | `.tour-title` (also `<title>` and `og:title` with `翠明假期` added) | `11天 【城鄉薈萃、多洛米蒂山】意大利深度遊 ~ GHTG` |
| Days | page | leading `<n>天` of `.tour-title` (`11天`, `6天`; `11/12天` on the two-variant page). The per-date code also carries it (`GHTG11M`, `PCCGF06R`, `GERD11E`/`GERE12E`), seen on three tours only. | `11` |
| Nights | **not given** | No nights field. `住宿：` lines name each night's hotel inside the day text. | – |
| Day-by-day headings | page | `.tour-journeys-list .tour-journeys-title`, one per day in order; the day label is `.tour-journeys-day-title h3` (`Day 1 (點擊展開行程)`; on GERD/E also `Day 10/11`) | day 1 `香港 ~ 羅馬[意大利]`; `香港 ~ 杭州/ 上海 ~ 寧波 ~ 天童寺` |
| Cities | page | listing `.detail-sub-title` (comma list); tour page: the day headings (places joined by ` ~ `) | `羅馬、白露里治奧古城、佛羅倫斯、…、米蘭` |
| Start / gathering point | **partly** | No structured field. Day 1's heading starts with the departure city (`香港`) on all three. No meeting place was given; the PCCGF last day says `於指定時間集合前往機場` ("gather at the set time for the airport"). | `香港` |
| "From" price | page | `var min_original_price = 38998;` (before the early-booking discount). Listing: `.right-detail .detail-original-price .currency-display` (`38998`) and `.detail-discount-price .currency-display` (`35998`, shown with `+`). The discounted lowest price = min over dates of `ADT_PRICE`. | GHTG `38998` / `35998+`; PCCGF `4998` / `2998` |
| Departure dates | page | dates JSON keys, or `item.DEPART_DATE` (`"26 DEC 2026"`), or table `.reservation-table-related_date` (`26/12/2026`, `9/01/2027`: day without leading zero, `D/MM/YYYY`) | 6 dates Dec 2026–Mar 2027 |
| Per-date price | page | dates JSON `item.ADT_PRICE` (string with commas, after the early-booking discount), `item.EBD` (discount, e.g. `"-3,000"`); the page shows original = `ADT_PRICE − EBD`. Table: `.reservation-table-td.adt_price .detail-original-price` / `.detail-discount-price`. Also `UCH_PRICE` (child sharing), `CHD_PRICE` (child no bed), `ADT_TAX` (`"0"`, shown as `-`), `DEPOSIT`. | GHTG 26/12: `ADT_PRICE "38,998"`, `EBD "-3,000"`, table `41998` / `38998` |
| Status per date | page | dates JSON `item.GUARANTEE`; table `.reservation-table-status <CODE>` with the label. Seen: `GT` = `已成團(剩餘少量)` ("confirmed, few seats left"), `GP` = `快將成團` ("nearly confirmed"), `HP` = no label (plain date). Listing: `.detail-grouped-tour-container` `已成團`, `.detail-near-grouped-tour-container` `快將成團`, `.detail-other-tour-container` `出發日期`. | PCCGF: 6 `GT`, 3 `GP`, 10 `HP` |
| Full / closed | page | `GUARANTEE == 'FU'`: the page's script marks the date `滿` ("full") and disables it (`if( item['GUARANTEE'] == 'FU' ) … fullObj.addClass('active')`, `containerObj.addClass('disabled')`). **No `FU` date was seen** in the three samples, so how a full row looks in the table is not observed. No closed marker was seen. | – |

Do not use `item.AVAQTY`. It looks like seats left (`"10"` on most dates, `"0"` to `"6"` on some `GT` dates), but the page never shows it, and PCCGF 2027-01-05 had `AVAQTY "0"` with status `GT`, not `FU`. `item.DESCRIPTION` (a short title) and `item.BROCHURE` (PDF link) are also there and not needed.

### Two variants on one page

`f-25-eur-010-gerd_gere` sells GERD (11 days, back from Paris) and GERE (12 days, with London) on the same dates.

- The table has an extra `團號` column (`.reservation-table-code`) and **one row per variant per date** (12 rows for 6 dates): GERD `42898`/`39898`, GERE `48498`/`45498` on 19/12/2026.
- The dates JSON holds **only one item per date** (GERE here), so the other variant is lost if only the JSON is read. `var dates_mulitple` (sic) marks such dates with `true`.
- The day headings run both variants together: day 10 `巴黎 ~ 自由活動 ~ 香港` (GERD ends), then days 11–12 in London (GERE).
- The listing's date list repeats each date once per variant (`19/12, 19/12, 09/01, 09/01, …`).

So a scraper should read the table rows (date, code, adult prices, status) and fall back to the JSON only for the status code.

### Listing pages (not needed, but seen)

Each `.tour-list-item` has `.detail-title` (title with code), `.detail-sub-title` (cities), dates as `DD/MM` **without year** under the three status headings above, both prices, the brochure PDF and the tour link (`?tour=<slug>&tour-destination=<id>`). Before each item is a hidden `<div style="display:none;">6, 03/28/2027, true</div>`: it looks like number of dates, last date (`MM/DD/YYYY`) and a flag. **Meaning not verified.** The tour page is the better source.

## Gathering / departure point text (exact)

- `GHTG` day 1: `香港 ~ 羅馬[意大利]`; `是日晚上由翠明假期領隊陪同下，乘坐歐洲或土耳其航空公司客機經歐洲或土耳其城市轉機飛往意大利首都~羅馬。` Last day: `航機於第 11 天抵達香港國際機場。`
- `PCCGF` day 1: `香港 ~ 杭州/ 上海 ~ 寧波 ~ 天童寺`; day 6 `德清 ~ 上海/ 杭州 ~ 香港`, `早餐後，於指定時間集合前往機場，搭乘航班返港`.
- `GERD/E` day 1: `香港 ~ 羅馬[意大利]`.
- No page used `集合地點` or `出發地點` as a label. Coach tours to Guangdong (if any) were not sampled.

## Number and date formats

- Prices: table and listing are plain ASCII digits (`41998`); the dates JSON uses strings with commas (`"38,998"`, `"-3,000"`); `min_original_price` is a JS number. HKD (`日曆價格以港幣為單位`).
- Dates: table `D/MM/YYYY` (`9/01/2027`); JSON keys numeric; `DEPART_DATE` `DD MON YYYY` (`09 JAN 2027`); listing `DD/MM`, no year.
- Days: `11天`, `11/12天`.
- Past dates: none seen (the earliest date in the samples was 13 Dec 2026). Whether the page drops past dates is **not known**.

## Fixtures

None were saved in the investigation. The scraper's fixtures are under "Scraper and fixtures" below.

## Discovering tours and nightly cost

| Route | Requests per night | At 3 s each (plus response time) | Within the rules? | Fits 170 min? |
|---|---|---|---|---|
| REST list (8 pages) + every tour page | 8 + 789 = 797 | 40 min | yes | yes |
| 108 destination listings + every distinct tour found there | 108 + tours listed (not known; fewer than 789) | over 5 min + tours | yes | yes |
| Listings only (no tour pages): no day headings, no years, no per-date prices | 108 | 5 min | yes | yes, but not enough data |

Ways to cut the cost (not tried): skip REST posts whose `modified` date is old and whose page last had no future dates; or read only the tours the listings show.

## Every URL fetched (11 page fetches; robots.txt not counted)

All were GETs through `createFetcher`. "Bytes" is the size of the decoded body. The ledger (`.superpowers/raw-pages/charming/ledger.tsv`) also lists each time the saved robots.txt was reused instead of fetched again.

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | 23:08:11 | https://www.charming-online.com/robots.txt | 200, 66 bytes |
| 1 | 23:10:19 | https://www.charming-online.com/wp-sitemap.xml | 404, empty |
| 2 | 23:12:12 | https://www.charming-online.com/ | 200, 228,214 bytes (home: menu of 108 listings, footer, licence, terms link) |
| 3 | 23:19:49 | https://www.charming-online.com/sitemap_index.xml | 404, empty |
| 4 | 23:21:46 | https://www.charming-online.com/wp-content/uploads/2026/09/F-001-All_TCOCT-260917.pdf | 200, 427,509 bytes (booking terms PDF) |
| 5 | 23:27:26 | https://www.charming-online.com/?tour-destination=italy | 200, 129,849 bytes (listing, 6 tours) |
| 6 | 23:32:31 | https://www.charming-online.com/?tour=f-26-mono-008-ghtg | 200, 169,107 bytes (tour page; all facts) |
| 7 | 23:46:35 | https://www.charming-online.com/index.php?rest_route=/wp/v2/tour&per_page=100&_fields=id,slug,link,modified | 200, 15,815 bytes JSON (`x-wp-total: 789`) |
| 8 | 23:50:14 | https://www.charming-online.com/?tour=f-26-china-094-pccgf | 200, 205,233 bytes (China tour; `GT`/`GP`/`HP`) |
| 9 | 23:52:43 | https://www.charming-online.com/?tour=f-25-eur-010-gerd_gere | 200, 205,570 bytes (two variants) |
| 10 | 23:56:46 | https://www.charming-online.com/?page_id=31 | 200, 97,554 bytes (About: Ming Pao ownership) |
| 11 | 23:58:08 | https://www.charming-online.com/index.php?rest_route=/wp/v2/tour&per_page=100&_fields=id,slug,link,modified&page=8 | 200, 37,796 bytes JSON (oldest 89 posts) |

**Order of fetches.** The brief's order was sitemaps, terms, listing, tour pages, scripts. The home page (#2) came after the first sitemap guess, to find the terms link and the site's structure (robots.txt names no sitemap). The second sitemap guess (#3) was made after the home page showed Yoast. The REST list (#7) was found from the tour page's own JSON link. No script files were needed: the data is inline. One fetch was left unused.

**Not fetched:** `/?page_id=2101` (disallowed); any other sitemap URL; the booking page `/?page_id=48197&tcode=…`; `/?page_id=26` (contact), `/?page_id=2663`, `/?page_id=25836`; the tour brochure PDFs; REST pages 2–7; `charmingholidays.net`; a cruise or Guangdong coach tour page.

## Scraper and fixtures (2026-11-14)

The scraper is `packages/scraper/src/operators/charming/`. Each discovered tour is one request, its page. Everything is read from the HTML as served; the inline `var dates = JSON.parse(…)` is not read (it holds one variant per date only, and the table holds every row). In the nightly matrix since the 2026-11-14 practice crawl, with a first-run floor of 51 (see "Practice crawl").

**Discovery** (changed in the 2026-11-14 review): the REST list is asked for with `&_envelope`, a documented WordPress REST parameter (still a plain GET). Checked on the site with two requests (2026-11-14 02:14 UTC, `.superpowers/raw-pages/charming/ledger-envelope.tsv`): page 1 answered HTTP 200 with `{"body": [100 posts], "status": 200, "headers": {"X-WP-Total": 789, "X-WP-TotalPages": 8, "Link": …, "Allow": "GET"}}`; page 9 answered HTTP 200 with `{"body": {"code": "rest_post_invalid_page_number", …}, "status": 400, …}`. So page 1 gives the page count and the post count, and every page up to the page count must answer with status 200 and a list; otherwise discovery throws, the run fails as `discover-error` and last night's tours stay. A missing or non-whole page count, one over 20 pages, or a missing post count also throws. The posts that link a tour page, counted before any is excluded below, must number exactly page 1's `X-WP-Total` (re-review, 2026-11-14), so a page that answers 200 with fewer posts, or a post without a tour link, also throws; a post published or removed while the 8 list pages are read would fail that night's run too. Posts whose decoded slug shows they are not group tours are not fetched, and each is logged (`charming: excluded <url>: not a group tour (<rule>)`), so a group tour wrongly left out leaves a trace: `價錢` or `會籍` (spa and wellness packages priced in the slug, a membership), `機票` (air tickets), `<n>回-` (Peace Boat world cruises), and a slug starting with a night count (`9-晚-…《…號》`, `2-3晚…`: cruise-only packages). All 24 such posts were parse failures in the practice crawl.

What the parser reads, and its rules:

- **Title, code, days**: `.tour-title`. The code is after the last `~` or `～` (`～ WVJ3/4` uses the full-width one); the days are the leading `<n>天` (`3/4 天` has a space). With no `<n>天`, the last day label's number (`Day 5/6` gives 6), for a single variant. The title is kept as the page gives it.
- **Variants**: `GERD/E` is GERD and GERE (each code after a `/` replaces the end of the first; `WVJ3/4` is WVJ3 and WVJ4; a full code after the slash is taken as it is). Day counts pair with the codes in order, or one count is every variant's. The title's code may be followed by a bracketed note with no `~` in it (`~ GHTH 《農曆新年2027》`, `~ PCJSC【…】`, `~ GEFM (增遊…)`). Each table row goes to exactly one variant: the one whose code, followed by a digit, starts the row's code, the longest such code winning (`GERE12E-261219` is GERE's; on `8/10天 ~ GVRB/GVRBX`, `GVRBX10A-…` is GVRBX's and `GVRB08A-…` GVRB's), else the first with the row's letters and day count (`WVJ04O-261101` is WVJ4's: letters, then the day count, here with a leading zero). Two variants with the **same letters and the same day count** (`ABC1/2`, rows `ABC05…`) cannot be told apart by that rule, so every such row goes to the first of them, deterministically: the second is not listed and its rows are not merged into another tour. A table with no code column gives every row to every variant only when all the variants have the same day count (`GRCSB/A/S`, cabin grades on the same dates; `ZSGN/ZSGB`); with different day counts (`GAKA/GAKVA`, 11 and 14 days) its dated rows cannot be told apart, and the page is a parse failure (before the re-review GAKVA took the 11-day row's date and price). The page gives one tour: the **longest variant that has rows** (the longest of all when the table has no dated rows); among variants as long, the one whose lowest price after today (Hong Kong) is cheapest, since the card shows a "from" price (GSAOA/B/O, cabin grades of one 19-day cruise, gives GSAOO), then the first, so the choice is the same each night. The other variants are not listed. If the table has dated rows but none is any variant's, the page is a parse failure.
- **Day headings**: each `.tour-journeys-day-title` whose `h3` starts `Day <n>` (`Day ４` with a full-width digit occurs), paired with the `.tour-journeys-title` of the `.tour-journeys-detail` after it. Entries without a day label are notes and are left out: `集合時間及地點` (gathering time and place, on Canadian local tours) and `旅遊須知` (travel notes). A label ending `- GERD` (or `- GERD/E`, two variants) or starting with a code (`GAKVA Day 1`) marks a day of those variants only; a day tagged only with other variants' codes is left out. Notes such as `自費節目一覽表` are left out too. Day 1's flight leg after Hong Kong and the last day's before it are dropped when they name either of two or more airports (`香港 ~ 無錫/南京/上海 ~ 南京`, `… ~ 杭州/上海機場 ~ 香港`), as for Jetour and EGL; every other heading is as the page gives it.
- **Start and end**: day 1's first place and the last day's last place (bracketed notes removed before splitting at `~`, at most 12 characters, else none). A place naming 香港 or 深圳 always counts. A place abroad counts only when the page says the tour is joined there: `原居地` ("home city") in that day's heading (`原居地 ~ 溫哥華`, `… ~ 溫哥華 ~ 原居地`; `原居地` itself is skipped), or an entry labelled `集合時間及地點` (gathering time and place). Those tours start and end at 溫哥華 (kind other, not a stop). Otherwise none, so a Hong Kong tour whose last heading names only sights abroad (`青島（中山公園…）`) is not given an end abroad.
- **Dates**: one `.reservation-table .reservation-table-tr` per departure (per variant), `.reservation-table-related_date` as `D/MM/YYYY`. A row whose `.reservation-table-status` has the class `FU` is full and dropped. Other status classes (`GT`, `GP`, `HP`, or one not seen) are kept. Past dates are kept for normaliseTour to drop.
- **Price**: the row's adult (sharing a room) price, `.reservation-table-td.adt_price .detail-discount-price` (after the early-booking discount; on a date without one it is the only price), else `.detail-original-price`. The tax column is not added. `fromPriceHkd` is null: the page's only "from" figure is in a script (`min_original_price`, before the discount).
- **URL**: `https://www.charming-online.com/?tour=<slug>`, without a listing's `&tour-destination=` or a fragment.

**What an expired tour page looks like** (fixture request 1, a post the REST list gives as modified 2023-11-29): HTTP 200, the full page, with its old date still in the table (`30/11/2023`), here also marked full. Not empty, not a 404. So old posts are fetched every night and skipped as no-departures. Recently departed dates also stay on current pages (PCMHP listed only `6/11/2026` on 14 November).

**How a full date looks** (the same page; the only `FU` seen): the date cell's status is `<div class="reservation-table-status FU"></div>` (empty), and the booking cell holds `<div class="reservation-table-status FU">額滿</div>` in place of the `詳情/預定` link. Prices are still shown.

Fixtures (`packages/scraper/src/operators/charming/fixtures/`), each with `<name>.expected.json` (`verifiedByOwner: false`, notes on every judgment call):

| Fixture | Tour | Why |
|---|---|---|
| `simple` | PCCGG, 8天 華東【乾隆遊江南】 (`?tour=8天-華東【乾隆遊江南】江南尋夢之旅-pccgg`, percent-encoded) | One variant, 12 dates, flight legs `無錫/南京/上海` and `杭州/上海機場`, a `Day ４` label |
| `multi-city` | GERD/E, 11/12天【經典歐洲】 (`?tour=f-25-eur-010-gerd_gere`) | Two variants on one page, five countries, day labels tagged `- GERD` / `- GERE` |
| `edge` | GDXD, 6天杜拜悠閒之旅 (`?tour=6天杜拜悠閒之旅-gdxd`, percent-encoded) | A 2023 post: its only date past and full (`FU`), no discount, a tax shown, `Day 5/6` |

A non-Hong Kong start (RWC5, RWB4, WVJ3/4: Canadian local tours) is covered by tests built on the same markup, not by a fixture: three fixtures were asked for, and the expired and full page was the oddest.

They were trimmed in allow-list mode from the saved pages (`f07-china-pccgg.raw`, `09-tour-gerd-gere.raw`, `f01-old-2023-gdxd.raw` under `.superpowers/raw-pages/charming/`, outside git), keeping only the text `parse.ts` reads; scripts (including `var dates`), images and all other text are removed. To regenerate:

```sh
pnpm --filter @hktours/scraper fixture \
  --allow .tour-title --allow .tour-journeys-day-title --allow .tour-journeys-title \
  --allow .reservation-table-related_date --allow .reservation-table-code --allow .reservation-table-td.adt_price \
  --drop a --drop form --drop .social-container \
  --from <saved page> <output>.html
```

The status (`FU`, `HP` …) is a class, which is kept without being listed. `--drop` (added to the trim tool for Charming, 2026-11-14 review) removes elements with everything inside them: every link (`a`: the menu, the footer's WhatsApp and social links, the booking links `?page_id=48197&tcode=…`), every form (search, newsletter) and the share widget (`.social-container`), none of which the parser reads. Every committed fixture was checked: the only text left is the title, the day labels and headings, the dates, row codes and adult prices; no attribute holds Chinese text; no link, form, email address or phone number is left. The one script left is Yoast's JSON-LD with every string emptied.

**Requests for the fixtures** (budget 8; **7 used**). Each through `createFetcher()` with default options (one fetcher per run, so 3 s apart within a run), undici's `EnvHttpProxyAgent` installed as `cli.ts` does, GET, no extra headers; robots.txt was served from the copy saved in the investigation (2026-11-13 23:08 UTC), not requested again. Logged to `.superpowers/raw-pages/charming/ledger-fixtures.tsv`. Every answer was HTTP 200 with the full page; no refusal, block or challenge.

| # | UTC (2026-11-14) | URL (`https://www.charming-online.com/?tour=…`) | Result |
|---|---|---|---|
| 1 | 00:27:14 | `6天杜拜悠閒之旅-gdxd` (percent-encoded; REST post 24615, modified 2023-11-29) | 200, 130,991 bytes. Expired: one date, 30/11/2023, `FU`. The `edge` fixture |
| 2 | 00:29:05 | `f-26-can-014-rwb4` | 200, 126,067 bytes. Canada 4天, starts 溫哥華, one date 19/12/2026, a `集合時間及地點` entry |
| 3 | 00:29:11 | `f-26-can-016-wvj3-4` | 200, 134,002 bytes. `WVJ3/4`, two variants (`WVJ03O`, `WVJ04O`), `原居地`, `～`; its only date 1/11/2026, past |
| 4 | 00:39:13 | `f-26-can-013-rwc5` | 200, 131,535 bytes. Canada 5天, `原居地 ~ 溫哥華` … `溫哥華 ~ 原居地`, one date 18/12/2026 |
| 5 | 00:39:19 | `8天-呼倫貝爾．漠河．滿洲里．北極村邂逅極光-pcmhp` (percent-encoded) | 200, 157,180 bytes. Its only date 6/11/2026, past (`GT`) |
| 6 | 00:41:14 | `f-26-china-083-pcqda` | 200, 155,044 bytes. Two dates in April 2027, `GT` |
| 7 | 00:41:19 | `8天-華東【乾隆遊江南】江南尋夢之旅-pccgg` (percent-encoded) | 200, 182,564 bytes. 12 dates, all `HP`. The `simple` fixture |

Requests 2–7 looked for a future full date and a non-Hong Kong start: the start was found (2–4), a future `FU` date was not.

## Practice crawl (2026-11-14)

`pnpm scrape --operator charming --dry-run` from 01:11:24 to 02:11:33 UTC: **60 minutes** for 8 list pages and 789 tour pages, well inside the 170-minute job. Log: `.superpowers/raw-pages/charming/dry-run-1.log`. It ran with the parser and places list as committed before the review below.

| | Pages |
|---|---|
| Discovered, fetched | 789, 789 (none not fetched; no refusal) |
| Would be saved | 186 parsed with upcoming dates and a route; **153 tours** after duplicates by code (several posts sell the same code, e.g. `…-gann` and `…-gann-2`) |
| Skipped no-departures | 490 (old posts, and recent ones whose dates have all passed or are full) |
| Parse failures | **113 (14.3%)**: 109 `parser returned null`, 4 `no-stops` |
| Unmatched names | 1008 |

**First-run floor: 51**, a third of the 153.

### The 109 null pages

Grouped by slug, then 10 of them fetched (budget 10; through `createFetcher()`, default options, robots.txt from the saved copy; 02:15:33–02:16:15 UTC; ledger `.superpowers/raw-pages/charming/nulls/ledger-nulls.tsv`; every answer HTTP 200, no refusal):

| Group | Pages | What they are | Now |
|---|---|---|---|
| Spa and wellness packages, a membership (`…單人價錢：…`, `臻林-悅康會籍`) | 11 | not group tours | not fetched (discovery) |
| Cruise-only packages counted in nights (`9-晚-…《…號》`, `2-3晚三亞海上遊…`) | 6 | cruise only | not fetched |
| Peace Boat world cruises (`122回-100-日-…`) | 5 | cruise only | not fetched |
| Air tickets (`機票及郵輪套票`, `加拿大航空《溫哥華機票-1晚酒店》`) | 2 | tickets | not fetched |
| Canadian local day tours (`溫哥華1天遊`, `維多利亞一天遊/威士拿一天遊/溫哥華一天遊 ~ WYJ01/WHR01/WVR01`) | 4 | one-day local tours, bundled; no `<n>天` in the title and no `Day` labels (fetched: the bundle) | still null (not a multi-day group tour) |
| `北京獨立組團` (a custom group), `自由行10天…` (independent travel) | 2 | not group tours | still null (not fetched; slugs too varied to exclude safely) |
| `christmas…` reposts (`christmasgehp`: `9天荷蘭、比利時、法國深度精選之旅 ~ GEHP (聖誕節精選)`) | 10 | group tours, a note after the code | parse (fetched: GEHP; its dates were in December 2025, so no-departures) |
| Coded slugs `f-2x-…` | 30 | group tours | the 8 fetched all parse now (below) |
| Chinese-title slugs | 39 | group tours, mostly 2024–2025 posts | the 1 fetched parses now (below) |

Causes found in the 9 fetched group-tour pages, all fixed: a bracketed note after the title's code (PCJSC `【南疆旅遊團｜售罄加開・最後一團】`, GHTH `《農曆新年2027》`, GEFM `(增遊…)`, GSAOA/B/O `《2027》`, GEHP `(聖誕節精選)`, PCXIA `(粵語導遊服務) (農曆新年)`): 6; day labels with the variant's code before `Day` (GAKA/GAKVA: `GAKVA Day 1`): 1; several variants with no code column in the table (GRCSB/A/S, ZSGN/ZSGB): 2. After the fixes: GHTH (one date in February 2027) and GSAOA (June 2027) would be saved; PCJSC, GEFM, GAKVA, GRCSB (a `1/01/1970` placeholder date), GEHP, PCXIA and ZSGN are no-departures.

The 4 `no-stops`: two Namibia tours (GANN, GANN-2) now have routes from the places pass; two posts (`f-25-can-014-rwb5`, `…rwb5` with a Chinese slug, and `f-25-china-074-pckkm`; three URLs, two of them counted) have no day entries at all and stay no-stops.

**Estimates after the fixes (not measured; no re-crawl):** 765 pages fetched (789 less the 24 not fetched). Parse failures about 10–20 (the 6 day tours, custom group and independent-travel posts, the no-day-entry posts, and a share of the 69 unfetched group-tour posts with causes not seen in the sample, taken as at most 1 in 10): **about 1–3%**, down from 14.3%. Tours saved about **160–170**: the 153, plus the null pages that now parse with upcoming dates (2 of the 9 fetched group-tour pages; the unfetched ones are mostly older posts), plus GANN.

### Places pass

From the unmatched names of the 186 pages the crawl would have saved (re-run offline with the list as it stood after the EGL review: 1110 distinct), real places were added to `packages/core/src/places/data.json`: **144 cities**, aliases on **36 cities**, and **8 countries**, each with one region: Namibia (`africa`), Greenland and Antarctica (`polar`), Malta and Kosovo (`europe`), Panama, Uruguay and the Falkland Islands (`americas`). Names that are not places (sights, meals, shows, ships, hotels) were left out. Sights such as national parks and lakes were added only where a tour treats them as its stop (塞倫蓋堤, 曼亞拉湖, 伊托夏, 四姑娘山, 巴松措, 羊卓雍措, 瀘沽湖, 千島湖).

Every new name of 2 or 3 characters (115) was swept with the matcher over every heading of every practice-crawl log under `.superpowers/raw-pages/*/` (Charming and EGL; Big Line's log had no headings yet), and each inside-word hit read:

- `雷納` (Reine) sat inside `蓬塔阿雷納斯` (29 pages) and `拉馬卡雷納`: left out. `阿雷納斯` is now an alias of 蓬塔阿雷納斯.
- `卡利` (Cali) sat inside `斯卡利傑羅城堡` (Verona's castle): left out.
- `臥龍` (Wolong, Sichuan) sat inside `臥龍湖碼頭` on a Beijing tour: notPlaces `臥龍湖`.
- `巴塞爾` (Basel) sat inside `巴塞爾頓碼頭` (Busselton, Western Australia): notPlaces `巴塞爾頓`.
- `千島湖` (Qiandao Lake) sat inside `千島湖遊船` on a Canada tour (the Thousand Islands): collision name, so a lone 千島湖 on a route elsewhere is dropped and reported.
- Every other hit was the place itself (`特洛依古城`, `以弗所古城`, `福倫丹漁村`, `黑維茲溫泉湖`, `甘泉大峽谷`, `東川紅土地`, …).

Also the guards from the EGL review: notPlaces `雅拉谷`, `圓滿歸`, `崇禮雲頂`, `雲頂夢號`, `雲頂美景`.

Then every route of both logs was compared before and after, and every stop in a country the route did not visit before was read. 312 routes change (299 Charming, 13 EGL). The new countries are right: Antarctica on the South America cruises, Greenland on the Iceland and Arctic cruises, Malta and Valletta on the Mediterranean cruises and Sicily tours, Namibia on the southern Africa tours, Panama City on the Colombia tours, Kosovo (Pristina) on the Balkan tours, Stanley and Montevideo on the Cape Horn cruises. Two of the new names were wrong and were changed: `聖瑪爾塔` is Rio de Janeiro's Santa Marta favela on every Brazil tour (10 pages), not Santa Marta in Colombia, so it was left out; `梅西納` is Musina, the South African border town (`波羅克瓦尼 ~ 梅西納 ~ 貝特布里奇`), so it is a South African city, not an alias of Messina. The comparison also showed four older inside-word matches, now guarded in notPlaces: `吉利馬札羅` (Kilimanjaro read as 利馬, Lima), `卡薩布蘭卡山` (Chile's Casablanca valley read as Casablanca, Morocco, on 19 routes), `里維埃拉` (a Riviera read as 埃拉, Ella in Sri Lanka) and `卡斯特羅馬諾` (Rome's Castel Romano outlet read as 卡斯特羅, Castro in Chile). So 11 notPlaces were added in all. The stops routes lose are only those (卡薩布蘭加 19, 利馬 2, 埃拉 2, 卡斯特羅 1) and `丹巴` once, to `四姑娘山`, a longer name in the same token. One stop abroad remains as written: 伊斯坦堡 on a Colombia tour whose last days fly home through Istanbul. No Jetour, Travel Expert, EGL, Big Line or Charming expected file changed.

## Not verified

- That the owner meant Charming Holidays 翠明假期 and not the closed `Charming China` / `Charming Tour` (M&F Lucky Holiday).
- That licence 350759 is current today (seen on the site footer and in TIC lists from 2022–2024, not on the Travel Industry Authority's register).
- Whether a website terms of use or privacy policy exists anywhere not linked from the pages fetched.
- How many of the 789 posts have future dates (an expired page was seen on 2026-11-14: see "Scraper and fixtures").
- A full (`FU`) row was seen only on a past date (2026-11-14); whether other status codes exist; what `AVAQTY` means.
- Past dates are not dropped from the page (seen 2026-11-14 on three pages).
- Whether every multi-variant page tags its variant-only days (`- GERD`, `GAKVA Day 1`) and codes its rows with letters then the day count: seen on GERD/E, WVJ3/4, GSAOA/B/O and GAKA/GAKVA only.
- The causes of the 69 null group-tour pages not fetched in the review (estimated from the 9 that were).
- That the slug rules for posts that are not group tours never match a group tour (they matched only the 24 such posts among the 789).
- Gathering points for coach tours (none sampled); cruise pages (none sampled).
- The hidden listing value (`6, 03/28/2027, true`) and the per-date code's day-count digits (three tours only).
- Run length: measured at 60 minutes for 797 requests in the 2026-11-14 practice crawl (the investigation's estimate of 40 minutes counted only the 3 s spacing).
