OWNER DECISION PENDING

DATES NOT AVAILABLE WITHIN THE RULES (the operator's site answered our very first request, for robots.txt, with a CloudFront `403 ERROR` page reading "Request blocked.", so no page of the site was fetched and nothing about its data could be observed)

# Miramar Travel 美麗華旅遊 (`miramar`): operator investigation

- Capture date: **2026-11-14** (Hong Kong). The one request was sent 2026-11-13 23:08:53 UTC, which was 07:08 on 14 November in Hong Kong.
- The request went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, one at a time, 3 s per site), with undici's `EnvHttpProxyAgent` installed as `cli.ts` does. It was a GET with no extra headers, cookies or tokens. Page fetches used: **0 of 12**, plus robots.txt on one host (not counted). It is listed under "Every URL fetched".
- Raw response and ledger: `.superpowers/raw-pages/miramar/` (git-ignored). The probe script is outside the repository.
- **A block page was met on the first request.** Under the rules, requests to that host stopped there. Nothing was retried, and no other User-Agent, header, host name or route was tried.

## Who the operator is

Identified by web search only (no page of the operator's site was read):

- **Miramar Travel 美麗華旅遊**, a Hong Kong outbound tour operator in the Miramar Group (Miramar Hotel and Investment, HKEx stock code 71), which is a member of Henderson Land Group. The search results describe it as running over 400 tours to more than 50 countries. Its sister brand **美麗華旅運 Miramar Express** is not covered here.
- **Official site: `https://www.hkmiramartravel.com/`.** The group's corporate site (`miramar-group.com`, page "Travel") and the site's own "about us" page (`/aboutus/aboutus_eng.html`, seen as a search result, not fetched) point to it. The name in the brief's hint, `miramartravel.com.hk`, did not appear in any search result. It was not requested, because it could not be tied to the operator.
- Company: a Legal Entity Identifier record (search result, not fetched) names **Miramar Travel Limited 美麗華旅遊有限公司**, Hong Kong company number 34213011, active. **Travel agent licence number: not found.** The search did not show it, and the site's footer, where it is usually printed, could not be read.
- One third-party listing (Wanderlog) marks a Miramar Travel shop as "Temporarily Closed". The search index holds tour pages of the site with departures in 2026, so the business looks active. **Not verified.**

## robots.txt (`https://www.hkmiramartravel.com/robots.txt`, requested 2026-11-13 23:08:53 UTC)

**Not read: blocked.** The response, verbatim where it matters:

- Status: **HTTP 403**
- Headers: `server: CloudFront`, `x-cache: Error from cloudfront`, `x-amz-cf-pop: LHR95-P2`, `x-amz-cf-id: iTfMXFgdjIbPOzFwyGdVq-VpUv_0YGJFXJTOCX0Y1GNpTAAcV7QD9Q==`, `content-type: text/html`, `content-length: 919`
- Body excerpt:

  ```
  <TITLE>ERROR: The request could not be satisfied</TITLE>
  <H1>403 ERROR</H1>
  <H2>The request could not be satisfied.</H2>
  Request blocked.
  We can't connect to the server for this app or website at this time. There might be too much traffic or a configuration error. Try again later, or contact the app or website owner.
  ```

`createFetcher` then logged `not crawling https://www.hkmiramartravel.com: robots.txt unreadable (HTTP 403)` and sent nothing else to the host.

So the `User-agent: *` group, any group naming AI or other bots, Crawl-delay and sitemaps are all **not known**.

**Why it was blocked is not known.** CloudFront gives this "Request blocked." page when a rule on the distribution (often AWS WAF) refuses a request. The rule might match the User-Agent, the IP address or network (the request left from a data-centre address and reached the London edge, `LHR95`), the country, or the request rate. CloudFront's country block usually has different wording ("configured to block access from your country"), but that is not proof. The cause was **not tested**, and testing it would mean trying to get past the block.

## Terms

**Not read**, because the host was blocked before any page was requested. No terms URL is known. The search results show none.

Clauses on automated access, robots, crawling, scraping, copying, reproduction, intellectual property, linking or permitted use: **not known**. This is a gap, not a "none".

## Where each fact comes from

**Nothing observed.** No page was fetched, so no selector, JSON path or separate request can be given for any fact (tour code, title, days/nights, day headings, gathering point, "from" price, departure dates, per-date prices, full/closed marker).

Seen in search results only (URLs and snippets from the search engine, not fetched, **not verified**):

- The site is ASP.NET (`.aspx` pages).
- Listing pages: `/Tour/page/<code>.aspx` (e.g. `CS.aspx`, `CL.aspx?day=4`, `sea_japan.aspx`, `cs_buffet.aspx`, `cl_east_china_qiandaohu.aspx`) and `/Tour/tourlist.aspx?keywords=<tour codes, comma-separated>`.
- A booking or detail page: `/bookingpage/touritemdetail.aspx?tourcode=<code>_<MMDD?>` (e.g. `TKHC05_0430`). The suffix may be a departure date, which would mean one page per departure. **Not verified.**
- Tour codes look like 6 characters, two digits at the end matching the day count (`TKHC05` 5 days, `CWHD06`, `DMCA05`, `CYAD07`).
- The search engine's summary mentions "from" prices (`起價HK$2599`) and departure ranges (`出發期至2026年12月31日`) on listing pages. Whether they are in the HTML as served, or loaded by script, is not known.

## Discovering tours and nightly cost

**Not known.** Without robots.txt there is no sitemap to read, and no listing page was fetched. The number of tours is not known. The "over 400 tours" figure in the search results is marketing text, not a count of what is on sale.

Requests per tour per night and the nightly duration cannot be worked out. As an illustration only: if each tour needed one page, 400 tours would be 400 requests, about 20 minutes at 3 s each. If the detail page is one per departure (see the `tourcode=<code>_<MMDD>` pattern above), it could be several times that. Neither figure is grounded in an observation.

## Recommendation

**HOLD.** The site refuses our bot at its edge, before robots.txt. The rules say a block is recorded and never worked around. So within the rules this operator cannot be listed at all, not even in reduced form.

What would lift the HOLD:

- **Ask Miramar Travel (the only route that stays within the rules).** A request for permission or a feed would need to cover:
  - letting `tour-comparison-bot/0.1` through their CloudFront rule (from the address the nightly job runs on), or giving a feed instead;
  - reading robots.txt, the sitemap (if any), the tour listing pages and each tour's page every night, one request at a time, at least 3 s apart;
  - for every group tour: tour code, title, days, cities, gathering point, "from" price, departure dates, per-date price and full/closed status;
  - publishing those facts on a personal, non-commercial comparison site with a link back to each tour page, copying no descriptions or images;
  - a pointer to their website terms of use, which we have not been able to read.
- **Owner decision (not a bot action).** The owner may choose to look at `https://www.hkmiramartravel.com/` and its terms in a normal browser, to see whether the terms say anything on automated access. That would not lift the block. It would only tell us what to put in the request to the operator. Sending the bot again from another network, or with another User-Agent, to see whether the block goes away, would be trying to get past it. This report does **not** recommend that. It would need an explicit owner decision, and even then the operator's permission is the clean route.

## Fixtures

**None.** No page was fetched.

## Every URL fetched (0 page fetches; robots.txt not counted)

All through `createFetcher`, GET. The ledger is `.superpowers/raw-pages/miramar/ledger.tsv`.

| # | UTC (2026-11-13) | URL | Result |
|---|---|---|---|
| – | 23:08:53 | https://www.hkmiramartravel.com/robots.txt | **HTTP 403**, 919 bytes, CloudFront "Request blocked." page (`x-cache: Error from cloudfront`). Requests to the host stopped here. |

**Not requested:** any page on `www.hkmiramartravel.com` (home, sitemap, terms, listing, tour pages, scripts); `hkmiramartravel.com` without `www`; `miramartravel.com.hk`; `miramar-group.com`; `miramarexpress.com`. The probe was run once, with the robots.txt URL as its target. The fetcher had already refused the origin after the 403, so the target itself was not sent.

## Not verified

- Why the request was blocked (User-Agent, network, country or something else), and whether the block would also apply from another network.
- robots.txt, sitemaps, terms, licence number: none read.
- Everything under "Seen in search results only": URL patterns, tour-code format, where prices and dates sit, and whether the detail page is one per tour or one per departure.
- The number of tours, and whether the business is fully active (one listing says "Temporarily Closed").
- That `miramartravel.com.hk` (the brief's hint) has anything to do with this operator.
