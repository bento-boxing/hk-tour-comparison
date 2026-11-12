# Hong Kong Tour Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task is its own file in this folder; read this file first, then your task file.

**Goal:** A Traditional Chinese website that lists package tours scraped nightly from four Hong Kong operators, with filtering and tour chaining.

**Architecture:** A pnpm monorepo. Pure logic (dates, places, matching, URL state) lives in `packages/core` with no I/O. `packages/db` owns the Postgres schema and every query. `packages/scraper` fetches operator pages politely and turns them into the shared tour shape. `apps/web` is a Next.js site that only reads the database.

**Tech Stack:** TypeScript, Node 24 LTS, pnpm workspaces, Vitest, zod, Crawlee, cheerio, `pg`, PGlite (tests only), Next.js (App Router), React Testing Library, Supabase Postgres, Vercel, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-12-hk-tour-comparison-design.md`
**Mockup (the visual source of truth):** `docs/design/mockup.html` — open it in a browser.

## Global Constraints

- Store and display facts only: operator, code, URL, title, days, nights, stops, start/end point, departure dates, prices. Never store or show itinerary prose or photos.
- Obey each operator's robots.txt. Never call a disallowed path, log in, or work around bot protection.
- At most one request every 3 seconds per operator site, one connection at a time.
- User-Agent for all scraper requests is exactly `tour-comparison-bot/0.1`: generic, with no repository address, account name or personal details (owner decision).
- Public UI language is Traditional Chinese (`zh-Hant`) only. English is shown only when `DEV_LOCALE=en` and `VERCEL_ENV` is not `production`. No language switcher.
- All dates are calendar dates as `YYYY-MM-DD` strings in Hong Kong time. Never use local-timezone `Date` arithmetic; use UTC-based helpers from `packages/core/src/chain.ts`.
- Prices are whole Hong Kong dollars as integers (`priceHkd`).
- A tour's key everywhere outside the database is `<operatorId>:<code>`, e.g. `egl:HTBKOK06`.
- Operator ids: `egl`, `jetour`, `texpert`, `bigline`.
- Palette: snow `#fffcff`, charcoal `#50514f`, cerulean `#247ba0`, ash grey `#cbd4c2`, khaki beige `#c3b299`. Operator colours: egl `#d62839`, jetour `#ee7b06`, texpert `#7d3cc8`, bigline `#2a9d4b`.
- Free tiers only: Vercel hobby, Supabase free, GitHub Actions on a public repo.
- The repo is public. Saved operator pages used as test fixtures must be trimmed to the elements the parser reads (see Task 14); do not commit full copies of operator pages.
- Test-driven: write the failing test first, see it fail, implement, see it pass, commit.
- No secrets in the repo. Database URL comes from `DATABASE_URL`.

## Review Focus

Inputs the spec implies but does not spell out. Each has a pinning test in the task named.

1. A chain link whose tour or departure disappeared after a later scrape → earlier legs stay, the missing leg and everything after it are dropped, and a notice is shown. (Tasks 21, 25)
2. Hand-edited or garbage URL parameters (bad dates, `gap=5-1`, negative numbers, unknown tour keys) → fall back to defaults, never crash. (Tasks 9, 24, 25)
3. A tour page with no day-by-day headings, or headings matching no known place → the tour is not saved, is counted as a parse failure, and its heading text goes to the unmatched log. (Tasks 5, 13)
4. Price text variants and junk (`HK$7,999起`, `$7999+`, `7,999 元`, empty, `0`, values under 100) → parsed to an integer or rejected as null. (Task 2)
5. A search-bar query matching nothing, or only whitespace → no suggestions and the message `沒有相符地區`; a results page with zero tours shows `找不到符合條件的旅行團`. (Tasks 8, 23, 24)

## File Structure

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, vitest.workspace.ts, .gitignore
.github/workflows/ci.yml            tests + typecheck on push
.github/workflows/nightly-scrape.yml
docs/design/mockup.html             approved mockup
docs/operators/<id>.md              per-operator findings (Task 14)
packages/core/src/
  types.ts          shared types
  schema.ts         zod schema for ScrapedTour, parsePriceHkd
  places/data.json  country → region → city list
  places/index.ts   buildPlacesIndex, lookups
  stops.ts          extractStops (day headings → stops)
  start-point.ts    normaliseStartPoint
  normalise.ts      normaliseTour
  chain.ts          date maths: addDays, tourEndDate, gapWindow
  price.ts          comparePrice
  destination.ts    tourMatchesDestination
  suggest.ts        suggestRegions
  chain-url.ts      encodeChain, decodeChain
packages/db/
  migrations/0001_init.sql
  src/db.ts         Db interface, pg adapter
  src/test-db.ts    PGlite adapter for tests
  src/save-run.ts   saveOperatorRun
  src/search.ts     searchTours, getToursByKeys, getOperators
packages/scraper/src/
  types.ts          OperatorScraper
  polite-fetch.ts   robots + rate limit + User-Agent
  sitemap.ts        readSitemapUrls
  check-run.ts      checkRun
  run-operator.ts   runOperator
  cli.ts            entry point
  operators/<id>/   index.ts, discover.ts, parse.ts, parse.test.ts, fixtures/
apps/web/
  app/              layout.tsx, page.tsx (search), chain/page.tsx
  components/       TourCard, DestinationSearch, DestinationPanels, FilterBar,
                    DeparturePicker, ChainStrip, GapSelector
  lib/              i18n.ts, dict.zh-Hant.ts, dict.en.ts, theme.css, search-params.ts
```

## Tasks

Do them in order unless noted. Within Tasks 3–9, the chains 3 → 4 → 5, 3 → 8 and 6 → 7, 6 → 9 can run side by side. Tasks 15–18 depend on 13 and 14 and can run in parallel. Tasks 22–23 can run in parallel.

Owner involvement: Task 1 (create the public GitHub repository), Task 14 (approve or drop each operator), Tasks 15–18 (confirm the hand-checked expected values against the live pages), Task 26 (accounts, secrets, deployment).

| # | File | Deliverable |
|---|---|---|
| 1 | `task-01-scaffold.md` | Monorepo with tests and CI running |
| 2 | `task-02-core-types.md` | Shared types, scraped-tour schema, price parser |
| 3 | `task-03-places.md` | Places list and lookup |
| 4 | `task-04-stops.md` | Day headings → city stops |
| 5 | `task-05-normalise.md` | Start-point rule and scraped → normalised tour |
| 6 | `task-06-chain-dates.md` | End date and gap window maths |
| 7 | `task-07-price-compare.md` | 7-day price comparison |
| 8 | `task-08-destination-suggest.md` | Destination matching and search suggestions |
| 9 | `task-09-chain-url.md` | Chain in the page address |
| 10 | `task-10-db-schema.md` | Database schema and test database |
| 11 | `task-11-save-run.md` | Saving a night's scrape |
| 12 | `task-12-check-run.md` | Sanity checks on a run |
| 13 | `task-13-scraper-core.md` | Polite fetcher and operator runner |
| 14 | `task-14-operator-investigation.md` | Terms, dates and fixtures per operator (gate) |
| 15 | `task-15-jetour.md` | Jetour scraper |
| 16 | `task-16-texpert.md` | Travel Expert scraper |
| 17 | `task-17-bigline.md` | Big Line scraper |
| 18 | `task-18-egl.md` | EGL scraper |
| 19 | `task-19-nightly.md` | CLI and nightly schedule |
| 20 | `task-20-web-scaffold.md` | Next.js app, theme, language, layout |
| 21 | `task-21-search-queries.md` | Database queries for search and chaining |
| 22 | `task-22-tour-card.md` | Tour card |
| 23 | `task-23-destination-picker.md` | Search bar and country/region panels |
| 24 | `task-24-search-page.md` | Search page with filters and sorting |
| 25 | `task-25-chain-page.md` | Departure picker and chaining page |
| 26 | `task-26-deploy.md` | Hosting, secrets, first run, visual check |

## Conventions

- Run all tests: `pnpm test`. One package: `pnpm --filter @hktours/core test`. One file: `pnpm vitest run <path>`.
- Typecheck: `pnpm typecheck`.
- Commit at the end of every task with a `feat:`, `test:`, `chore:` or `docs:` prefix.
- A task marked **Owner step** needs the repository owner, not an agent. Stop and ask.
