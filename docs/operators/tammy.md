OWNER DECISION PENDING

DATES NOT AVAILABLE WITHIN THE RULES (robots.txt on both of the site's hosts, `www.tammytravel.hk` and `tammytravel.hk`, is `User-agent: *` / `Disallow: /`, so no page on the site may be requested, the sitemap included)

# Tammy Travel 達美旅遊 / 美食之旅 (`tammy`): operator investigation

- Capture date: **2026-11-14** (Hong Kong). The robots.txt files were fetched 2026-11-13 23:16–23:29 UTC, which was 07:16–07:29 on 14 November in Hong Kong.
- All requests to the operator's hosts went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, one at a time, 3 s per site), with undici's `EnvHttpProxyAgent` installed as `cli.ts` does. All were GETs of `/robots.txt` with no extra headers, cookies or tokens. **Page fetches used: 0 of 12.** Every request is listed under "Every URL fetched".
- Raw responses and the ledger are in `.superpowers/raw-pages/tammy/` (git-ignored). The probe script is outside the repository.
- No block page, captcha, JavaScript challenge, login wall, 403 or 429 was met. Both robots.txt answers were HTTP 200 from `nginx/1.25.5`; the site is on Tencent Cloud (`www.tammytravel.hk` is a CNAME to `lb-hkxl8lt4-u1ag63t7rxd549vh.clb.hk-tencentclb.com`). Each answer set a load-balancer cookie (`tgw_l7_route=…`), which was not stored or sent back.

## Who the operator is

Identified with reasonable confidence, from web search and public records (no operator page was read):

| What | Value | Source |
|---|---|---|
| Brand | **Tammy Travel 達美旅遊**, with the Guangdong short-tour brand **美食之旅** ("food tours") | Search results; Toursforfun's operator page `tammy travel_達美美食之旅_達美旅遊` (founded 2004; tickets and outbound tours, mostly Guangdong, Fujian and Macau short tours; branches in Causeway Bay, Mong Kok, Tuen Mun and Tai Po; "純玩團", no-shopping tours, as its main line) |
| Licence holder | **BEST FUNNY HOLIDAY TRAVEL SERVICES LIMITED 繽紛遊天下旅遊有限公司**, licence no. **354298**, trade names `TAMMY TRAVEL` and `美食之旅`, website `http://www.bestfunny.hk`, head office in Tuen Mun | Travel industry register page https://www.tichk.org/en/travel-agent-information/23277-0 (read 2026-11-14 with WebFetch; it is not an operator host) |
| Official site | **https://www.tammytravel.hk/** (also `https://tammytravel.hk/`) | Search results list `https://www.tammytravel.hk/index.php` titled `美食之旅 - 純玩又抵玩，質素我最盞-首頁` and `https://www.tammytravel.hk/tour.php` titled `美食之旅 - 純玩又抵玩，質素我最盞-旅行團` ("美食之旅: no-shopping and good value, the best quality; home / tours"). |
| Link between licensee and site | `www.bestfunny.hk` (the register's website) is a DNS CNAME to `tammytravel.hk`, and the TLS certificate it presents names only `www.tammytravel.hk` and `tammytravel.hk` | dns.google lookup; the TLS error recorded in the fetch log |

Notes, not verified:

- The older company **TAMMY TRAVEL (INTERNATIONAL) LIMITED 達美旅遊(國際)有限公司** (company no. 0942650, formed 2004-12-29) is listed by one company directory as dissolved on 2022-06-17; another lists it as active from a 2020 check. The licence on the register today is the Best Funny one above. Whether the site's footer shows licence 354298 was not checked: no page was read.
- One search summary said a register document lists `TAMMY TRAVEL` under licence no. 353193 with the Chinese name 繽紛遊天下旅遊有限公司. That document was not opened; the register page read shows 354298.
- `www.tammyt.hk`, the website given by an old business-directory listing (reviews from 2017–2018, phone +852 2384 1008, Mong Kok), **does not exist**: dns.google returns NXDOMAIN for `www.tammyt.hk` and `tammyt.hk`.

## Recommendation

**HOLD.** robots.txt on both hosts of the official site disallows every path for every user agent:

```
User-agent: *
Disallow: /
```

So no tour page, listing, sitemap, terms page or script may be requested by our bot, and none was. This is the operator's stated wish for all crawlers, not a technical obstacle. Nothing is reachable within the rules, so not even a reduced listing is possible: the tour list, titles, days, prices and dates are all behind that rule.

The one other hostname found for the same server, `www.bestfunny.hk`, does not serve HTTPS under its own name (certificate mismatch). It is the same server as `tammytravel.hk` (CNAME), so the same robots.txt would apply in substance even if it did; it is not a way in.

**What would lift the HOLD: asking the operator.** A request for permission (to Best Funny Holiday Travel Services Ltd / Tammy Travel) would need to cover:

- an exception to `Disallow: /` for User-Agent `tour-comparison-bot/0.1` (a `User-agent: tour-comparison-bot` group in robots.txt, or written permission), naming the paths needed: the sitemap (`https://tammytravel.hk/sitemap.xml`), the tour listing (`/tour.php` from search results) and the tour detail pages, plus any request the pages load dates and prices from;
- the rate: one request at a time, at least 3 s apart, once a night;
- which facts would be shown: tour code, title, days, cities, gathering point, "from" price, departure dates, per-date prices and full/closed status, with a link back to the tour page; no descriptions or images copied;
- that the site is personal and non-commercial;
- whether the website has terms of use, since they could not be read (below).

Alternatively, the owner may decide to leave Tammy Travel out.

## Terms

**Not read.** The terms of use, disclaimer, copyright or 條款及細則 page (if any) is on `www.tammytravel.hk`, where robots.txt disallows every path, so it was not requested. Its URL is not known. Clauses on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use: **not known.** This is a gap, not a "none".

## robots.txt

### `https://www.tammytravel.hk/robots.txt` (read 2026-11-13 23:22:44 UTC)

HTTP 200, `text/plain; charset=utf-8`, 71 bytes. The whole file, verbatim:

```
User-agent: *
Disallow: /

Sitemap: https://tammytravel.hk/sitemap.xml
```

### `https://tammytravel.hk/robots.txt` (read 2026-11-13 23:24:36 UTC)

HTTP 200, `text/plain; charset=utf-8`, 71 bytes, identical to the file above.

- One group only, `User-agent: *`, with `Disallow: /`: every path is disallowed for every bot. No group names AI or other bots. No Crawl-delay.
- The file names a sitemap, `https://tammytravel.hk/sitemap.xml`, but that URL is itself under `Disallow: /` on `tammytravel.hk`, so it was not requested. A sitemap line does not override a Disallow.
- `createFetcher` read both files as disallowing everything: its own request for each `/robots.txt` URL was refused by the same rule (`not fetched … disallowed by robots.txt`).

### Other hosts

| Host | robots.txt | Meaning |
|---|---|---|
| `www.tammyt.hk` (old directory listing) | not answered: the domain does not exist (NXDOMAIN at dns.google; the proxy cancelled each attempt) | Not the operator's site. Nothing reached any server. |
| `www.bestfunny.hk` (website on the licence register) | not answered: TLS failure `ERR_TLS_CERT_ALTNAME_INVALID` (`Host: www.bestfunny.hk. is not in the cert's altnames: DNS:www.tammytravel.hk, DNS:tammytravel.hk`) | The same server as `tammytravel.hk`. No HTTP request was sent (the connection stopped at the certificate check). Not tried again. |

## Where each fact comes from

**Not observed.** No page could be requested. From search-result titles only, the site is a PHP site with a home page `/index.php` and a tour listing `/tour.php`. Where the tour code, title, days/nights, day-by-day headings, gathering point, "from" price, departure dates, per-date prices and full/closed marker are, and whether they are in the served HTML or loaded by a separate request, is **not known**.

## Discovering tours and nightly cost

Not known. The sitemap (`https://tammytravel.hk/sitemap.xml`) and the listing (`/tour.php`) are disallowed, so the number of tours and the URL pattern of a tour page were not seen. Search results describe mostly Guangdong short tours (2–3 days), so the catalogue is probably small, but that is a guess. With permission, the cost would be about 1 sitemap request plus 1 request per tour (plus any dates request per tour): for, say, 100–300 tours, 5–15 minutes a night at 3 s each, well inside the 170-minute job. **Not verified.**

## Fixtures

None. Nothing was fetched.

## Every URL fetched (0 page fetches; robots.txt not counted)

All were GETs through `createFetcher`. The ledger is `.superpowers/raw-pages/tammy/ledger.tsv`. The fetcher tries a failed robots.txt request up to 3 times (1 + 2 retries); each try is listed.

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | about 23:15 (3 tries; logged afterwards, the first run did not log errors) | https://www.tammyt.hk/robots.txt | not answered: `fetch failed` (the domain does not exist) |
| – | 23:16:57, 23:17:00, 23:17:03 | https://www.tammyt.hk/robots.txt | not answered: `fetch failed`, cause `Request was cancelled.` (the domain does not exist; confirmed NXDOMAIN at dns.google) |
| – | 23:22:44 | https://www.tammytravel.hk/robots.txt | 200, 71 bytes: `User-agent: *` / `Disallow: /` |
| – | 23:24:36 | https://tammytravel.hk/robots.txt | 200, 71 bytes: the same file |
| – | 23:28:38, 23:28:43, 23:28:48 | https://www.bestfunny.hk/robots.txt | not answered: TLS certificate does not name `www.bestfunny.hk` (it names `www.tammytravel.hk`, `tammytravel.hk`); no HTTP request sent |

**Not fetched:** every page on `www.tammytravel.hk` and `tammytravel.hk`, the sitemap included (all disallowed); anything on `bestfunny.hk` without `www` (its robots.txt was not asked for; it resolves to a different address, `42.200.11.137`, and is not the site on the register).

Outside the operator's hosts, for identification only: web searches for the company name; DNS lookups at `dns.google` for `tammyt.hk`, `tammytravel.hk` and `bestfunny.hk` (with and without `www`); one WebFetch of the register page https://www.tichk.org/en/travel-agent-information/23277-0.

## Not verified

- Which licence number the site itself shows, and whether its footer names Best Funny Holiday Travel Services Limited (no page read).
- The register entry under licence no. 353193 mentioned by one search summary (not opened).
- Whether the site has terms of use, and what they say.
- Everything about the tour pages: URL pattern, number of tours, and where each fact is.
- Whether `bestfunny.hk` (without `www`) is related to the site.
