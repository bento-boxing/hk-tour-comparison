OWNER DECISION PENDING

DATES SOURCE UNVERIFIED (api.biglinehk.com robots.txt not read; host not cleared by the owner)

# Big Line Holiday 大航假期 (`bigline`): operator investigation

- Capture date: **2026-11-13** (Hong Kong, from `todayInHongKong()`); pages fetched 2026-11-12 22:13–22:34 UTC.
- All requests went through `createFetcher` (User-Agent `tour-comparison-bot/0.1`, robots.txt obeyed, 3 s per site). Page fetches used: **9 of 10**.

## Recommendation

**HOLD.** Two reasons:

1. **Departure dates, prices and day headings are not in any page on `bigline.hk`.** The tour pages are a Nuxt 3 app that loads all tour data in the browser from a different host, **`https://api.biglinehk.com/`**. That host was not among the hosts cleared for this task, so its robots.txt was not read and it was not requested. Whether it allows our User-Agent, or needs a login, a browser or a token, is unknown: nothing seen so far shows that it does. The tour page is rendered in the browser: its scripts request the data from that host after the page loads, so the HTML as served contains none of it. Hence the line at the top: where the dates come from is known only as far as the host, and that host has not been checked against the rules.
2. **The terms could not be read.** The user agreement page (`《用戶協議》` → `https://bigline.hk/user-agreement?protocolId=1`) is loaded the same way: its HTML has no agreement text. No clause can be quoted. The only rights text on the site is the footer:

   > 大航假期 Copyright © 2026 Big Line Holiday Limited. All rights reserved

**To revisit**, the owner would have to clear `api.biglinehk.com` so that its robots.txt can be read, and find the user agreement text. The plan's note that the data is in embedded page state (`__NUXT__`) is no longer true: the embedded state now carries only SEO fields.

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

**The separate request.** `window.__NUXT__.config.public.appBaseApi` is `"https://api.biglinehk.com/"` (with `apiHostCode: "DH"`). The app's API client calls paths relative to it; the one seen is `bigline/global/seo/page` (in `/_nuxt/DRm_WKFd.js`). The tour detail component (`/_nuxt/DJSmirVR.js`, via the route chunk `/_nuxt/Dv_9fUjz.js`) builds its request from the route as `{tourNo}` or `{productId}`. The exact tour-detail path is in a chunk not fetched, so **the full URL could not be recorded**. The page state also has `token`, `refreshToken` and `rsaPublicKey` fields; whether tour data needs any of them is unknown.

## Gathering / departure point text

None is in the HTML. The only place text is in the SEO descriptions:

- `9109`: `直航西安6天，遊華山、秦始皇陵兵馬俑與大唐不夜城，走訪高家大院及長安十二時辰主題街區，體驗古都歷史與民間藝術。`
- `8923`: `香港直航清邁，5天遊雙龍寺、清邁古城及清萊，轉乘九人商務車走訪美斯樂華人村與茶園，並入住美斯樂度假村一晚。`

## Number and date formats

No prices or dates are in the pages, so nothing to report. The SEO text uses ASCII digits (`6天`, `5天`).

## Fixtures

**None saved**: none of the facts is in the pages that were cleared and fetched, and the API host that serves them has not been checked.

## Every URL fetched (9 page fetches; robots.txt not counted)

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

Not requested: anything on `api.biglinehk.com`, `h5.bigline.hk` or `www.bigline.hk`.
