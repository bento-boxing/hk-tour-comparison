APPROVED 2026-11-12: controller applying the owner's stated rule (no prohibiting clause; robots.txt allows everything)

# Jetour 捷旅 (`jetour`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`); pages fetched 2026-11-12 22:13–22:38 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **10 of 10**.

## Owner decision

**Approved by delegation, not by the owner personally.** On 2026-11-12 the owner delegated approval for operators whose terms have no clause prohibiting automated access, scraping, crawling or reproduction. Jetour meets that rule: it publishes no website terms of use, neither booking-terms document has such a clause (see Recommendation), and robots.txt allows everything. The controller applied the owner's rule and marked Jetour approved. The owner has not reviewed this document personally.

## Recommendation

**PROCEED.** Jetour publishes no website terms of use; the only terms it links are booking terms. Neither booking-terms document has a clause about automated access, scraping, crawling, copying or reproduction of site content. robots.txt allows everything, and every needed fact is in the tour page itself.

- The only rights notice on the site is the footer line, which is a copyright notice and not a use restriction:

  > 2026© 捷旅集團     牌照號碼：353020

- Not read: the privacy policy's single post (`/privacy-policy` is an index whose only entry is `個人資料收集及使用`, about collecting customers' personal data). A privacy policy is not expected to restrict site use, but it was not checked.

## Terms of use

Footer links, all read 2026-11-13: `責任及細則` → `https://www.jetour.com.hk/terms-and-condition` (an index of two posts) and `私隱政策` → `https://www.jetour.com.hk/privacy-policy` (an index of one post).

- `https://www.jetour.com.hk/terms-and-condition/post/tour-terms-and-conditions` (`旅行團責任及細則`): booking, payment, cancellation and liability terms for tours. **No clause about website use, automated access, copying or reproduction.** The only mentions of web sites are references for customers (`https://www.travelhealth.gov.hk/`, `https://www.tia.org.hk/…`).
- `https://www.jetour.com.hk/terms-and-condition/post/demo-2` (`自遊行/郵輪船票責任及細則`): booking terms for packages and cruise tickets. **No such clause.** Its only mention of web pages: `所有遊輪、自駕遊、當地自費遊或火車証之責任細則 均以其所屬公司所刊登之條款為準，詳情請瀏覽該公司 之網頁或向「本公司」職員查詢。`

## robots.txt (`https://www.jetour.com.hk/robots.txt`)

```
User-agent: *
Disallow:

Sitemap: https://www.jetour.com.hk/sitemap.xml
```

Everything is allowed. No Crawl-delay.

## `/tour/THB`: one tour, not a list (settled)

`https://www.jetour.com.hk/tour/<CODE>` is **one tour product** (`THB` = `8天從容慢遊・東北冰雪童話`) with **several departures** in a booking table. Each departure has its own group code (`26T1222THB`, `26T1226THB`: `yy` + `T` + `mmdd` + product code). The many prices the plan's author saw are the "from" price plus, for each departure, the offer price, the struck-through original, and four passenger-type prices (`成人(佔半房)`, `小童(佔床)`, `小童(不佔床)`, `成人(單人房)`), each also with its original. The 2 dates are the 2 departures.

The **lists** of tours for a destination are the `/tour/dest/<region>` and `/tour/dest/<region>/<country>` pages (e.g. page 1 of 3 of `/tour/dest/china` shows 12 tours as cards linking to `/tour/<CODE>`). They are not needed: the sitemap lists every `/tour/<CODE>` directly.

## Tour pages in the sitemap

`https://www.jetour.com.hk/sitemap.xml` is one `urlset` with 1,394 URLs:

- **`/tour/<one path segment>`: 452** tour pages. Codes are mostly 3–5 capital letters (`THB`, `TSEQ`), some with a hyphen (`HKWA-HKWAJ`, `TUNA-TUNAJ`) or a lower-case letter (`EIMz`). **One is not a code:** `/tour/江門,新會,珠海美食純玩之旅`, an empty page (see the edge fixture).
- `/tour/dest/…`: 216 destination list pages (two or three segments after `/tour/`). Not tour pages.
- `/cruise-tour/<CODE>`: 259 cruise-and-tour packages; `/cruise/…`: 465 cruises; plus 1 `/seminar/…` and 1 `/cruise-company/…`. Out of scope unless the owner decides otherwise.

## Where each fact comes from

Everything is in the tour page HTML. No separate request is needed. The scripts carry no data (Cloudflare Rocket Loader retypes them as `<hash>-text/javascript`).

| Fact | Selector |
|---|---|
| Tour code | `.tour_location .card_tag` (`THB`); departure group codes in `.booking-table--reference--number.visible-desktop` |
| Title | `h1.title` (`8天從容慢遊・東北冰雪童話`, days included); `.tour_location .location_name` without days; `<title>` adds ` - Jetour 捷旅` |
| Days | leading `N天` of `h1.title`; or the number of `.days__items` |
| Nights | not stated |
| Day headings | `.days__list--works .days__items`, each with `.day--name` (`第1天`), `.day--title` (`出發前往哈爾濱`) and `.day--trip-work` (stops: `香港 ~ 哈爾濱`, separated by ` ~ `, sometimes with `：` and a list) |
| Start / end point | day 1 `.day--trip-work` first stop and last day's last stop (`香港`). Day 1 prose says where the group meets (below). |
| "From" price | `.booking--price` (`HKD 20,998 +`) |
| Departure dates | `.booking-table--body .booking-table--row` → `.booking-table--start--date span:last-child` (`2026年12月22日 (二)`); return date in `.booking-table--end--date span:last-child` |
| Per-date price | the row's `.booking-table--price.visible-desktop`: either plain text `HKD 2,798 +`, or three spans: a label (`限時優惠` / `早鳥優惠`), the price `HKD 20,998 +`, and the struck original `span.text-decoration-line-through` `HKD 22,998+`. Prices differ per date (TSEQ: 2,798 and 3,198). |
| Full / closed | the last class of the row's `.booking-table--status.visible-desktop` and its text: `OK` 收客中, `FORMING_A_TOUR` 即將成團, `TOUR_IS_FORMED` 已成團 (seen on tour pages); `ALMOST_FULL` 尚餘少量 and `FULLED` 額滿候補 (the status filter on `/tour/dest/china`; not seen on a tour page). |
| No departures | `.booking-table--row .empty-data` with text `沒有數據。` |

Caution: the destination list card for `TNA` carried the label `全團滿額` (all full), but the `TNA` tour page shows all six departures as `FORMING_A_TOUR` / `即將成團`. The card label is a marketing tag; use the tour page's status classes.

## Gathering / departure point text (exact)

- `THB`: day 1 stops `香港 ~ 哈爾濱`; prose `是日集合於香港國際機場，由專業領隊陪同下乘搭豪華客機飛住哈爾濱。抵達後，客人如需要可於棉衣商場補充禦寒物品。`
- `TSEQ`: day 1 stops `香港 ~ 杭州/上海 ~ 洛克·外灘源(ROCKBUND)`; prose `是日集合於香港國際機場，由專業領隊陪同搭乘直航客機飛往杭州/上海。`
- `TNA`: day 1 stops `香港 ~ 成都 ~ 文殊坊`; prose `是日集合於香港國際機場，由專業領隊陪同下，乘搭豪華客機直飛成都。`; last day `早餐後，指定時間集合乘專車前往機場乘豪華客機飛返香港。`
- No `集合地點` or `出發地點` label exists. The meeting point appears only in day-1 prose, which `trimFixture` cuts to its first 20 characters (`是日集合於香港國際機場，由專業領隊陪同下…`). The place survives the cut in these samples.

## Number and date formats

- Dates: `2026年12月22日 (二)`: full year, zero-padded month and day, weekday in brackets. Return dates cross the year (`2027年01月02日 (六)`).
- Prices: ASCII digits with a comma and a trailing `+`, written both `HKD 20,998 +` and `HKD 22,998+` (the space before `+` varies). No full-width digits seen.
- A day title contains zero-width spaces (U+200B): `長廣溪​​​​濕地公園` on TSEQ day 3.

## Fixtures (`packages/scraper/src/operators/jetour/fixtures/`)

Saved with `pnpm --filter @hktours/scraper fixture --from <saved page> <output>` in **allow-list mode** (`trimFixture`'s `allow` option): only text inside the elements `parse.ts` reads is kept; every other text node, and every text-carrying attribute outside those elements, is emptied. Jetour's parser reads no JSON, so no JSON key is allowed and every string in the page's JSON is emptied. To regenerate (the saved pages are under `.superpowers/raw-pages/jetour/`, outside git: `tour-THB.html` → `multi-city.html`, `tour-TSEQ.html` → `simple.html`, `tour-jiangmen.html` → `edge.html`):

```
pnpm --filter @hktours/scraper fixture \
  --allow '.tour_location .card_tag' \
  --allow 'h1.title' \
  --allow '.days__list--works .days__items .day--trip-work' \
  --allow '.days__list--works .days__items .day--title' \
  --allow-max 20 '.days__list--works .days__items:first-child .days_items--details' \
  --allow '.booking-table--body .booking-table--row .booking-table--start--date span:last-child' \
  --allow '.booking-table--body .booking-table--row .booking-table--status.visible-desktop' \
  --allow '.booking-table--body .booking-table--row .booking-table--price.visible-desktop' \
  --allow '.booking--price' \
  --from <saved tour page> <output>
```

The allow-list, one line per thing `parse.ts` reads: the tour code (`.tour_location .card_tag`), the title and its day count (`h1.title`), each day's stop line and title (`.day--trip-work`, `.day--title`; the `.days__items` themselves are only counted, so their other text is not kept), day 1's details for the meeting point after `集合於`, and per booking row the date (`span:last-child`), the status and the offer price, plus the "from" price (`.booking--price`). Allowed text is cut only above 300 characters (`KEEP_TEXT_LIMIT`), except day 1's details: that is prose, and the parser reads only the place right after `集合於`, so each of its text nodes is cut above 20 characters (`--allow-max 20`), as before (`是日集合於香港國際機場，由專業領隊陪同下…`). The details also hold day 1's short hotel and meal lines (`哈爾濱會展中心希爾頓酒店或同級`, `特色燒烤`, `了解更多`), which are facts and labels, not prose. In the price cell the struck-through original price is kept too, since the parser removes it itself.

Checked after regenerating (2026-11-13): every parser test and expected file passes unchanged; the only runs of 25 or more Chinese characters and punctuation left are three stop lines in `multi-city.html` (day 2 `伏爾加莊園：體驗雪橇列車、品冰杯伏特加、繪製俄羅斯套娃`, day 5 `北極村：神州北極廣場、最北郵局、…`, day 7 `聖索菲亞教堂廣場、中央大街、…`), which the parser reads for the stops; none of the 14 `.day--trip-work` lines ends in `…`. No images, styles, scripts, inline event handlers or personal data; LF line endings.

| File | Source | Why |
|---|---|---|
| `multi-city.html` | `/tour/THB` | 8 days, Harbin / Mohe / Arctic Village; 2 departures with offer + struck prices; return date in the next year |
| `simple.html` | `/tour/TSEQ` | The shortest and cheapest tour found (6 days, Jiangnan); plain prices that differ per date; statuses `FORMING_A_TOUR` and `TOUR_IS_FORMED`. **Not a true one-or-two-place tour** (it visits Shanghai, Wuxi, Huzhou, Hangzhou, Puyuan); no such Jetour tour was found within the budget. |
| `edge.html` | `/tour/江門,新會,珠海美食純玩之旅` | Empty tour page: no code, no departures (`沒有數據。`), no days, price `HKD 0 +`. A parser should return null. |

Checked: no personal data. The only phone number left is the company's published hotline (`tel:(+852) 3180 9966`); the WhatsApp links, whose addresses carried a prefilled Chinese greeting, are emptied with the other text-carrying attributes. No hand trimming was needed.

Also fetched but not saved: `/tour/TNA` (8 days, six departures from 2026-11-27 to 2027-02-19, all `即將成團`).

## Every URL fetched (10 page fetches; robots.txt not counted)

| # | UTC | URL | Result |
|---|---|---|---|
| – | 22:13:21 | https://www.jetour.com.hk/robots.txt | 200 |
| 1 | 22:13:52 | https://www.jetour.com.hk/sitemap.xml | 200 |
| 2 | 22:16:12 | https://www.jetour.com.hk/tour/THB | 200 |
| 3 | 22:29:37 | https://www.jetour.com.hk/terms-and-condition | 200 (index) |
| 4 | 22:29:41 | https://www.jetour.com.hk/tour/dest/china | 200 (list) |
| 5 | 22:33:23 | https://www.jetour.com.hk/terms-and-condition/post/tour-terms-and-conditions | 200 |
| 6 | 22:35:28 | https://www.jetour.com.hk/tour/TNA | 200 |
| 7 | 22:35:32 | https://www.jetour.com.hk/tour/TSEQ | 200 |
| 8 | 22:35:35 | https://www.jetour.com.hk/terms-and-condition/post/demo-2 | 200 |
| 9 | 22:35:39 | https://www.jetour.com.hk/privacy-policy | 200 (index) |
| 10 | 22:37:37 | https://www.jetour.com.hk/tour/江門,新會,珠海美食純玩之旅 | 200 |

## Practice crawl (Task 19)

`pnpm scrape --operator jetour --dry-run`, run once on **2026-11-13** (Hong Kong), 01:51–02:20 UTC, through `createFetcher` (one fetcher, about 3.5 s per page). No 403, 429, bot challenge, retry or unfetched page.

| | Count |
|---|---|
| Tour pages discovered (sitemap) | 451 |
| Tour pages fetched | 451 |
| Tours saved (to the throwaway database) | 0: the run failed its checks (`too-many-parse-failures`) |
| Parse failures | 312 (69.2%): 311 `no-stops`, 1 `parser returned null` (`/tour/TCPA-1`) |
| Skipped, no upcoming departures | 107 (not failures) |
| Tours that normalised | 32 |

**Cause:** missing places, not the parser. Jetour sells many long-haul tours (Europe, Africa, the Americas, Oceania, the Middle East, Central Asia) and many to Chinese provinces the seed list did not have; their day lines named no known place.

**After extending the places list** (same task, commit `feat(core): extend places list from operator dry runs`): pages were not re-crawled. The dry run prints each page's day headings, so the saved output was re-processed offline with the new list: **1 parse failure in 451 pages (0.2%)**, the `TCPA-1` page the parser rejects; 343 tours would normalise. Estimate only: departures and prices of the 311 former `no-stops` pages are as parsed, but the checks were not re-run against a live crawl. (This estimate proved wrong: most of those pages have no dates on sale, and the fix-round-3 confirmation crawl found 99 pages with dates; see "Confirmation crawl (Task 19, fix round 3)" below.)

Known limits seen in the output:
- **Transit stops.** Long-haul day lines name the connecting city (`途經巴黎轉機`, `經巴黎或阿姆斯特丹轉機`, `香港 ~ 巴黎 ~ 利馬`, `杜邦力夫 伊斯坦堡`), so Paris, Amsterdam or Istanbul appear on routes of tours that only change planes there (23 Latin American tours name a Paris or Amsterdam connection, e.g. `QSB`, `QPD`, `QCC`; some Balkan tours connect in Istanbul, e.g. `EBD`, `BBZEX`). Not a place-list problem; left for the owner.
- **Attractions dominate the unmatched names** (`舊城區`, `大教堂`, `教堂橋`, `獅子紀念碑`...): expected, they stay unmatched.

## Confirmation crawl (Task 19, fix round 1)

`pnpm scrape --operator jetour --dry-run`, run once on **2026-11-13** (Hong Kong), 03:45:28–03:45:41 UTC, through `createFetcher`, with the transit and single-outlier rules, the Ecuador/`notPlaces` data fixes and the CLI fixes in place. No 403, 429, bot challenge, retry or unfetched page.

| | Count |
|---|---|
| Tour pages discovered (sitemap) | **1** (451 in the practice crawl under two hours earlier: it started at 01:51 UTC, this crawl at 03:45 UTC) |
| Tour pages fetched | 1 (`/tour/EID`, a tour not in the practice crawl) |
| Tours that would be saved | 0: the run failed its checks (`no-tours`) |
| Parse failures | 0 (0.0% of 1) |
| Skipped, no upcoming departures | 1 (`EID`) |
| Run checks | **failed** (`no-tours`) |

**Cause:** the sitemap the site served listed a single `/tour/<CODE>` page, and that page has no upcoming departures. Every request succeeded (no fetcher log lines). Not diagnosed further: that would need fetching the sitemap again, and the crawl was run once and not restarted, as the rules require. A truncated response is unlikely: the one tour listed (`EID`) was not among the 451 listed earlier, whereas a cut-off file would have kept the first tours of the old order. The owner should look at `https://www.jetour.com.hk/sitemap.xml` before the nightly run is enabled, and the nightly check `no-tours` will report this if it persists.

Unmatched names (EID only, each on 1 page): 三尖峰, 上城區, 下城區, 乘小火車遊覽, 乘纜車登刀鋒山, 乘纜車登薩索倫戈, 乘船往貝拉焦, 加爾達湖, 卡雷扎湖, 史卡拉城堡, 地道酒莊品嚐佳釀, 多比亞科湖, 多洛米蒂地區, 巴蒂斯蒂廣場, 布拉耶斯湖, 特倫托, 特雷維索, 瓦爾特廣場, 米蘇里納湖, 老廣場, 聖母大殿, 聖瑪達萊娜健行 (22).

**Offline check instead of the sample** (no request made): the practice crawl's 451 printed pages were re-processed with the current code and data: still 1 parse failure (0.2%, `TCPA-1`, parser null). A sample of 40 of those tours found no wrong city from a name collision; the wrong stops left are transit cities named without transit wording (`巴黎 ~ 利馬` on the day after `途經巴黎轉機`; `巴黎 或 阿姆斯特丹 ~ 香港`; `成都/西安` as the flight home), and real stops removed by the single-outlier rule (Kirkenes, Vaduz, Tirano, Vatican, San Marino on otherwise one-country routes). Details in the Task 19 fix-round report.

## Sitemap re-check (Task 19, fix round 2)

One run of a throwaway script through `createFetcher` (same proxy setup as the CLI), **2 requests**: `robots.txt` (read by the fetcher), then `https://www.jetour.com.hk/sitemap.xml` at **2026-11-13 04:26:34–04:26:39 UTC**. No child sitemap exists, so nothing else was fetched. Body saved outside git as `.superpowers/raw-pages/jetour/sitemap-2.xml`.

| | 2026-11-12 22:13 UTC (`sitemap.xml`) | 2026-11-13 03:45 UTC (confirmation crawl) | 2026-11-13 04:26 UTC (`sitemap-2.xml`) |
|---|---|---|---|
| Root element | `urlset` | (not saved) | `urlset` |
| `<loc>` entries | 1,394 | | 1,425 |
| Matching `isTourUrl` | 451 | **1** (`/tour/EID`) | 453 |
| Child sitemaps | none | | none |
| Other paths | `/cruise` 465, `/cruise-tour` 259, `/tour/dest/…` and others | | `/cruise` 496, `/cruise-tour` 259, `/tour/dest/…` |
| `<lastmod>` range | 2026-11-11 05:16 – 2026-11-12 22:01 UTC | | **2026-11-13 03:49:04 – 04:09:53 UTC** |

The tour URL pattern is unchanged (`/tour/<CODE>`): 450 tours are in both full files; `TCPA-1` has gone; `EID`, `EWIB-2` and `EWAI` are new. `discover.ts` needs no change.

**Reading:** every entry of the new file was stamped between 03:49 and 04:10 UTC, i.e. the site rebuilt its sitemap in that window, and the confirmation crawl's fetch at 03:45 UTC caught it mid-rebuild with one tour listed. So the sitemap is **unstable during its rebuilds** (served incomplete for a while), not changed once. When the rebuilds run is not known (the earlier file's newest stamps are around 22:00 UTC, this one 03:49–04:10 UTC).

Consequence for the nightly job (18:17 UTC): if a rebuild overlaps the run, discovery sees few tours. With a previous good run, `checkRun` refuses the run (`tour-count-dropped` below 60%) and yesterday's data stays. On the **first** run there is no previous count, so a partial sitemap whose few tours parse would pass and save only those. (Superseded: a first-run floor, `minExpectedTours`, was added afterwards, so a first run with fewer than 35 tours now fails `below-minimum`; see "Sitemap rebuilds (for the owner)" below.) Open for the owner: run the first real scrape by hand and check its tour count, or retry later in the night.

No confirmation dry run was made this round: discovery did not need a fix, which was the condition for one.

**Route rules narrowed in fix round 2** (offline, practice-crawl headings): the single-outlier removal now applies only to names on `collisionNames` (`塔林`, `黃金海岸`), so Kirkenes, Vaduz, Tirano, the Vatican, San Marino and Rovaniemi are back on 19 routes; a transit word now drops only its whitespace-delimited chunk, so Rio stays on `QPE`. 26 routes changed against fix round 1 (23 from the two rules, 3 from `蘇州河` below); still 1 tour page without stops (`TCPA-1`, parser null). Known limits: hubs named plainly (`巴黎 ~ 利馬`, `巴黎或阿姆斯特丹 ~ 香港`, `成都/北京`, `香港 ~ 廣州 ~ 阿拉木圖`), and hubs a space away from `轉機` (`途經巴黎 轉機` on QSG, QSC; `經巴黎 或 阿姆斯特丹 轉機` on QTCRR, QTDR). New `notPlaces` entry `蘇州河` (Suzhou Creek, Shanghai; TSSKQ, TSDQ, TWAQ, TSSHQ).

## Pages with no dates: confirmed by the owner (2026-11-13)

The owner checked the live site: Jetour shows only about 102 tours as on sale, which matches the 99 pages with dates found by the confirmation crawl. A tour page with no departure dates (`沒有數據。`) is a tour that is not currently running, not a page whose dates load some other way. Skipping those pages is correct. The owner also checked the three `expected.json` files for Jetour and the three for Travel Expert against the live pages on the same day; all six are marked `"verifiedByOwner": true`.

## Sitemap rebuilds (for the owner)

Jetour rebuilds `sitemap.xml` from time to time and serves it incomplete while it does:
- 2026-11-12 22:13 UTC: complete (451 tour pages; newest `<lastmod>` 22:01 UTC);
- 2026-11-13 01:51 UTC: complete (the practice crawl discovered 451);
- 2026-11-13 03:45 UTC: **one** tour page listed (the confirmation crawl of fix round 1);
- 2026-11-13 04:26 UTC: complete again (453 tour pages; every `<lastmod>` between 03:49:04 and 04:09:53 UTC, i.e. a rebuild in that window).

The rebuild schedule is not known. A nightly run that lands inside a rebuild discovers too few tours and **fails its checks, keeping the previous night's data** (`tour-count-dropped` when there is a previous good run; `below-minimum`, a floor of 35 tours, when there is none). The nightly job then fails and GitHub emails the owner; the next night normally succeeds. **Start the first real scrape by hand** (`workflow_dispatch`) and check its tour count in `scrape_runs` before relying on the schedule.

## Confirmation crawl (Task 19, fix round 3)

`pnpm scrape --operator jetour --dry-run`, run once on **2026-11-13**, **04:41:09–05:10:00 UTC (28 min 51 s)**, through `createFetcher`, with the first-run floor then set at `minExpectedTours: 150` (since lowered to 35, see below). No 403, 429, bot challenge, retry or unfetched page.

| | Count |
|---|---|
| Tour pages discovered (sitemap) | 453 |
| Tour pages fetched | 453 |
| Pages whose tour normalises | 99 |
| Tours that would be saved if the checks passed | **98**: `/tour/EIMz` and `/tour/EIMM` both state the tour code `EIMM`, so the later one is skipped as a duplicate (`duplicate tour code EIMM, keeping the first`), on every run |
| Pages with no upcoming departures | 353 (`沒有數據。` in the booking table; skipped, not failures) |
| Parse failures | **1 (0.2%)**: `/tour/EWIB-2`, parser returned null |
| Run checks | **failed** (`below-minimum`): 98 is under the floor of 150 |

**The floor of 150 is too high for Jetour.** It was set from pages listed (≈453), but most listed tours have no dates on sale: 107 pages in the practice crawl and 353 now. The round-1 estimate of "343 would normalise" counted the 311 former `no-stops` pages as normalising without their departures being checked; 244 of them have none. A third of the 98 tours that normalise (99 pages, one a duplicate code) is **33**; a floor of about **35** would be the equivalent of the Travel Expert floor (40 against 112). Reported to the controller, who ruled the floor becomes **35**; changed after this crawl (`minExpectedTours: 35`), so 98 tours would now pass the floor.

Top 30 unmatched names (pages each appeared on; 3,296 distinct): 舊城區 58, 大教堂 46, 自由購物 32, 古城區 31, 教堂橋 27, 獅子紀念碑 27, 市政廳 25, 舊城廣場 24, 聖誕老人村 23, 哈士奇雪橇犬場 22, 帝王蟹之旅 22, 查理斯橋 22, 聖家大教堂 22, 凱旋門 21, 百水公寓 21, 國會大廈 20, 聖維特教堂 20, 荷夫堡 20, 賽里木湖 20, 離船 20, 黃金小徑 20, 主教堂 19, 太湖珍珠館 19, 米拉之家 19, 紫砂博物館 19, 航海紀念碑 19, 梅家塢茶園 18, 西班牙廣場 18, 面譜屋 18, 哥倫布廣場 17. Attractions only: no missing city among them.

Sample of 40 of the 98 tours, routes compared with their headings: one wrong city, **KMA (and KMC) 艾佛德 (Erfoud) from `艾佛德神學院`**, a madrasa in Fes (`費斯 ~ 古城區 ~ 艾佛德神學院 ~ 費斯皮革染坊`), which put Erfoud between two Fes stops. Fixed after the crawl with the `notPlaces` entry `艾佛德神學院` (test: Erfoud itself still reads). The rest are the accepted transit limits: Paris/Amsterdam named plainly on QUAK (`巴黎 ~ 利馬`, `利馬 ~ 巴黎`), QMB (`巴黎 ~ 墨西哥城`, `巴黎 或 阿姆斯特丹 ~ 香港`), QTCRR and QTDR (`經巴黎 或 阿姆斯特丹 轉機`).
