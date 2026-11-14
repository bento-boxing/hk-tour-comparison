# 旅行團比較 · Hong Kong tour comparison

A website that gathers package-tour listings from Hong Kong tour operators into one place, so a traveller can filter and compare them and chain tours one after another with a chosen break in between. A small scraper collects the listings once a night; the website only reads from the database and never contacts the operators.

This project is **not affiliated with any tour operator**. It stores and shows facts only (operator, tour code, link, title, length, the cities visited, start and end point, departure dates and prices) and links to the operator's own page for everything else. It stores no itinerary text and no photos. Prices and dates must always be confirmed on the operator's site.

## Operators included

| Operator | Site |
|---|---|
| Jetour 捷旅 (`jetour`) | jetour.com.hk |
| Travel Expert 專業旅運 (`texpert`) | texpert.com |
| EGL Tours 東瀛遊 (`egl`) | egltours.com |
| Charming Holidays 翠明假期 (`charming`) | charming-online.com |

Big Line Holiday 大航假期 (`bigline`) has a scraper but is not yet in the nightly run: it waits for a measured crawl. The findings for each operator are in [`docs/operators/`](docs/operators/).

## How the scraper treats operators' sites

Every request carries the User-Agent `tour-comparison-bot/0.1`. Before requesting any page from a site the scraper reads that site's `robots.txt` and never requests a path it disallows; if `robots.txt` cannot be read, the site is not crawled at all. It sends one request at a time to each site and waits at least 3 seconds after each response before the next request (longer if `robots.txt` sets a `Crawl-delay`; a site asking for more than 30 seconds is not crawled). A request that fails with a network error, a timeout or a 5xx answer is retried at most twice; a 4xx answer, or a 503 with a `Retry-After` header, is not retried. If a site answers page requests with HTTP 403, 429 or 503 three times in a row (a successful page in between starts the count again), the scraper requests nothing more from that site for the rest of the run, and a run in which more than 20% of the tour pages found could not be fetched fails its checks and saves nothing. It runs once a night, never logs in, and never works around bot protection. Big Line's tour data comes from its own data address, `api.biglinehk.com`, which answers only requests carrying the site's fixed key `tenantCode: DH` (written in its public pages, the same for every visitor); with the owner's approval the scraper sends that one header, to that address only, and asks for each tour's departures with one POST per month, for at most three months. A POST is never retried. The code is in [`packages/scraper/src/polite-fetch.ts`](packages/scraper/src/polite-fetch.ts).

## Removing your listings

If you represent a tour operator and want your listings removed, please open an issue in this repository's GitHub **Issues** tab. Your listings will be removed and your site will no longer be scraped.

## Working on it

Needs Node.js 20.19 or later and pnpm 10 (`corepack enable` picks the version named in `package.json`).

```sh
pnpm install
pnpm test        # all tests (they use an in-memory database; nothing is contacted)
pnpm typecheck
```

A dry run of one operator's scrape, which fetches real pages from the operator's site (politely, as above) but writes nothing to any database:

```sh
pnpm scrape --operator jetour --dry-run --limit 5
```

`--operator` is one of `jetour`, `texpert`, `egl`, `bigline` or `charming` (the nightly run scrapes `charming`, `egl`, `jetour` and `texpert`; `bigline` waits for a measured crawl). `--limit N` is allowed only with `--dry-run`. A real run (`pnpm scrape --operator <id>`) needs `DATABASE_URL` (and uses `DATABASE_CA_CERT` when it is set).

To run the website locally, create `apps/web/.env.local` (git-ignored) with a line `DATABASE_URL=<connection string>` (and, for a hosted database, optionally `DATABASE_CA_CERT=<certificate>`), then `pnpm --filter @hktours/web dev`. In `.env.local` the certificate must be on one line, with the two characters `\n` in place of each line break (`DATABASE_CA_CERT=-----BEGIN CERTIFICATE-----\nMII…\n-----END CERTIFICATE-----`); `awk '{printf "%s\\n", $0}' '<certificate file>'` prints it in that form. Pasted as-is over several lines, it would be read as its first line only. A value that is set but is not a whole certificate does not silently turn verification off: every page that reads the database fails with the error `DATABASE_CA_CERT is not a PEM certificate` in the server's output (the error does not show the value), and the page shows its "could not load" message. To create or update the tables: `pnpm db:migrate` with `DATABASE_URL` set.

### Environment variables

| Name | Used by | Meaning |
|---|---|---|
| `DATABASE_URL` | website, scraper, `pnpm db:migrate` | Postgres connection string. Never commit it. TLS is always used unless the host is `localhost`, `127.0.0.1`, `::1` or a Unix socket; TLS parameters in the string (`sslmode`, `ssl`, `sslcert`, `sslkey`, `sslrootcert`, `sslnegotiation`) are removed and have no effect. |
| `DATABASE_CA_CERT` | website, scraper, `pnpm db:migrate` | Optional but recommended for a hosted database: the PEM text of the database's CA certificate (real line breaks, or `\n` in their place). With it the server's identity is verified; without it the connection is encrypted but not verified, and a warning is logged. Empty counts as not set. Text that is not a certificate stops the program with an error that does not show the value. |
| `DEV_LOCALE` | website | Set to `en` to see the developer English text. Ignored in production (`VERCEL_ENV=production`): the public site is Traditional Chinese only. |

## Layout

- `packages/core`: shared types, the places list (`src/places/data.json`), route extraction, search suggestions, chain date maths.
- `packages/db`: schema (`migrations/`), database access, `pnpm db:migrate`.
- `packages/scraper`: the polite fetcher, one scraper per operator, the `pnpm scrape` command.
- `apps/web`: the Next.js website (`/` search, `/chain` chaining).
- `.github/workflows/`: `ci.yml` (tests, typecheck, build) and `nightly-scrape.yml` (the nightly run).
- `docs/launch-checklist.md`: the steps to put the site online.

This has not been reviewed by a lawyer.
