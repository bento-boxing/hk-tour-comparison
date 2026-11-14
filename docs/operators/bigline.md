APPROVED 2026-11-13: owner approved the nightly use of the tenantCode header and the monthly dates request (next 3 months)

DATES AVAILABLE WITH ONE STATIC HEADER AND A MONTHLY POST (`api.biglinehk.com` answers with data when sent the fixed site key `tenantCode: DH`, and nothing else beyond our User-Agent; each month's departure dates and per-date prices come from one POST, made for at most the first 3 listed months from the current Hong Kong month)

# Big Line Holiday 大航假期 (`bigline`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`). Task 14 pages were fetched 2026-11-12 22:13–22:34 UTC; Task 14b requests were made 2026-11-13 00:03–00:11 UTC; the Task 14c probe ran 2026-11-13 20:46–20:55 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **9 of 10** in Task 14. In Task 14b: **5 of 10** (3 script files on `bigline.hk` and 2 API calls on `api.biglinehk.com`), plus that host's robots.txt. In Task 14c: **7 of 12** requests to `api.biglinehk.com`, robots.txt included. In Task 17 (fixtures): **8 of 10** requests to `api.biglinehk.com`, 2026-11-13 22:01–22:07 UTC (see "Fixtures").

## Recommendation

**PROCEED, on three conditions for the owner.** The three reasons for the earlier HOLD are gone:

1. **The API answers with one static header.** With `tenantCode: DH` added (no device id, no device type, no cookie, no token), every request was answered with data (`"code":200`). `DH` is a fixed value written into the site's public JavaScript and page state (`apiHostCode: "DH"`). It is the same for every visitor and identifies the site, not a person or a device.
2. **The dates and per-date prices are reachable.** `POST /bigline/global/product/release/page` with the site's own JSON body returned every departure of the month with its date, prices and seats left. `createFetcher` now has `postJson`. A POST goes through the same robots.txt check, queue, 3 s spacing and pushback rules as a GET, and it is never retried.
3. **The terms were read, and nothing in them stops us.** The user agreement, the privacy policy and the member agreement have no clause on automated access, robots, crawling, scraping, copying or reproduction. They also have no personal or non-commercial use limit. The nearest clauses are quoted under "Terms" below. The footer still says `All rights reserved`. We would copy facts (dates, prices, day count, gathering point), not text.

The conditions:

- **A standing approval for the header and the POST.** The owner approved them for this probe only. A nightly scraper would send `tenantCode: DH` and one POST per month on every run.
- **The nightly cost does not fit as it stands.** One tour needs 1 detail GET plus 1 POST per month it has departures in. Tour 9109 has 8 months, so it needs 9 requests. If all 586 sitemap tours were like that, a night would take 5,274 requests, about 4 h 24 min at 3 s each (plus response time). The nightly job's limit is 170 minutes. A horizon of the next 3 months would make it 586 × 4 = 2,344 requests, about 1 h 57 min plus response time. That fits, but tightly. How many months the other tours have was not measured (see "Nightly cost").
- **The API returns internal and personal data along with the public facts.** Examples: a tour leader's full name (`data.list[].tourLeader[].guideName`), staff sales notes (`internalSaleRemark`: a short staff sales note about how a departure is selling), supplier names and supplier cost prices, and leader subsidies. The scraper must keep only the public facts listed under "Where each fact is in the API". Any fixture must be trimmed down to those facts. The raw probe responses stay under `.superpowers/` and should be deleted once the fixtures are made (Task 17 made them; the orchestrator deletes the raw answers).

The plan's note that the data is in embedded page state (`__NUXT__`) is no longer true: the embedded state now carries only SEO fields.

## Owner decision (2026-11-13, standing approval for the scraper)

The owner approved the three conditions above:

- **Standing approval.** Each night the scraper may send `tenantCode: DH` (and `Content-Type: application/json` on the POST) with our honest User-Agent `tour-comparison-bot/0.1`, to `api.biglinehk.com` only. No `X-Device-Id`, `X-Device-Type`, cookies, Referer, Origin or anything else. If the API ever refuses (JSON `code` 401, HTTP 403/429, or a block page), the tour counts as not fetched; nothing is escalated or varied.
- **Months.** For each tour, dates are requested for at most the next 3 calendar months that the detail's `availableMonths` lists, starting from the current Hong Kong month: 0 to 3 POSTs per tour. A tour with no listed month from the current one on gets no POST and is skipped as `no-departures`, even when its route matches no place (`normaliseTour` checks for upcoming departures before it checks the route, so a tour with nothing to book is never a parse failure). 3 is the constant `MAX_MONTHS_PER_TOUR` in `packages/scraper/src/operators/bigline/fetch-page.ts`.
- **Only public facts are read:** tour code, title, days, day route lines, gathering place, "from" price, departure dates, per-date price and the full markers. Never tour-leader names, `internalSaleRemark`, supplier names, cost prices or any other field.

How the scraper keeps to it (Task 17):

- The header is declared once, as `requestHeaders` on the Big Line scraper (`{ 'api.biglinehk.com': { tenantCode: 'DH' } }`). The CLI makes the run's fetcher with the running operator's headers only, and the fetcher sends them only to a request to exactly `https://api.biglinehk.com` (that host, over `https://`, on the default port): never over `http://` or another port, never on robots.txt, never to `bigline.hk`, never to another host a redirect leads to. A POST is never retried or redirected.
- "The next 3 months" is read as the first 3 months **listed** in `availableMonths` from the current month on (a gap in the list does not use one up), earliest first. Each month must be `YYYY-MM` and each id digits before it goes into a URL or body.
- Every answer passes through an allow-list (`public.ts`) before anything else sees it: only the fields under "Where each fact is in the API" are kept, rebuilt key by key, and each day's route line is cut down to its short chunks (see "Day route lines"). So names, notes, suppliers and costs never reach the parser, the logs or the database; a test runs the whole pipeline over answers full of such fields and checks.
- A JSON `code` other than 200 (inside HTTP 200) fails that tour, logged with the code only (never the API's message). One exception: a detail answering code 500 with exactly the message `404 NOT_FOUND` means the sitemap's tour no longer exists; it is skipped as `gone` (logged like other skips, left out of the pages the fetch-failure rate is taken over, not a refusal). After 10 gone answers in a row nothing more is requested (the endpoint may have changed), so the rest of the tours fail as not fetched and the run fails its checks.
- Refusals are counted separately for the detail GET and for the dates POSTs, each count started again only by a success of its own kind (so a good detail cannot hide refused POSTs). A refusal is no answer at all (the fetcher gave up, which includes HTTP 401/403/429; a POST is sent once), a JSON code 401/403/429/503, a JSON answer with no code, or a 200 answer that is not JSON. When either count reaches three in a row, nothing more is sent for the night, like the fetcher's own pushback rule for HTTP 403/429/503.
- The months are counted from the run's own date in Hong Kong (the date the run is recorded under), not the wall clock.

## Owner decision (2026-11-13, the probe)

The owner explicitly authorised one staged probe of `api.biglinehk.com`, and nothing beyond it. The steps were to be done in this order, stopping at the first failure:

1. **Terms first**: `GET /bigline/global/protocol/center?protocolId=1` with the one extra header `tenantCode: DH`. The brief allowed one retry with `X-Device-Type: Web` and an `X-Device-Id`. **The owner withdrew that retry during the task, before any request was sent:** no device header was to be sent at all, and a refusal of `tenantCode` alone meant stop. A block page, captcha or rate limit, or HTTP 403/429, also meant stop.
2. **Read the terms**: at most 3 documents, plus the listing call once if needed. A clause prohibiting automated access, scraping or reproduction meant stop all fetching (HOLD). A personal or non-commercial use limit was to be recorded and flagged.
3. **One tour detail**: `GET /bigline/global/product/tour/frontend/detail?id=9109` with the smallest header set that worked.
4. **One dates request** (at most 2 POSTs, for two different months): `POST /bigline/global/product/release/page` with the site's JSON body, the same headers, plus `Content-Type: application/json`. Then stop. No listing or crawl calls.

Rules for every request: our honest User-Agent, robots.txt obeyed, one request at a time at least 3 s apart, all through `createFetcher`, a hard cap of 12 requests. Not allowed: cookies, browser-like headers (Referer, Origin, Accept-Language, `sec-*`), login, or a token from any user session. This was permission to probe, not approval of the operator.

## Task 14c probe: what was sent and what came back

Each request was logged to `.superpowers/raw-pages/bigline/ledger-probe.tsv`, and each raw response was saved beside it as `probe-*.json` (git-ignored). The probe script is outside the repository. Each request carried `user-agent: tour-comparison-bot/0.1`, plus undici's defaults (`accept: */*`, `accept-language: *`, `sec-fetch-mode: cors`, `accept-encoding`), and only the extra headers listed below. No cookie, Referer, Origin, Authorization, `X-Device-Id` or `X-Device-Type` was sent at any point. Nothing was retried.

| # | UTC (2026-11-13) | Method and URL | Extra headers | HTTP | JSON `code` | Bytes |
|---|---|---|---|---|---|---|
| 1 | 20:46:26 | GET https://api.biglinehk.com/robots.txt | none | 200 | 500 (`404 NOT_FOUND`: no robots.txt, everything allowed, as in Task 14b) | 34 |
| 2 | 20:46:32 | GET …/bigline/global/protocol/center?protocolId=1 (user agreement 用戶協議) | `tenantCode: DH` | 200 | **200** | 14,412 |
| 3 | 20:48:15 | GET …/bigline/global/protocol/center?protocolId=2 (privacy policy 隱私政策) | `tenantCode: DH` | 200 | 200 | 38,851 |
| 4 | 20:49:57 | GET …/bigline/global/protocol/center?protocolId=8 (member agreement 會員服務協議) | `tenantCode: DH` | 200 | 200 | 18,330 |
| 5 | 20:50:32 | GET …/bigline/global/product/tour/frontend/detail?id=9109 | `tenantCode: DH` | 200 | 200 | 73,823 |
| 6 | 20:53:15 | POST …/bigline/global/product/release/page, body `{"pageNo":1,"productId":"9109","yearMonth":"2026-12","pageSize":1000}` | `tenantCode: DH`, `Content-Type: application/json` | 200 | 200 | 104,041 |
| 7 | 20:54:33 | POST …/bigline/global/product/release/page, body `{"pageNo":1,"productId":"9109","yearMonth":"2026-11","pageSize":1000}` | `tenantCode: DH`, `Content-Type: application/json` | 200 | 200 | 60,025 |

- **Step 1.** `tenantCode: DH` alone was enough, so the minimal header set is that one header. The retry with device headers was neither needed nor sent. No block page, captcha, rate limit, 403 or 429 was seen at any step.
- **Step 2.** The listing call was not needed. Every `protocol/center` answer carries `data.typeList`, the list of all 9 documents: 1 用戶協議 (user agreement), 2 隱私政策 (privacy policy), 3 旅行團報名及細則 (tour booking terms), 4 旅遊保險 (travel insurance), 5 簽證須知 (visa notes), 6 旅客須知 (traveller notes), 7 惡劣天氣團隊安排說明 (bad-weather arrangements), 8 會員服務協議 (member agreement), 9 註銷服務協議 (account closing). Three were read: 1, 2 and 8. The other six are about booking, travelling and accounts.
- **Step 3.** The detail came back in full (fields below).
- **Step 4.** The body follows the site's JS. The tour component calls the release API with `{pageNo: 1, productId, yearMonth}`, and the API function adds `pageSize: 1000`. `productId` is the route id as a string (`/tour-group/9109` → `"9109"`). When there is no route id, the JS uses the detail's `productId` (here `null`) and then its `id` (here `9109`), so the value is the same. `yearMonth` is `YYYY-MM`, taken from `availableMonths`. Two months were asked for. December had no full departures, so November (the current month) was asked for second, to see what a full date looks like. Fetching stopped there: 5 of the 12 allowed requests were left unused.

## Terms (read 2026-11-13 from `protocol/center`)

None of the three documents read has a clause on automated access, robots, crawling, scraping, copying or reproduction. None has a personal or non-commercial use limit either. These are the only clauses that come near those topics (short quotations, with an English gloss):

- User agreement, 3.2(6): 「不得利用本網站侵犯本公司、第三方供應商或其他用戶的合法權益（包括但不限於知識產權、名譽權、隱私權等）」: users must not use the site to infringe the lawful rights of the company, its suppliers or other users, including intellectual property, reputation and privacy. Listing facts with a link is not that. The personal data the API returns (above) must not be republished, which is also what this clause protects.
- User agreement, 4.1(2): 「有權對用戶的註冊信息、使用行為進行審核、監測，對違反本協議、法律法規或惡意使用服務的用戶，有權採取警告、限制賬號功能…等措施」: the company may review and monitor how users use the site, and may act (warnings, account limits and so on) against users who break the agreement or use the service maliciously. This is aimed at accounts. We have none.
- User agreement, 7.6: 「因網絡傳輸延遲、數據緩存等原因導致本網站展示的產品信息（如價格、庫存等）出現臨時錯誤，本公司有權更正該信息」: prices and availability shown on the site may be briefly wrong, and the company may correct them. Our "check with the operator" wording covers this.
- Privacy policy, opening: 「任何人士如瀏覽本平台，即表示已閱讀、理解並接納本聲明之內容及同意受其約束」: anyone who browses the platform accepts this statement. The statement is about personal data and cookies, and has nothing on automated access.
- The privacy policy refers to 「我們的 Cookie 條款與條款及細則」 ("our cookie terms and terms and conditions"). No separate website terms and conditions appear among the 9 documents in `typeList`. The cookie terms are part of the privacy policy. **Not verified:** whether a website T&C exists somewhere else. The footer of `bigline.hk` links two documents: 《用戶協議》 (`protocolId=1`) and 《隱私政策》 (`protocolId=2`), both read.
- The member agreement (8) is about the loyalty points scheme only. Nothing in it is relevant.

## Where each fact is in the API (observed in Task 14c)

Detail: `GET /bigline/global/product/tour/frontend/detail?id=<id>` → `data`. Dates: `POST /bigline/global/product/release/page` → `data.list[]`, one entry per departure, plus `data.total`, `data.pageNum` and `data.pageSize`.

| Fact | Path | Example (tour 9109) |
|---|---|---|
| Tour id | detail `data.id`, the same as the sitemap id; dates `data.list[].productId` | `9109` |
| Tour code | detail `data.basic.tourNo`; dates `data.list[].tourNo` | `CSIAA06` |
| Title | detail `data.basic.nameCn`; dates `data.list[].nameCn` | `【純玩•西安】（提升2+1旅遊巴及粵語導遊） 西嶽華山 … 直航6天` |
| Days | detail `data.basic.tourDays`; dates `data.list[].tourDays` | `6` |
| Nights | **not in either response.** The top-level `data.durationNights` and `data.durationDays` are `null`. | – |
| Day headings | detail `data.projectItinerary.dailyTripList[]`: `.days` (day number) and `.tripContent` (the route, places separated by `~`, with a leading `.`) | day 1 `.香港機場集合~西安機場~入住酒店` |
| Start / gathering point | detail `data.signUp.locationGroupList[].locationName` and `.startTime`; per departure `data.list[].departurePlace[].locationName` and `.startTime`. Top-level `data.gatheringPlace` is `""`. | `香港國際機場`, start time `待定` (to be confirmed) |
| "From" price | detail `data.memberFee` (`data.basic.memberFee` is `null`). The front end shows `memberFee` with 「起」 ("from"). `adultFee` is $10 higher. | `5799` (HKD: `data.signUp.settlementCurrencyCode`) |
| Months with departures | detail `data.availableMonths` (`YYYY-MM`) | `2026-11` … `2027-06` (8 months) |
| Departure dates | dates `data.list[].scheduleDate` (`YYYY-MM-DD`). **Past dates are included**: the November answer had 11-04 and 11-11, before the capture date 11-13. | 7 in 2026-12, 4 in 2026-11 |
| Per-date price | dates `data.list[].memberFee` (also `adultFee`, `childFee`, `babyFee`; numbers such as `6899.0`; `currencySymbol` is `null`) | 12-01 `5799.0` … 12-25 `6899.0` |
| Full | observed together on all 3 full departures (2026-11-04, -11, -22): `seatRemain: 0`, `soldTotal` equal to `maxPersonTotal`, `registrationStatus: 1` and `tourFlag` containing `5` (`"1,2,5"`). Open departures had `seatRemain` 3–20, `registrationStatus: 0`, and no `5` in `tourFlag`. The front end's own "已滿" (full) test is the function `ot` in chunk `/_nuxt/C8-td2ew.js`. That chunk was not fetched, so the exact rule is **not verified**. **The scraper takes the conservative reading:** a departure is left out when ANY of those markers is present, when `seatRemain` is missing, or when `isCutofftour` is true. | |
| Closed / cut off | `data.list[].isCutofftour` was `false` on all 28 departures seen (Task 14c and 17); no closed departure was seen. `tourStatus` was `"1"`, `"2"` or `"3"`; `"3"` came with `releaseStatusDaily: "快成團"` ("nearly confirmed"), `"2"` with `""`. What the values mean is **unknown**, and the scraper does not read them. | |
| Guaranteed departure | `data.list[].releaseStatusDaily`: `"已成團"` ("tour confirmed"), `"快成團"` ("nearly confirmed") or `""`. Not read. | |

### Day route lines

`tripContent` is one line per day written by staff, in several styles: places joined by `~` with a leading `.` (9109), by ` | ` (8923), by `|` after a `D1 ` day marker with a prose second line (22042), or by `--` with a sentence or more of description after each place and `#註：…` notes on later lines (624469). The parser (and the allow-list, which stores the same result) reads: the first line with text; without a leading day marker (`D1：`, `第1天：`, `Day 3 -`: the shared `DAY_MARKER` from `packages/core/src/stops.ts`, stripped first so its colon does not cut the first place, and again after the notes are removed, for `(早餐)D2 酒店`); without notes in round brackets (either width, mixed, nested) or `〈…〉`; split at `~ ～ | ｜ →` and runs of two or more hyphens; each chunk cut at its first sentence mark (`，。；！？：;:!?` and the ASCII comma, which in the crawl of 2026-11-14 always separated prose: all 35 chunks with one were sentences), leading `.`/`-` and extra spaces removed; then, within each chunk, the pieces the shared rules split a heading at (`CHUNK_SEPARATORS`: `、`, `-`, `—`, `>`, spaces …) that are over 16 characters are left out as descriptions (`MAX_PIECE_CHARS`), the rest of the chunk kept as written; finally a chunk over 40 characters is left out whole (`MAX_CHUNK_CHARS`: 37 of the crawl's 9,613 chunks, all long lists of sights or descriptions such as `黃帝開太平 問天石 軒轅雲道 - 山上自助午餐 - 始信峰 …`). Re-processing the crawl with the comma and 40-character rules changed 12 routes, mostly dropping false matches (北海 in 北海景區, 桃園, 棉花堡, 巴黎), and lost 北極村 (22006) and 松島 (20005), both inside long lists. So `東京、橫濱、鎌倉、箱根、富士山五合目` is kept whole, Latin words are counted one by one (`Maya shopping mall瑪雅購物中心`), and `中華文明發源地 素有"奇險天下第一山"之稱【華山】` keeps only `中華文明發源地`. The day heading is the chunks joined with ` → `; a heading can be longer than 80 characters when a day lists many short places. A page the parser rejects is logged with a fixed reason (`readTour` in `parse.ts`). Route extraction then uses the shared rules unchanged.

**Do not take** these fields: `tourLeader`, `guideLeader`, `internalSaleRemark`, `internalRemark`, `agencySupplier`, `projectItinerary.projectItineraryList` (supplier names and cost prices), `extraCost`, `salesCommission`, `soldTotal`/`soldCount` beyond the full test, `departureFlightTime`/`returnFlightTime` (staff-typed text), or `reservationPolicies` (long terms text).

## Practice crawl (2026-11-14) and the places pass

**OWNER DECISION NEEDED** (both points below): how to fit Big Line into the nightly job, and what to do about the tours whose day lines name no place. Big Line is registered (first-run floor 126) but **not in the nightly matrix**.

### What the crawl measured

One full dry run, `pnpm scrape --operator bigline --dry-run`, 2026-11-14 00:30:43Z to 03:02:32Z: **152 minutes** (9,109 s), against the nightly job's 170-minute limit. Log: `.superpowers/raw-pages/bigline/dry-run-1.log` (git-ignored).

| | |
|---|---|
| Tour pages discovered / fetched / not fetched / gone | 587 / 587 / 0 / 0 |
| Refusals | 0 (no JSON 401/403/429, no HTTP pushback) |
| Normalised (would have been saved) | **380** |
| Skipped, no upcoming departures | 12 |
| Parse failures | **195 (33.2%)**: 193 `no-stops`, 2 `parser returned null` (19259, 19261) |
| Run checks | failed, `too-many-parse-failures` (limit 20%) |
| Distinct unmatched names | 2,447 |

The first-run floor is a third of the 380 normalised, rounded down: **126**.

**Requests and duration (estimates).** The fetcher logs no line per request, so the number of POSTs is not in the log; it is inferred. Fixed: 587 detail GETs and about 4 other requests (the bigline.hk sitemap index and child, two robots.txt). Each of the 575 tours with upcoming departures sends 1 to 3 POSTs. At 3 POSTs each the night is about **2,352 requests**, which over 9,109 s is **3.9 s per request** (the 3 s spacing plus about 0.9 s of response, which is plausible); at an average of 2.5 POSTs it would be about 2,060 requests at 4.4 s (a response time of 1.4 s, less likely). So most tours used the full 3 months.

| Months of dates requested per tour | Requests a night (estimate) | Duration (estimate) |
|---|---|---|
| 3 (now) | ≈ 2,350 | 152 min (measured) |
| 2 | ≈ 1,700–1,770 | ≈ 114–128 min |
| 1 | ≈ 1,170 | ≈ 76–86 min |

The ranges come from the unknown POST count and response time above. Fewer months means fewer departures shown: with 1 month only the current month's dates are offered (none at all late in a month for many tours); with 2, dates up to the end of next month.

### The 193 `no-stops` pages

Classified from the logged day headings (re-read through the current route rules, which turn 2 of the 12 no-departures pages into no-stops too):

| Class | Pages | What the day lines hold | Rescued by the places pass |
|---|---|---|---|
| Guangdong / Greater Bay coach tours (codes `C` + digits, 2 `BT`), mostly from the Shenzhen crossings | 129 | meals, hotels, hot springs, KTV, sights; the town is in the title, or only inside a dish name in 【】, which the shared rules drop | 7 |
| Empty headings | 42 | every day's route line comes out empty (38) or there are no days (4) | 0 |
| Cruises (`LD…`, `JPNGL10`) | 16 | every day `停靠港` ("port of call"), or arrival and departure times | 0 |
| Missing places | 4 | Papua New Guinea (624046), Jordan (624004), Java (20767), Nepal (12187) | 4 |
| Placeholder | 2 | every day `行程` ("itinerary"): 15495, 12206 | 0 |

**Title-only class (for the owner).** About **140 tours** (122 coach tours still without a stop, 16 cruises, 2 placeholders) name their destination nowhere in the day lines that core reads. Of the 122 coach tours, 52 name a place only inside brackets, nearly always a dish (`【中山石岐黑金乳鴿宴】`, `【台山滋味五味鵝宴】`, `【陽江…】`, `【順德…】`); about 70 name none at all (C25125A: `午餐【五味鵝特色美食宴】 → 圭峰山賞一年一度櫻花美景 → 入住酒店`; C38637: `溫泉 → 入住酒店 → 晚餐【酒店自助晚餐】`). Core's "day headings only" rule is unchanged; reading the destination from the title (or from dish names) is the owner's decision. **Not verified:** the titles are not in the log, so that each title names the destination is assumed from the tour type, not checked.

**Empty-heading class (not verified).** Every route line of 42 tours comes out empty (e.g. 19651 CKMG06TC, 19482 CKMG08L, Yunnan tours). The cause cannot be told without the raw answer: either `tripContent` is blank for those tours, or each day's first line is one unbroken run over 16 characters (no separator), which the rules leave out as a description. One detail request for one of them (with the owner's approval) would settle it.

**Parser failures 19259 and 19261.** No raw answer was kept and the log only says "parser returned null", so the cause is not known. The parser now logs a fixed reason for every page it rejects (`readTour`), so the next crawl will say which check failed.

### Places pass (`packages/core/src/places/data.json`)

New countries: Jordan (middle-east), Papua New Guinea (oceania), Nepal (south-central-asia), Zambia (africa); new region Java (Indonesia). 56 new cities (Jordan 6, Nepal 6, Papua New Guinea 4, Java 3, Zambia 1; Narvik; Europe 9; Kyrgyzstan, Langkawi, Negombo, Waitomo, São Paulo; China 15 and Guangdong towns 6: 小欖, 高明, 橫琴, 四會, 新豐, 陸豐), aliases added to 35 existing entries for spellings the crawl uses (奥斯陸-style variants, 那維克, 索蘇斯 for Sossusvlei, 汶莱, 清莱, 芭提雅 …). Every new name was swept with the matcher over every logged heading (Big Line, Charming, EGL) and every unmatched name (all operators, Jetour and Travel Expert included), before and after, and each changed item was read. 25 notPlaces and 2 collision names were added from the sweep and its review: 聖保羅 as a collision name plus 聖保羅大教堂/教堂/醫院/舊城 (St Paul's in Melbourne and Malacca, Sant Pau, Saint-Paul-de-Vence), 加勒菲斯 (Galle Face, Colombo), 孟菲斯, 臥龍潭/灣/峽谷/書院/崗/寺, 普洱茶, 新北海賓館, 高山 as a collision name plus ten 高山… phrases, and 埃沃內斯機場 (Evenes as a flight leg; as a stop it stays). No Jetour, Travel Expert, EGL, Charming or Big Line expected value changed.

**After the pass (estimate, offline).** Re-processing the logged headings through the current rules and places list: **391 tours saved, 184 parse failures of 587 (31.3%)**, 12 skipped. Still above the 20% limit and the 10% target: the remaining failures are the classes above (heading content), not missing places.

## Discovering tours and nightly cost

**Tour ids** come from the sitemap: `https://bigline.hk/sitemap-1.xml` lists 586 `https://bigline.hk/tour-group/<id>` URLs, out of 691 URLs in all. `<id>` is the `id` the detail endpoint takes. The site also has a GET tour listing (`/bigline/global/product/tour/frontend/page`). It was not called, so what it returns is unknown.

**Requests per tour per night:** 1 detail GET, plus 1 POST for each month in `availableMonths`. Tour 9109 needs 1 + 8 = 9. One sample does not give the average for all tours. Tours that are no longer sold may have no months: they would need just the detail call, or they may be gone from the API.

**Task 17 update.** The sitemap's ids have 4 digits (4 of 586), 5 digits (284) or 6 digits (298); a 6-digit id (624469) answers the same detail request as a 4-digit one. Of the 4 tours sampled, 3 had months listed (9109: 8, 8923: 4, 624469: 4) and 1 had none (22042, a 15-day Nordic tour, `availableMonths: []`, `memberFee: null`). With the owner's 3-month horizon a tour costs 1 + at most 3 requests: at most 586 × 4 = 2,344 a night, about 1 h 57 min at 3 s each plus response time, inside the 170-minute job. Not measured: the real total, until the measured crawl.

| Assumption | Requests per night | At 3 s each (plus response time) | Fits the 170-minute nightly job? |
|---|---|---|---|
| Sitemap fetch only (index + 1 child) | 2 on `bigline.hk` | – | – |
| 586 tours × 9 (every tour like 9109) | 5,274 | 4 h 24 min | **no** |
| 586 tours × 4 (detail + the next 3 months only) | 2,344 | 1 h 57 min at 3 s each; **measured 2026-11-14: 152 min** with response times (see "Practice crawl") | only just (152 of 170 minutes): owner decision |
| 586 tours × 2 (detail + the current month only) | 1,172 | 59 min | yes |
| all 691 sitemap URLs × 9, if non-tour pages were also counted | 6,219 | 5 h 11 min | no (only the 586 tour URLs are needed) |

Ways to cut the cost, none of them tried: a months horizon; skipping a tour's POSTs when its detail shows no `availableMonths`; or spreading tours across nights.

## Owner decision (2026-11-12)

The owner permitted reading the data host `api.biglinehk.com`: its robots.txt first, and the API itself only if robots.txt allows the paths needed. Both were done (below). This was permission to look, not approval of the operator; Big Line is not approved.

## robots.txt (`https://api.biglinehk.com/robots.txt`, read 2026-11-13 00:03:38 UTC)

The response was HTTP 200 with `Content-Type: application/json` and this body, verbatim (34 characters, no trailing newline):

```
{"code":500,"msg":"404 NOT_FOUND"}
```

The host has no robots.txt: its API framework answers the path with a "not found" error. `createFetcher` parsed the body as a robots.txt with no rules, so it allowed every path, which is the same result as a 404 ("no restriction from robots"). Note that this API reports errors inside the JSON `code` field, not in the HTTP status.

## The API (read from the site's own JavaScript)

**Base URL** `https://api.biglinehk.com/`, from `window.__NUXT__.config.public.appBaseApi` and hard-coded in the request client `/_nuxt/Bk0Y8-wa.js`. Paths are joined to it without their leading `/`.

**What the site's request client sends** (`/_nuxt/Bk0Y8-wa.js`, the `onRequest` hook of its `$fetch` instance):
- on every request: `Content-Type: application/json` (unless the body is form data), `tenantCode: DH`, `X-Device-Id: <id>` and `X-Device-Type: Web`;
- `Authorization: Bearer <token>` only when a user is logged in (the token is kept in `localStorage`);
- the request option `credentials: "include"`, so the browser also sends any cookies;
- no signature, timestamp or nonce. The RSA keys in the page state are used only for login.

The device id is generated in the browser as `web_` plus `crypto.randomUUID()` without dashes (falling back to `web_<time>_<random>`; `web_ssr` during server rendering) and kept in `localStorage` as `bl_web_device_id`. `DH` matches `apiHostCode: "DH"` in the page state.

**Endpoints the tour page uses** (`/_nuxt/DCBnc137.js`, called from the tour detail component `/_nuxt/DJSmirVR.js`):

| Purpose | Method and path | Parameters | Called? |
|---|---|---|---|
| Tour detail (title, tour number, `availableMonths`, gathering points `signUp.locationGroupList`, days `projectItinerary.dailyTripList`) | `GET /bigline/global/product/tour/frontend/detail` | `?id=<numeric id from /tour-group/<id>>` or `?tourNo=<code>` | **yes, once** (`id=9109`): `{"code":401,"msg":"未授权"}` |
| Departure dates and per-date prices for one month | **`POST`** `/bigline/global/product/release/page` | JSON body `{pageNo: 1, productId, yearMonth: "YYYY-MM", pageSize: 1000}` | no (POST) |
| Seats and rooms for one selected departure | `GET /bigline/global/product/tour/frontend/get-bookseat-jointour/<departure id>` | the id comes from the month list above | no (needs the POST's result) |
| User agreement / privacy text | `GET /bigline/global/protocol/center` | `?protocolId=<id>` (the footer's `《用戶協議》` link uses `1`); without a parameter it lists the agreements | **yes, once** (`protocolId=1`): `{"code":401,"msg":"未授权"}` |

The field names in the first row are what the front-end code reads from the detail response. They were not observed in Task 14b, because the API returned no data. Task 14c observed them (see "Where each fact is in the API"); the detail and dates rows above were called then with `tenantCode: DH`. The same chunk also has a GET tour listing (`/bigline/global/product/tour/frontend/page`) that the tour page does not use. It was not called, and its contents are unknown.

No fixtures were saved: no tour data was returned.

## robots.txt (`https://bigline.hk/robots.txt`)

```
User-agent: *
Allow: /

Sitemap: https://bigline.hk/sitemap.xml
```

## Tour pages in the sitemap

`https://bigline.hk/sitemap.xml` is an index with one child, `https://bigline.hk/sitemap-1.xml` (691 URLs). Tour pages: **`https://bigline.hk/tour-group/<numeric id>`: 586.** Others: `/free-travel/package/<id>` 50, `/travel-note/<id>` 35, `/activity/page/<id>` 8, `/destinations/<name>` 7, plus single pages. The app's router also has `/tour-group/cruise/:id`, but the sitemap lists none.

## Where each fact comes from

What the server-rendered tour page contains (checked on two tours, `9109` and `8923`):

| Fact | In the page? | Where |
|---|---|---|
| Title | yes (SEO only) | `<script type="application/json">` (`__NUXT_DATA__`, devalue format) → `seo-page:TOUR:<id>` → `title`, e.g. `西安直航6天旅行團｜華山、兵馬俑、大唐不夜城與長安十二時辰主題街區 - 大航假期「中國旅游專家」` |
| Days | only inside the SEO title or description (`6天`, `5天`) | same |
| Tour code | sometimes, in SEO keywords (`清邁清萊旅行團,BKKCA05,中國旅游專家` on `8923`; none on `9109`) | same → `keywords` |
| Nights, day headings, start/end point, "from" price, departure dates, per-date prices, full/closed | **no** | loaded in the browser |

The visible body is the site header, the footer and a loading skeleton (`aria-label="旅行團詳情加載中"`).

**The separate request.** `window.__NUXT__.config.public.appBaseApi` is `"https://api.biglinehk.com/"` (with `apiHostCode: "DH"`). The app's API client calls paths relative to it; the one seen is `bigline/global/seo/page` (in `/_nuxt/DRm_WKFd.js`). The tour detail component (`/_nuxt/DJSmirVR.js`, via the route chunk `/_nuxt/Dv_9fUjz.js`) builds its request from the route as `{tourNo}` or `{productId}`. The exact tour-detail path is in a chunk not fetched in Task 14, so the full URL could not be recorded then. The page state also has `token`, `refreshToken` and `rsaPublicKey` fields. **Task 14b update:** the paths, methods and headers are now recorded under "The API" above. `token` and `refreshToken` are used only for logged-in users, and the RSA keys only for login. The tour-detail URL for `/tour-group/9109` is `https://api.biglinehk.com/bigline/global/product/tour/frontend/detail?id=9109`.

## Gathering / departure point text

None is in the HTML. The only place text is in the SEO descriptions:

- `9109`: `直航西安6天，遊華山、秦始皇陵兵馬俑與大唐不夜城，走訪高家大院及長安十二時辰主題街區，體驗古都歷史與民間藝術。`
- `8923`: `香港直航清邁，5天遊雙龍寺、清邁古城及清萊，轉乘九人商務車走訪美斯樂華人村與茶園，並入住美斯樂度假村一晚。`

## Number and date formats

No prices or dates are in the pages, so nothing to report. The SEO text uses ASCII digits (`6天`, `5天`).

## Fixtures

Task 14 saved none: none of the facts is in the `bigline.hk` pages. Task 14c saved the raw API answers only under `.superpowers/raw-pages/bigline/` (git-ignored): they contain personal and internal data and must never be committed as they are.

**Task 17** (2026-11-13): four fixtures in `packages/scraper/src/operators/bigline/fixtures/`, each `<name>.api.json` (exactly what fetchPage hands the parser: the detail and each month's dates, after the allow-list in `public.ts`, so only the keys the parser reads, rebuilt key by key, with route lines cut to their short chunks: no names, notes, suppliers, costs or descriptions) and a hand-written `<name>.expected.json` (`verifiedByOwner: false`, with notes on every judgment call). `trimFixture` (for HTML pages) was not used or changed. The raw answers stay under `.superpowers/raw-pages/bigline/` (`fixture-*.json`, `probe-*.json`) for the orchestrator to delete.

| Fixture | Tour | Why | Months in the fixture |
|---|---|---|---|
| `multi-city` | 8923 BKKCA05, Chiang Mai and Chiang Rai, 5 days | several cities | 2026-12, 2027-01, 2027-02 (the 3 the scraper requests today) |
| `simple` | 9109 CSIAA06, Xi'an, 6 days | one city; three full dates and two past ones | 2026-11, 2026-12 (Task 14c), 2027-01 |
| `edge` | 22042 LENCH15-00, Nordic countries and Iceland, 15 days | no upcoming dates: no month listed, no POST, skipped as `no-departures` | none |
| `prose-routes` | 624469 CHET08F, Inner Mongolia, 8 days (a 6-digit id) | the most prose-heavy route lines seen | 2026-12 only (the scraper would also ask for 2027-01 and 2027-02) |

Requests made for them (budget 10; robots.txt was not requested again: the copy read in the Task 14c probe at 20:46 UTC the same day was reused, as RFC 9309 allows for 24 hours). Each through `createFetcher` with the header declared for `api.biglinehk.com` only, at least 3 s apart, logged to `.superpowers/raw-pages/bigline/ledger-fixtures.tsv`. Every answer was HTTP 200 with `code` 200; no refusal was seen. Extra headers: `tenantCode: DH` on all, plus `Content-Type: application/json` on the POSTs.

| # | UTC (2026-11-13) | Method and URL | Body |
|---|---|---|---|
| 1 | 22:01:56 | GET …/bigline/global/product/tour/frontend/detail?id=8923 | – |
| 2 | 22:03:40 | POST …/bigline/global/product/release/page | `{"pageNo":1,"productId":"8923","yearMonth":"2026-12","pageSize":1000}` |
| 3 | 22:03:52 | POST …/bigline/global/product/release/page | `{"pageNo":1,"productId":"8923","yearMonth":"2027-01","pageSize":1000}` |
| 4 | 22:04:24 | GET …/bigline/global/product/tour/frontend/detail?id=624469 | – |
| 5 | 22:05:30 | POST …/bigline/global/product/release/page | `{"pageNo":1,"productId":"624469","yearMonth":"2026-12","pageSize":1000}` |
| 6 | 22:05:42 | GET …/bigline/global/product/tour/frontend/detail?id=22042 | – |
| 7 | 22:07:01 | POST …/bigline/global/product/release/page | `{"pageNo":1,"productId":"8923","yearMonth":"2027-02","pageSize":1000}` |
| 8 | 22:07:14 | POST …/bigline/global/product/release/page | `{"pageNo":1,"productId":"9109","yearMonth":"2027-01","pageSize":1000}` |

## Every URL fetched (Task 14: 9 page fetches; Task 14b: 5; robots.txt not counted)

### Task 14

| # | UTC | URL | Result |
|---|---|---|---|
| – | 22:13:21 | https://bigline.hk/robots.txt | 200 |
| 1 | 22:13:52 | https://bigline.hk/sitemap.xml | 200 (index) |
| 2 | 22:15:42 | https://bigline.hk/sitemap-1.xml | 200 |
| 3 | 22:16:11 | https://bigline.hk/tour-group/9109 | 200 (no tour data) |
| 4 | 22:26:32 | https://bigline.hk/_nuxt/DaXYCoAd.js | 200 (app entry: router, chunk map) |
| 5 | 22:27:19 | https://bigline.hk/_nuxt/Dv_9fUjz.js | 200 (tour route chunk) |
| 6 | 22:27:49 | https://bigline.hk/_nuxt/DJSmirVR.js | 200 (tour detail component) |
| 7 | 22:28:41 | https://bigline.hk/_nuxt/DRm_WKFd.js | 200 (fetch parameters, API paths) |
| 8 | 22:29:36 | https://bigline.hk/user-agreement?protocolId=1 | 200 (no agreement text) |
| 9 | 22:33:23 | https://bigline.hk/tour-group/8923 | 200 (no tour data; confirms 9109 is typical) |

Not requested in Task 14: anything on `api.biglinehk.com`, `h5.bigline.hk` or `www.bigline.hk`.

### Task 14b (budget: 10 requests to `api.biglinehk.com` and `bigline.hk` combined, robots.txt not counted; 5 used)

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | 00:03:38 | https://api.biglinehk.com/robots.txt | HTTP 200, `{"code":500,"msg":"404 NOT_FOUND"}` (no robots.txt; everything allowed) |
| – | – | https://bigline.hk/robots.txt | **not requested again**: `createFetcher` was given the copy saved in Task 14 (read 2026-11-12 22:13:21 UTC, under 2 hours earlier; RFC 9309 allows caching for up to 24 hours), so no URL was requested twice |
| 1 | 00:05:02 | https://bigline.hk/_nuxt/DCBnc137.js | 200, 3,105 characters (the API functions: paths and methods) |
| 2 | 00:08:57 | https://bigline.hk/_nuxt/Bk0Y8-wa.js | 200, 89,813 characters (the request client: base URL, headers, error handling; also the agreement API) |
| 3 | 00:09:02 | https://bigline.hk/_nuxt/Dor4AHE3.js | 200, 17,414 characters (the user agreement page: which API call loads the text) |
| 4 | 00:11:19 | https://api.biglinehk.com/bigline/global/product/tour/frontend/detail?id=9109 | HTTP 200, body `{"code":401,"msg":"未授权"}`: **stop** |
| 5 | 00:11:23 | https://api.biglinehk.com/bigline/global/protocol/center?protocolId=1 | HTTP 200, body `{"code":401,"msg":"未授权"}`: **stop** |

Every request was a GET with exactly the headers `createFetcher` sets (`user-agent: tour-comparison-bot/0.1`), plus the defaults of Node's fetch (undici): `accept: */*`, `accept-language: *`, `sec-fetch-mode: cors` and `accept-encoding`. The headers were seen on a local test server. Nothing was retried. Not requested: any further tour, the month-dates POST, `h5.bigline.hk`, `www.bigline.hk`.
