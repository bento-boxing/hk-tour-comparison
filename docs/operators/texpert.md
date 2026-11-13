APPROVED 2026-11-12: owner confirms personal, non-commercial use

# Texpert 專業旅運 (`texpert`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`); pages fetched 2026-11-12 22:13–22:34 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **6 of 10**.

## Owner decision

**APPROVED by the owner, 2026-11-12** (decision made in chat). The owner confirms that this project is personal and non-commercial, and that is the use Travel Expert's terms permit (`您可列印或下載網站內容供個人非商業用途` / "You may print or download website content for personal, non-commercial use"; `網站僅供個人用途` / "The website is for personal use only"; both quoted under Recommendation below). This approval is the owner's own decision, not a controller's application of a rule.

- **Caveat:** the approval rests on the project staying non-commercial. If it ever becomes commercial (advertising, paid features, selling or licensing the data, or use by a business), this approval no longer holds and the terms must be read again before any further scraping.
- **Fixtures:** the three fixtures keep eight day-heading lines whole (up to about 150 characters each: the longest `h3` is 147 characters with its `Day 1` prefix), some with promotional wording (for example `打卡靚景、食嘢、Shopping等一次過滿足曬` and `結束愉快行程！`) and meal names, because stops are parsed from them. The owner may ask for them to be hand-trimmed.

## Recommendation

Task 14 recommendation, before the owner's decision above: **HOLD.** The terms of use restrict use of site content to personal, non-commercial use, claim database rights, and say the website is for personal use only. A public comparison site that stores and shows Texpert's dates and prices is plausibly covered. Every needed fact is reachable within robots.txt, so terms are the only reason for the hold.

The terms say the English version prevails (`如本條款之中、英文版本存在差異，概以英文版本為準。` / `In case of discrepancies between the Chinese and English versions of these Terms, the English version shall prevail.`). The two versions differ on copying, so both are quoted.

Clauses (exact text, `使用條款及細則` / "Terms of Use and Conditions", effective 2025年8月14日 / August 14, 2025):

1. Section 03, `網站內容使用`:
   > 我們擁有網站所有知識產權（包括版權、商標、設計權及數據庫權）。您可列印或下載網站內容供個人非商業用途，但不得修改、複製或用於商業目的，且須標示Texpert為內容作者。違反本條款的使用權利將立即終止，我們可能要求您銷毀或交回相關內容副本。

   English (prevails), "Website Content Usage":
   > We own all intellectual property rights in the website (including copyrights, trademarks, design rights, and database rights). You may print or download website content for personal, non-commercial use, but you may not modify, copy, or use it for commercial purposes without indicating Texpert as the content author. Breach of these usage rights will result in immediate termination, and we may require you to destroy or return copies of the content.

   The Chinese text says copying and commercial use are not allowed, and that Texpert must be credited. The English text says they are not allowed "without indicating Texpert as the content author". That wording could be read as allowing them with credit, but it sits right after the personal, non-commercial permission. This is for the owner to judge.
2. Section 11:
   > 網站僅供個人用途，Texpert不對商業損失（如利潤損失或業務中斷）承擔責任。

   > The website is for personal use only, and Texpert is not liable for commercial losses (e.g., loss of profits or business interruption).
3. Section 03, `禁止使用` / "Prohibited Uses" (no mention of robots, scraping or crawling by name):
   > 您不得以非法、欺詐或未經授權的方式使用我們的網站，包括但不限於：…未經授權存取、幹擾或損壞網站或相關設備、網絡或軟件。

   > You may not use our website in any unlawful, fraudulent, or unauthorized manner, including but not limited to: … Unauthorized access, interference, or damage to the website or related equipment, networks, or software.
4. Acceptance:
   > 使用我們的服務即表示您同意遵守本條款及相關第三方供應商的條款。如您不同意，請勿使用我們的服務。

   > By using our services, you agree to comply with these Terms and the terms of relevant third-party suppliers. If you do not agree, please do not use our services.
5. Footer:
   > ©2026，專業旅運電子商貿有限公司版權所有，不得轉載

   > ©2026 Travel Expert E-Commerce Limited. All rights reserved.

Neither version mentions automated access, robots, scraping or crawling explicitly. robots.txt carries `Content-Signal: search=yes, ai-input=yes, ai-train=yes`, which signals openness to automated use but does not change the terms.

## Terms of use

- `https://www.texpert.com/zh-hk/terms` (footer link `使用條款`), read 2026-11-13.
- `https://www.texpert.com/en/terms` (the prevailing English version), read 2026-11-13.

## robots.txt (`https://www.texpert.com/robots.txt`)

`User-Agent: *` with `Allow: /`. Disallowed: `/api/`, `/booking/`, `/checkout/`, `/sign-in`, `/sign-up`, `/auth/`, `/travels`, `/myprofile`, `/setting`, `/manage-trip`, `/ordersuccess`, `/maintenance`, `/UploadFile` (each also under `/*/`), and any URL with `utm_`, `gclid=`, `gbraid=`, `wbraid=`, `fbclid=`, `msclkid=` or `ttclid=` in its query. `Content-Signal: search=yes, ai-input=yes, ai-train=yes`. No Crawl-delay. **Tour pages are allowed; nothing needed is under `/api/`.**

## Tour pages in the sitemap

`https://www.texpert.com/sitemap/sitemap_tour_zh-hk.xml` lists **117** URLs, all tour pages: `https://www.texpert.com/zh-hk/tour/<id>-<english-slug>` (e.g. `1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city`). Each also has `en` and `x-default` alternates (not needed). The site index is `https://www.texpert.com/sitemap/sitemap.xml` (not fetched).

## Where each fact comes from

All facts are in the tour page itself. Some are server-rendered HTML; the full departure list is only in the page's **Next.js flight data**: the `<script>self.__next_f.push([1,"…"])</script>` chunks. Join the JSON-decoded strings of those chunks in order to get one payload of rows (`<id>:<JSON>\n`, or `<id>:T<hex byte length>,<text>`). No separate request is needed.

| Fact | Where | Selector / path |
|---|---|---|
| Tour code | flight data | the object `{"code":"TDZC05R","departures":[…],"duration":5,"isExpired":false,"location":"中國・張家界","minSalePrice":999,…,"title":"…"}`; per-date `subCode` `TDZC05R-261127`. The URL id `1272` is JSON-LD `sku`, not the tour code. |
| Title | HTML | `h1`; also JSON-LD (2nd `ld+json`, item `@type` `["Product","TouristTrip"]`) `name`, and flight `title` |
| Days | JSON-LD / flight | `additionalProperty` `{"propertyID":"tourDurationDays","value":5}`; flight `duration`; title prefix `5天` |
| Nights | not stated | |
| Day headings | HTML | `details summary h3`: first span `Day N`, second span the day's route (`福田口岸集合 (乘地鐵) 深圳北站 > (高鐵) 衡陽東 > …`; separators ` > ` or `→`). Short tours put the whole day in the heading. |
| Start / end point | HTML | Day 1 heading starts with the meeting point (`福田口岸集合`, `深圳口岸集合`, `新皇崗口岸集合`); the last day's heading ends with `解散` / `散團`; titles may say `(深圳集散)` |
| "From" price | HTML / JSON-LD / flight | JSON-LD `offers` (`AggregateOffer`) `lowPrice` 999 / `highPrice` 1899; `<meta property="product:price:amount" content="999">`; flight `minSalePrice` / `minPrice`; visible `每人價格起` `HKD 139` |
| Departure dates | flight data | the booking sidebar props → `products[].prices[].date` (ISO). Sample `1272`: 45 dates, 2026-11-27 to 2027-02-28 (JSON-LD `offerCount` 45). |
| Per-date price | flight data | same objects: `sellingPrice` (also `marketingPrice`, `tourFee`, `serviceFee`, `tax`, `mustDiscountAmount`, `discounts`). `serviceFee` is extra: e.g. `sellingPrice` 539 with `serviceFee` 160 (the page says `領隊、導遊及司機服務費，將於行程完畢前在當地收取`). |
| Full / closed | flight data, partly | tour level: `isSoldOut`, `isPurchasable`, `isExpired`; per date: `inventory` (always 9 in the samples, which looks like a capped display) and `salePeriod`. **How a single full date is marked could not be determined**: no full date was seen. The HTML calendar has a legend only (`data-departure-status` = `willFormSoon` 快將成團, `formed` 已成團, `full` 已額滿). |

Also in the flight data: `departures: [{"type":"HotRecommended"|"AlreadyFormed","date":…,"subCode":…}]`, a short list of highlighted dates. It can include a date missing from `prices` (2026-11-25 on `1272`, which the calendar shows disabled), so treat `prices` as the list of bookable dates. JSON-LD `validFrom` / `priceValidUntil` (2026-11-25 / 2026-12-24) do not match the `prices` range; do not use them.

The server-rendered calendar (`td[data-day="2026-11-27"]`, `data-disabled="true"` for days with no departure) shows only the first month, so it is not a full list.

## Gathering / departure point text (exact)

- `1272`: title `5天 衡陽、長沙、張家界、鳳凰古城 高鐵抵玩團(深圳集散)`; Day 1 `福田口岸集合 (乘地鐵) 深圳北站 > (高鐵) 衡陽東 > 【保衛里】 創意文化街區 > 長沙 > 長沙燈光夜色【黃興路步行街】`; Day 5 `鳳凰古城 > 衡陽東 > (*高鐵) 深圳北站 > (地鐵) 福田/羅湖口岸解散`; highlight `深圳福田口岸集散。`
- `1386`: Day 1 `深圳口岸集合→乘座國內旅遊巴士前往江門→ 午餐【新會陳皮宴】→…`; Day 2 ends `→深圳灣/羅湖口岸散團。結束愉快行程！`
- `1359`: Day 1 `新皇崗口岸集合→乘坐國內旅遊車前往 東莞→【松山湖】外觀華為歐洲小鎮→ …→深圳灣口岸/新皇崗口岸散團， 結束愉快行程！`
- No `集合地點` / `出發地點` label exists; the meeting point is the start of the Day 1 heading. All three samples start in Shenzhen, not Hong Kong.

## Number and date formats

- Data: ISO dates and integer prices in the flight data and JSON-LD.
- Visible text: prices `HKD 1,999` (ASCII, comma). Related-tour cards list dates as `12/24` and `2/3` (**month/day, no year**). Calendar labels read `2026年11月25日 星期三`. No full-width digits seen.
- Day headings are long (the route text is up to 142 characters in the samples; 147 with the `Day N` prefix). The fixtures keep them whole, both in the HTML and where the flight data repeats them (see Fixtures).

## Fixtures (`packages/scraper/src/operators/texpert/fixtures/`)

Committed after the owner's approval (2026-11-12): moved unchanged from the copies held outside the repository, which were regenerated in Task 14's fix round 1. Before committing, they were re-checked (Task 14b) and confirmed byte-identical to what the regeneration command below produces from the saved pages, after the two meta tags are removed.

Saved with `pnpm --filter @hktours/scraper fixture --from <saved page> <output>` and one `--keep` selector for the day headings. To regenerate:

```
pnpm --filter @hktours/scraper fixture --keep 'details summary h3' --from <saved tour page> <output>
```

then remove the two tracing meta tags by hand (below). `trimFixture` keeps the flight data merged into a single `self.__next_f.push([1,"…"])` script, with strings over 120 characters and text rows cut. Text inside `details summary h3` is cut only above 300 characters, and a flight data string that repeats such a text exactly is kept up to 300 characters too. Checked after regenerating: all 8 day headings are whole in the HTML (the longest `h3` is 147 characters including its `Day 1` prefix, and none ends in `…`). The only flight data strings over 120 characters are day headings without the prefix: `1386` day 1 (130 characters, as `children`) and `1359` day 1 (142 characters, as `children` and as an image `fallbackAlt`). Their `h3` texts, with the `Day 1` prefix, are 135 and 147 characters.

| File | Source | Why |
|---|---|---|
| `multi-city.html` | `/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city` | 5 days, Hengyang / Changsha / Zhangjiajie / Fenghuang; 45 dates, prices 999–1899; starts in Shenzhen |
| `simple.html` | `/zh-hk/tour/1386-guangdong-tour-2-day-pure-play-with-special-natural-sea-hot` | 2 days, one place (Jiangmen); 23 dates; `serviceFee` 160 on top of price |
| `edge.html` | `/zh-hk/tour/1359-guangdong-province-tour-1-day-new-huanggang-experience` | **1-day tour** (0 nights), the whole itinerary in one heading; starts at 新皇崗口岸 (Shenzhen) |

Removed by hand after trimming: the `<meta name="sentry-trace">` and `<meta name="baggage">` tags (per-visit tracing IDs; no parsing value). Checked by eye: no personal data; the phone numbers present are the company's published hotline and form placeholders. The fixtures are large (about 230–275 KB) because the flight data includes the site's UI text dictionary, which is short strings, not tour prose.

## Every URL fetched (6 page fetches; robots.txt not counted)

| # | UTC | URL | Result |
|---|---|---|---|
| – | 22:13:22 | https://www.texpert.com/robots.txt | 200 |
| 1 | 22:13:53 | https://www.texpert.com/sitemap/sitemap_tour_zh-hk.xml | 200 |
| 2 | 22:16:10 | https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city | 200 |
| 3 | 22:29:36 | https://www.texpert.com/zh-hk/terms | 200 |
| 4 | 22:29:40 | https://www.texpert.com/zh-hk/tour/1386-guangdong-tour-2-day-pure-play-with-special-natural-sea-hot | 200 |
| 5 | 22:29:43 | https://www.texpert.com/zh-hk/tour/1359-guangdong-province-tour-1-day-new-huanggang-experience | 200 |
| 6 | 22:33:24 | https://www.texpert.com/en/terms | 200 |

## Practice crawl (Task 19)

`pnpm scrape --operator texpert --dry-run`, run once on **2026-11-13** (Hong Kong), 02:20–02:27 UTC, through `createFetcher` (one fetcher, about 3.5 s per page), right after the Jetour crawl finished. No 403, 429, bot challenge, retry or unfetched page. This crawl already ran with the `松山湖` and `西貢` fixes in the places list (Task 19), not with the rest of the additions.

| | Count |
|---|---|
| Tour pages discovered (sitemap) | 117 |
| Tour pages fetched | 117 |
| Tours saved (to the throwaway database) | 0: the run failed its checks (`too-many-parse-failures`) |
| Parse failures | 31 (26.5%), all `no-stops` |
| Skipped, no upcoming departures | 3 (not failures) |
| Tours that normalised | 83 |

**Cause:** mostly missing places (Guangdong towns such as 順德, 肇慶, 中山, 清遠, 增城, 從化, 韶關, 開平, 台山; 賀州 and 梧州 in Guangxi; Hainan; Hubei; Phu Quoc).

**After extending the places list:** pages were not re-crawled; the dry run's printed day headings were re-processed offline with the new list: **1 parse failure in 117 pages (0.9%)**, 113 tours would normalise. The one left, `1383-guangdong-province-tour-2-day-fairy-tale-late-autumn-red` (YASR02R), names its places only inside `【】` brackets, which the extractor drops (`新會`), and otherwise 南沙 (a district).

Heading problems seen (parser or headings, not places), recorded for the owner:
- **Line breaks inside words.** The `details summary h3` text keeps the page's line wrapping as spaces, which split names in two: `前往江 門`, `從化溫 泉小鎮`, `長白 山人參`, `紅 葉`. A name split this way is not matched (`江 門` gives `江` and `門`). The pages above still matched through other names, but this will cost matches. Since Task 19 fix round 1 the parser removes a space between two Chinese characters when it builds `dayHeadings` (`江 門` → `江門`); other spaces stay.
- **Prose headings.** Short tours put the whole day in the heading, so meals, shows and slogans (`結束愉快旅程！`, `網紅打卡點`, `永春` from `龍舟、永春、香雲紗` meaning Wing Chun, not 永春 in Fujian) dominate the unmatched names. 永春 was deliberately not added.
- **Transit and meeting points.** `中轉深圳北/廣州南`, `乘車返回深圳` put Shenzhen or Guangzhou on routes of tours that only pass through; `黃金海岸` (a beach in Quanzhou) matches Gold Coast exactly, which `notPlaces` cannot prevent.
