# 跟邊團 · Hong Kong tour comparison

A website (<https://ganbintuen.com>) that gathers package-tour listings from Hong Kong tour operators into one place.

- **For travellers:** filter and compare tours, and chain tours one after another with a chosen break in between.
- **How it works:** a small scraper collects the listings once a night. The website only reads from the database and never contacts the operators.
- **Not affiliated with any tour operator.**
- **Facts only:** operator, tour code, link, title, length, the cities visited, start and end point, departure dates and prices. Everything else is a link to the operator's own page.
- **Never stored:** itinerary text and photos.
- **Always confirm** prices and dates on the operator's site.

## 給旅行社的說明

「跟邊團」（<https://ganbintuen.com>）是一個由個人製作的非牟利網站，把香港多間旅行社的旅行團放在一起，方便用戶按出發日期、日數、目的地和價錢比較。網站不設廣告、不收佣金、不代售任何產品；所有報名均經連結返回旅行社自己的網頁進行。本網站與各旅行社並無任何關連。

**網站顯示甚麼**

- 只顯示事實資料：旅行社名稱、團號、旅行團名稱、日數、途經城市、集合及解散地點、出發日期、團費，以及額滿狀態（如旅行社網站有顯示）。
- 每個旅行團均連結到旅行社網站上的該團頁面。
- 不會儲存或顯示行程描述、圖片或宣傳文字，亦不會使用旅行社的標誌。
- 價錢及出發日期以旅行社網站為準。

**程式如何讀取資料**

- 程式每晚運行一次，並以 `tour-comparison-bot` 表明身分，同時附上本網站的網址和聯絡電郵。
- 讀取任何網頁前，先讀取該網站的 `robots.txt`，並遵守當中的限制；讀不到 `robots.txt` 的網站不會讀取。
- 對每個網站每次只發出一個請求，每個請求之間最少相隔三秒。
- 不會登入，不會繞過任何防止自動讀取的措施；如網站拒絕，程式當晚即停止讀取該網站。
- 各旅行社的讀取方式及所作的決定，記錄在 [`docs/operators/`](docs/operators/)（英文）。

**更正或移除資料**

如貴公司的資料有誤，或不希望被列出，請電郵至 <hello@ganbintuen.com>，或在本頁上方的 **Issues** 提出。我們會更正或移除有關資料，並停止讀取貴公司的網站。

（以下內容為英文，供開發者參考。）

## Operators included

| Operator | Site |
|---|---|
| Jetour 捷旅 (`jetour`) | jetour.com.hk |
| Travel Expert 專業旅運 (`texpert`) | texpert.com |
| EGL Tours 東瀛遊 (`egl`) | egltours.com |
| Charming Holidays 翠明假期 (`charming`) | charming-online.com |
| Yummy Holiday 美味假期 (`yummy`) | yummyholiday.net |
| Big Line Holiday 大航假期 (`bigline`) | bigline.hk |
| Sunflower Travel 新華旅遊 (`sunflower`) | sunflower.com.hk |

The findings for each operator are in [`docs/operators/`](docs/operators/).

## How the scraper treats operators' sites

The code is in [`packages/scraper/src/polite-fetch.ts`](packages/scraper/src/polite-fetch.ts).

**Who it says it is**

- Every request carries the User-Agent `tour-comparison-bot/0.1 (+https://ganbintuen.com; hello@ganbintuen.com)`, which names the site and an address to write to.
- `robots.txt` rules are matched on its first word, `tour-comparison-bot`.
- Until 2026-11-19 it was `tour-comparison-bot/0.1` alone. The site and contact were added that day, once the site had its own address, so that a site's owner can see who is asking and how to reach us.

**robots.txt**

- Before requesting any page from a site, the scraper reads that site's `robots.txt` and never requests a path it disallows.
- If `robots.txt` cannot be read, the site is not crawled at all.

**Pace**

- One request at a time to each site.
- At least 3 seconds after each response before the next request, or longer if `robots.txt` sets a `Crawl-delay`. A site asking for more than 30 seconds is not crawled.
- It runs once a night.

**Retries**

- A request that fails with a network error, a timeout or a 5xx answer is retried at most twice.
- A 4xx answer, or a 503 with a `Retry-After` header, is not retried.
- A POST is never retried.

**Backing off**

- If a site answers page requests with HTTP 403, 429 or 503 three times in a row, the scraper requests nothing more from that site for the rest of the run. A successful page in between starts the count again.
- A run in which more than 20% of the tour pages found could not be fetched fails its checks and saves nothing.

**What it never does**

- It never logs in.
- It never works around bot protection.

**Operators whose data comes from a data address**

- **Big Line** (`api.biglinehk.com`):
  - The address answers only requests carrying the site's fixed key `tenantCode: DH`, which is written in its public pages and is the same for every visitor.
  - With the owner's approval the scraper sends that one header, to that address only.
  - It asks for each tour's departures with one POST per month, for at most two months.
- **Yummy Holiday** (`api.yummyholiday.net`): plain GETs with no extra headers: one listing of every tour, then each tour's details and its departures.
- **Sunflower Travel:**
  - Plain GETs of two of its pages with no extra headers: one listing of every tour, then each tour's booking page.
  - Never requested: its other months' dates (a POST form), its per-date booking steps, and its itinerary PDFs (disallowed by its robots.txt).

## Data kept

The code is in [`packages/db/src/save-run.ts`](packages/db/src/save-run.ts).

- **Each night's successful save of an operator** replaces each of its tours' stops and departures, and keeps 8 nights of price history.
- **A tour missing from that save** is marked withdrawn and no longer shown.
  - If it is still missing more than 30 days after the night it went missing, it is deleted with its stops, departures and price history.
  - A tour that comes back before then keeps its row and history.
- **The log of scrape runs** keeps 90 days. It always keeps each operator's most recent successful run, however old, because the next run's checks compare against it.
- **Only inside a successful save, for that operator alone.** A run that fails its checks deletes nothing.

## Removing your listings

If you represent a tour operator and want your listings removed, please email hello@ganbintuen.com or open an issue in this repository's GitHub **Issues** tab. Your listings will be removed and your site will no longer be scraped.

## Working on it

Needs Node.js 20.19 or later and pnpm 10 (`corepack enable` picks the version named in `package.json`).

```sh
pnpm install
pnpm test        # all tests (they use an in-memory database; nothing is contacted)
pnpm typecheck
```

### A dry run of one operator

A dry run fetches real pages from the operator's site (politely, as above) but writes nothing to any database:

```sh
pnpm scrape --operator jetour --dry-run --limit 5
```

- `--operator` is one of `jetour`, `texpert`, `egl`, `bigline`, `charming`, `yummy` or `sunflower`. The nightly run scrapes all seven.
- `--limit N` is allowed only with `--dry-run`.
- A real run (`pnpm scrape --operator <id>`) needs `DATABASE_URL`, and uses `DATABASE_CA_CERT` when it is set.

### What the public logs show

The nightly run's logs on GitHub Actions (the migrate job and each scrape job) are public, so they are kept free of the operators' wording as far as a fixed rule can do it. The code is in [`packages/scraper/src/public-log.ts`](packages/scraper/src/public-log.ts) and [`packages/db/src/public-error.ts`](packages/db/src/public-error.ts).

- **A line about one tour page** names it by its tour code, with place names from the places list, and counts.
- **Before the code is known** (a page not fetched, or one its parser rejects), the line gives the page's address with the risky pieces hidden:
  - Any piece of its path, query or fragment is shown as `*` unless it is ASCII letters, digits and dots with at most one `-` or `_`. That hides percent-encoded or non-ASCII text, and three or more words joined by hyphens.
  - A reference follows: `https://www.charming-online.com/?tour=* (ref 1a2b3c4d)`.
- **An error message from code the project does not control** (a parser, a network error, a database error) is shown as `* (ref …)` when it is not plain ASCII or holds a double quote, a `%` or an address.
- **For a database error,** the fields that cannot hold row data (its code, table, column, constraint) are printed, never the row itself.
- **Sunflower's listing labels** for the entries it leaves out are printed as a count only.

What such a log can still contain:

- short plain-ASCII words in an address (one word, or two joined by one `-` or `_`, such as a page name);
- a plain-ASCII error message from a library;
- words that belong to no operator: the scraper's own messages, HTTP statuses, error codes, host names.

To find the page behind a reference:

- Run a dry run of that operator (`pnpm scrape --operator <id> --dry-run`, whose output is not public) and search its output for the eight characters.
- Each `page {…}` line carries the page's `ref`, and any line about a page or message the public log hides prints it whole, followed by the same reference.
- A page that the dry run does not reach (one not fetched again, say) has no `page` line.
- A hidden database message is not repeated by a dry run, which uses an in-memory database.

### Replaying saved crawls

`pnpm replay --base <commit>` shows what a change to places or route rules does to real tours.

- It re-reads the saved crawl logs (git-ignored, under `.superpowers/raw-pages/`) offline, with the working tree's rules and that commit's, and lists every tour whose route changed.
- `--save` and `--before` compare with an earlier replay instead. It replays the parser output as logged.
- A page whose log gives no day count (logged, in the title or in the code) is given one day per day heading, since the too-far rule depends on it. The run prints how many pages per operator are so, and marks them in the list.

### Running the website locally

1. Create `apps/web/.env.local` (git-ignored) with a line `DATABASE_URL=<connection string>`. For a hosted database, optionally add `DATABASE_CA_CERT=<certificate>`.
2. Run `pnpm --filter @hktours/web dev`.

To create or update the tables, run `pnpm db:migrate` with `DATABASE_URL` set.

The certificate in `.env.local`:

- It must be on one line, with the two characters `\n` in place of each line break: `DATABASE_CA_CERT=-----BEGIN CERTIFICATE-----\nMII…\n-----END CERTIFICATE-----`.
- `awk '{printf "%s\\n", $0}' '<certificate file>'` prints it in that form.
- Pasted as-is over several lines, it would be read as its first line only.
- A value that is set but is not a whole certificate does not silently turn verification off. Every page that reads the database fails with the error `DATABASE_CA_CERT is not a PEM certificate` in the server's output (the error does not show the value), and the page shows its "could not load" message.

### Environment variables

| Name | Used by | Meaning |
|---|---|---|
| `DATABASE_URL` | website, scraper, `pnpm db:migrate` | Postgres connection string. Never commit it. TLS is always used unless the host is `localhost`, `127.0.0.1`, `::1` or a Unix socket; TLS parameters in the string (`sslmode`, `ssl`, `sslcert`, `sslkey`, `sslrootcert`, `sslnegotiation`) are removed and have no effect. |
| `DATABASE_CA_CERT` | website, scraper, `pnpm db:migrate` | Optional but recommended for a hosted database: the PEM text of the database's CA certificate (real line breaks, or `\n` in their place). With it the server's identity is verified; without it the connection is encrypted but not verified, and a warning is logged. Empty counts as not set. Text that is not a certificate stops the program with an error that does not show the value. |

## Layout

- **`packages/core`:** shared types, the places list, route extraction, search suggestions, chain date maths.
  - The places list is `src/places/data.json`, with Simplified Chinese names in `src/places/names.zh-Hans.json`.
  - After any change to the list, regenerate the names with `python3 scripts/gen-zh-hans-names.py` from `packages/core`. It needs the system OpenCC library (on Debian/Ubuntu, `libopencc1.1`).
- **`packages/db`:** schema (`migrations/`), database access, `pnpm db:migrate`.
- **`packages/scraper`:** the polite fetcher, one scraper per operator, the `pnpm scrape` command.
- **`apps/web`:** the Next.js website (`/` search, `/chain` chaining).
  - **Languages:** Traditional Chinese by default. The switch in the nav bar offers Simplified Chinese and English (texts in `lib/dict.*.ts`) and remembers the choice in a one-year `locale` cookie. In those two languages a notice at the top says tours are normally conducted in Cantonese.
  - **Freshness:** pages are rendered per request, but each database result is reused for up to an hour (`lib/cached-reads.ts`). A result shown is at most an hour old, so after the nightly scrape a page may show the previous results for up to an hour.
  - **Per deployment:** when Vercel gives the functions its system environment variables (the project setting "Enable access to System Environment Variables"), the results are kept per commit and environment (production, preview). A new commit's deployment starts with an empty cache, while a redeploy of the same commit reuses its results. Without them, every deployment shares the results; the one-hour limit still holds.
- **`.github/workflows/`:** `ci.yml` (tests, typecheck, build) and `nightly-scrape.yml` (the nightly run).

This has not been reviewed by a lawyer.
