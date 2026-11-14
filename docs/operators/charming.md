OWNER DECISION PENDING

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

1. Many of the 789 posts are old (published 2023–2025) and probably have no future dates. Their pages were not sampled, so what an expired tour page looks like (empty `dates`, a 404, or old dates) is **not known**. They would be skipped as no-departures.
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

**None saved**; this is research only. The raw pages stay under `.superpowers/raw-pages/charming/`. Good fixture candidates: `06-tour-ghtg.raw` (simple), `08-tour-pccgf.raw` (many dates, three statuses), `09-tour-gerd-gere.raw` (two variants). A full (`FU`) date has not been seen and would be worth one.

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

## Not verified

- That the owner meant Charming Holidays 翠明假期 and not the closed `Charming China` / `Charming Tour` (M&F Lucky Holiday).
- That licence 350759 is current today (seen on the site footer and in TIC lists from 2022–2024, not on the Travel Industry Authority's register).
- Whether a website terms of use or privacy policy exists anywhere not linked from the pages fetched.
- What an expired tour page looks like, and how many of the 789 posts have future dates.
- How a full (`FU`) date appears in the table; whether other status codes exist; what `AVAQTY` means.
- Whether past dates are dropped from the page.
- Gathering points for coach tours (none sampled); cruise pages (none sampled).
- The hidden listing value (`6, 03/28/2027, true`) and the per-date code's day-count digits (three tours only).
- Response times were not measured. The 40-minute estimate counts only the 3 s spacing; a slow server could double it, which would still fit.
