# Launch checklist

This is the owner's task list for putting the site online. Work through it from top to bottom. Each item says what to do and what you should see if it worked. Tick the box (`- [x]`) when an item is done, and write a short note under any item that did not go as described. That note is what the assistant needs to fix it.

Two rules for the whole list:

- **Never paste the database connection string into a chat, an issue, a commit or a screenshot.** It contains the database password. It belongs only in Supabase, the GitHub secret, Vercel, and (if you run a command locally) your own terminal.
- If something fails, send the assistant the error lines from the log, not the connection string. GitHub hides repository secrets in its logs as `***`; if you ever see the full string in any log, change the database password in Supabase.

Contents:

1. Check the scrapers' expected values
2. Decide on the two operators not included
3. Accounts and going live
4. Look at the site
5. Operations after launch
6. Known limits and open judgement calls

---

## 1. Check the scrapers' expected values

For each operator the scraper is tested against three saved copies of real pages. The expected answer for each saved page was written by the assistant, not by you, and is marked `"verifiedByOwner": false`. Please compare each one with the operator's live page.

These values were read from the files as they stand at commit `d3558ec`. If the assistant changes an expected file later, it should update this section too.

**How to compare.** Open the source URL in a browser. The pages were saved on 12–13 November 2026, so by the time you check, some early dates may have passed and prices may have changed. That is not an error. Check that:

- the number of days matches;
- the "from" price matches the lowest price the page shows (the page's own `起` / `每人價格起` price);
- the listed dates that are still in the future appear on the page with the same prices;
- the route (the cities in order) is a fair reading of the day-by-day headings. The route leaves out Hong Kong and the meeting point (for example a Shenzhen border crossing), and lists cities only, not attractions.

**How to record the result.** For each file that is right, change `"verifiedByOwner": false` to `"verifiedByOwner": true` in the file named below and commit it (push it after the one-time step in 3.0), or tell the assistant "<file> is correct". For anything that is wrong, tell the assistant which file, which value, and what the page shows instead.

### Jetour

Files are in `packages/scraper/src/operators/jetour/fixtures/`.

- [ ] **`multi-city.expected.json`**: https://www.jetour.com.hk/tour/THB
  - Code THB, title `8天從容慢遊・東北冰雪童話`.
  - Days: 8.
  - From price: HK$20,998 (the 限時優惠 offer price; the struck-out original is HK$22,998).
  - Departures: only two were listed: 2026-12-22 HK$20,998; 2026-12-26 HK$20,998.
  - Route: 哈爾濱 → 漠河 → 北極村 → 漠河 → 哈爾濱.
  - Meeting point: 香港國際機場.
- [ ] **`simple.expected.json`**: https://www.jetour.com.hk/tour/TSEQ
  - Code TSEQ, title `6天江南秋色 · 洲際臻選`.
  - Days: 6.
  - From price: HK$2,798.
  - Departures: only two were listed: 2026-11-25 HK$2,798; 2026-12-08 HK$3,198.
  - Route: 上海 → 無錫 → 湖州 → 杭州 → 濮院. Days 1 and 6 say `杭州/上海` next to 香港 (fly in or out of either city); the first route rule below drops that, so the route starts in 上海, as the day 1 title `香港出發前往上海` says.
  - Meeting point: 香港國際機場.
- [ ] **`edge.expected.json`**: https://www.jetour.com.hk/tour/江門,新會,珠海美食純玩之旅
  - Expected: no tour is read from this page. When it was saved it had no tour code, a price of `HKD 0` and no departures (`沒有數據。`). Confirm the live page has no bookable tour on it either.

### Travel Expert

Files are in `packages/scraper/src/operators/texpert/fixtures/`. Travel Expert also charges a service fee paid locally on top of the listed price; the stored price is the listed price without that fee, the same as the page's `每人價格起`.

- [ ] **`multi-city.expected.json`**: https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city
  - Code TDZC05R, title `5天 衡陽、長沙、張家界、鳳凰古城 高鐵抵玩團(深圳集散)`.
  - Days: 5.
  - From price: HK$999.
  - First three departures: 2026-11-27 HK$999; 2026-11-29 HK$999; 2026-12-02 HK$999 (45 dates in all, up to 2027-02-28).
  - Route: 衡陽 → 長沙 → 張家界 → 鳳凰古城 → 衡陽. The last 衡陽 is the train home through 衡陽東 station. Say whether you want it kept.
  - Start 福田口岸, end 福田/羅湖口岸.
- [ ] **`simple.expected.json`**: https://www.texpert.com/zh-hk/tour/1386-guangdong-tour-2-day-pure-play-with-special-natural-sea-hot
  - Code YAWK02R, title `【廣東省團】特色天然海洋溫泉江門禦泉湖居溫泉酒店 溫泉美食純玩2天`.
  - Days: 2.
  - From price: HK$539 (service fee HK$160 extra, paid locally).
  - First three departures: 2026-12-12 HK$599; 2026-12-15 HK$539; 2026-12-19 HK$599 (23 dates in all, up to 2027-03-20).
  - Route: 江門.
  - Start 深圳口岸, end 深圳灣/羅湖口岸.
- [ ] **`edge.expected.json`**: https://www.texpert.com/zh-hk/tour/1359-guangdong-province-tour-1-day-new-huanggang-experience
  - Code YDEA01R, title `【廣東省團】1天「皇崗新體驗」非遺老街 K11 ECOAST 歎大閘蟹+乳鴿 東莞美食純玩`.
  - Days: 1.
  - From price: HK$139 (service fee HK$80 extra, paid locally).
  - First three departures: 2026-11-14 HK$139; 2026-11-15 HK$139; 2026-11-21 HK$139 (12 dates in all, up to 2026-12-20).
  - Route: 東莞.
  - Start 新皇崗口岸, end 深圳灣口岸/新皇崗口岸.

### Route rules to confirm

The route on each card comes from the day-by-day headings. Three rules decide what counts as a stop. Please say whether you agree with each one.

- [ ] **Either/or flight city (Jetour).** On the first day or the last day, a heading segment right next to 香港 that offers two cities with a slash, such as `杭州/上海`, is dropped. (It means "fly into or out of one of these"; guessing either city would be wrong.) If you disagree, a tour that really starts or ends in two cities written with a slash will lose them from its route.
- [ ] **A plane or train change is not a stop.** Any part of a heading containing 轉機, 中轉, 轉乘 or 過境 (for example `途經巴黎轉機`, `中轉深圳北/廣州南`) gives no stop. If you disagree, connection cities appear on routes as if they were visited.
- [ ] **A single foreign stop in a one-country tour is a name collision.** When one stop, neither the first nor the last, is in a different country from at least three other stops that are all in one country, it is treated as a place that only has the same name as a foreign city, and it is dropped (and written to the unmatched list for review). **In the code as it is now, this applies only to names on a short list of known collisions, currently 塔林 and 黃金海岸** (`collisionNames` in `packages/core/src/places/data.json`). Example: 塔林 on an all-China tour is the Shaolin Pagoda Forest, not Tallinn. It was narrowed to that list because, applied to every name, it also removed real day trips across a border (Kirkenes on Finnish Lapland tours, Vaduz, Tirano, the Vatican, San Marino).

### Jetour pages without departure dates (decides whether Jetour's numbers can be trusted)

- [ ] **78% of Jetour's tour pages (353 of 453) showed no departure dates when fetched.** The saved pages carry Jetour's own `沒有數據。` ("no data") text where the dates would be and no sign of dates being loaded by script, and two crawls on 13 November gave about the same count (about 351 and 353; see `docs/operators/jetour.md`), but nobody has compared one with a browser. **Open three Jetour tours that the scraper says have no dates, and confirm the live page shows no departure dates either.** If any of them shows dates in the browser, the scraper is missing them, and most of Jetour's tours would be missing from the site: tell the assistant which tours.

  How to find such tours: a Jetour tour with no dates is never saved, so it is **not in the database** and does not appear on the comparison site. Two ways:
  - **A short dry run** on your computer (after `pnpm install`; it fetches about 20 pages from Jetour, politely, and writes nothing to any database): `pnpm scrape --operator jetour --dry-run --limit 20`. Each page without dates is printed as `jetour: skipped <address>: no-departures`, and its `page {…}` line says `"result":"no-departures"`. Open three of those addresses. The run takes a minute or two. The output comes in this order:
    1. `dry run of jetour: nothing is written to the database`;
    2. while the pages are read, a line for each page that is skipped or fails (`jetour: skipped <address>: no-departures`, or `jetour: parse failure <address>: <reason>`; a page that gives a tour prints nothing here), then the run's own result line, `jetour: failed (below-minimum), 0 tours saved, 20 tour pages, …`;
    3. one `page {…}` line for each page read;
    4. the summary: `dry-run summary: jetour, <date>`, `tour pages discovered: …` (with `(limited to the first 20)`), `tour pages fetched: 20` (fewer if a page could not be fetched), `tours saved: 0`, `parse failures: …`, then `run checks: failed (below-minimum)` (or `failed (no-tours, below-minimum)` if none of the 20 had dates);
    5. last, `unmatched names: <number> (pages each appeared on, most frequent first)` followed by one line per name (a count and the name), so the very end of the output is that list of names.

    pnpm then reports the command as failed. **That is expected**: 20 pages give far fewer tours than the first-run minimum of 35 (see 3.4). It is not a fault.
  - **From Jetour's own site**, once 3.4 has saved data: pick tours from Jetour's listing pages and check whether each appears on the comparison site. To see the Jetour tours that were saved, in Supabase → SQL Editor:

    ```sql
    select code, title, url from tours where operator_id = 'jetour' and active order by code;
    ```

    A Jetour tour that is not in this list either had no dates on sale when it was fetched or could not be read. Open its Jetour page and check whether it shows departure dates.

---

## 2. Decide on the two operators not included

The site launches with Jetour and Travel Expert only. The other two operators need your decision. Until you decide, nothing changes: they are never contacted, and no tours of theirs appear.

- [ ] **EGL Tours 東瀛遊.** Its website terms could not be read. The terms page holds no text itself; it only links to ten booking-terms PDF files, which have not been read (you had allowed one page fetch, and that was used on the terms page). Its departure dates are reachable within its robots.txt. Choose one:
  - **Read the PDFs yourself** (the ten links are under "Terms" in `docs/operators/egl.md`, and the four that matter most are named under "Recommendation") and tell the assistant whether any of them forbids automated access, scraping or copying of the site's content. If none does, the assistant builds the EGL scraper, and you then check three EGL saved pages the same way as section 1. If one does, choose between dropping EGL and asking EGL for permission.
  - **Allow up to ten more page fetches** so the assistant reads the PDFs and reports their wording. The outcome then follows as above.
  - **Leave EGL out.** Nothing more is done.
- [ ] **Big Line Holiday 大航假期.** All of its tour data comes from a separate data address (`api.biglinehk.com`), which refuses a plain request (it answers "unauthorised"). It appears to need a header that the site's own app sends, which was deliberately not sent, because imitating the site's app is against this project's rules. Its departure dates also come only from a different kind of request (a POST) that the scraper does not make. Its terms could not be read for the same reason. Choose one:
  - **Leave Big Line out** (the current state). Nothing more is done.
  - **Ask Big Line for access** (for example permission to use its data address). If they agree in writing, the assistant can build the scraper on the terms they give.
  - Sending the site's own header and making the POST request would break this project's rules (no imitating the site's app, plain page requests only). The assistant will not do this unless you change those rules yourself.

The details are in `docs/operators/egl.md` and `docs/operators/bigline.md`.

---

## 3. Accounts and going live

Do these in order. Steps 3.1 to 3.3 can be done any time; the scrape (3.4) needs the secret from 3.3; the site (3.6) needs data from 3.4 to show anything.

### 3.0 Check the repository settings

- [ ] **Connect your local copy to the GitHub repository (once).** The repository already exists and is yours: https://github.com/bento-boxing/hk-tour-comparison (address for git: `git@github.com:bento-boxing/hk-tour-comparison.git`). The assistant has pushed `main` to it.
  - On its page, check that it shows a **Public** label next to the name. GitHub Actions minutes are free and unlimited only for public repositories.
  - In a terminal, in the repository folder, run `git log -1 --oneline`. Its first word (a short commit code, such as `2f67bf2`) must match the code of the latest commit shown on the repository page (above the file list, next to the latest commit message). If they differ, the assistant has commits that are not pushed yet, or GitHub has commits your copy lacks: ask the assistant before pushing anything.
  - Then run, once:

    ```sh
    git remote add origin git@github.com:bento-boxing/hk-tour-comparison.git
    git push -u origin main
    ```

    This is needed because the assistant pushed by giving the address each time and could not save the remote in your copy's git settings, so until you run it, a plain `git push` from your terminal fails (it says there is no configured push destination). The second command should say `Everything up-to-date` or push your newer commits. If it fails with `Permission denied (publickey)`, this computer has no SSH key that your GitHub account knows: send the assistant that line, and leave the pushes in 3.5 and 3.7 until it is solved (nothing else in this list needs a push). After this, `git push` on its own works, and every `git push` in this list means that.
  - **Before every commit and push of your own**, run `git status` and check that no file whose name starts with `.env` is listed under "Changes to be committed" (the only exception is `apps/web/.env.example` in 3.7, which holds no secrets). `.gitignore` keeps such files out unless they are added by force, but check anyway: the repository is public.
- [ ] The GitHub CI workflow (tests, typecheck, build) runs on GitHub after every push. It passed for an earlier push (commit `93ebd55`); the result for the latest commit is on the repository's **Actions** tab (workflow **CI**): a green tick means it passed, a red cross that it failed. If the latest run failed, send the assistant the failed step's log.
- [ ] **Issues are switched on** (Settings → General → Features → Issues ticked). The README tells operators to open an issue to have their listings removed.

### 3.1 Create the Supabase project

- [ ] Sign in at supabase.com and create a new project on the **Free** plan.
  - Region: **Southeast Asia (Singapore)**, the closest Supabase region to Hong Kong.
  - Database password: choose one with **letters and digits only**. Symbols such as `@ : / # ?` would have to be specially encoded inside the connection string, and are an easy mistake. Keep the password in your password manager.
- [ ] Copy the **connection pooler** string in **transaction mode**: in the project, click **Connect** (top of the page) and choose the connection string for the **Transaction pooler**. It looks something like `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`; the part to check is port **6543**, which is transaction mode. Replace `[YOUR-PASSWORD]` with your password. This is the string the scraper and the website use, because it works from GitHub Actions and Vercel's serverless functions. Use it as Supabase gives it; you do not need to add anything about SSL. **TLS (encryption) is always used for a hosted database**: the code turns it on for any database that is not on your own computer, and any SSL setting in the string (such as `?sslmode=require` or `?sslmode=disable`) is removed and has no effect.
- [ ] Keep this string out of the repository and out of chat. Store it in your password manager.
- [ ] **Download the database's CA certificate (optional, recommended).** With it, the code also checks that the server it reaches really is your Supabase database (it verifies the server's identity). Without it the connection is still encrypted, but the server's identity is not verified, and the website and each scrape job log one line that says so:

  ```
  postgres: the database connection is encrypted but the server's identity is not verified; set DATABASE_CA_CERT to the database's CA certificate (PEM text) to verify it.
  ```

  - In the Supabase dashboard, open the project's **database settings** and find the **SSL** section, which has a button to download the certificate (something like Project Settings → Database → SSL Configuration → Download certificate). The exact menu wording may differ: the assistant could not check it.
  - The downloaded file is plain text. Opened in a text editor, it starts with `-----BEGIN CERTIFICATE-----` and ends with `-----END CERTIFICATE-----`. That whole text, with both of those lines and its line breaks, is the value called **`DATABASE_CA_CERT`** in 3.3 and 3.6. It holds no password, but there is no need to commit it.

### 3.2 Create the tables (optional: the workflow in 3.4 does the same)

The nightly workflow's first job runs the same command, so you can skip this and let step 3.4 create the tables. Run it here if you want to see it work first.

- [ ] On your computer, in the repository folder, with Node.js 20.19 or later: `corepack enable`, then `pnpm install`.
- [ ] Run, with your real string in place of `…`, the path of the certificate file from 3.1 in place of `<certificate file>`, and the quotes kept:

  ```sh
  DATABASE_URL='…' DATABASE_CA_CERT="$(cat '<certificate file>')" pnpm db:migrate
  ```

  If you did not download the certificate, leave out the `DATABASE_CA_CERT="…"` part; the command then also prints the "not verified" line from 3.1 before its other output.

  (The command stays in your shell history. In bash and zsh, starting the line with a space usually keeps it out; otherwise clear the history entry afterwards.)

  Expected: after pnpm's own `>` lines, it prints

  ```
  applied 1 migration:
    0001_init.sql
  ```

  Running it a second time prints `no migrations to apply`.
- [ ] In Supabase → **Table Editor**, the tables `operators`, `tours`, `tour_stops`, `departures`, `price_snapshots`, `scrape_runs`, `unmatched_places` and `schema_migrations` exist, and `operators` has **four rows** (egl, jetour, texpert, bigline). All four are listed even though only two are scraped.
- Supabase may warn that the tables have "Row Level Security enabled but no policies". That is intended: it blocks Supabase's public data API from reading or changing the tables. The scraper and the website connect as the database owner and are not affected.

### 3.3 Add the GitHub secret

- [ ] GitHub → the repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Name: `DATABASE_URL`. Value: the pooler string from 3.1. Save.
- [ ] Optional, recommended: a second repository secret the same way. Name: `DATABASE_CA_CERT`. Value: the certificate text from 3.1, pasted whole, from `-----BEGIN CERTIFICATE-----` to `-----END CERTIFICATE-----`. The nightly workflow passes it to both of its jobs. If this secret does not exist, the jobs still run, with an encrypted but unverified connection.
- [ ] GitHub → your profile picture → **Settings** → **Notifications** → **Actions**: make sure you get emails for **failed workflows**. A failed nightly run is how you hear that something is wrong.

### 3.4 Run the scrape once by hand (the smoke test)

Every test so far used an in-memory database. This run is the **first time the code talks to a real Postgres server** (through the `pg` driver), and the first real test of the encrypted connection, so treat it as the test of that part.

- [ ] GitHub → **Actions** → **nightly-scrape** (left list) → **Run workflow** → branch `main` → **Run workflow**.
- [ ] Expected:
  - The **migrate** job passes. Its `pnpm db:migrate` step prints `applied 1 migration:` / `0001_init.sql`, or `no migrations to apply` if you did 3.2.
  - Then two **scrape** jobs start, one for `jetour` and one for `texpert`. Each must finish within 170 minutes (the job limit). From the practice runs, expect about 30 minutes of fetching for Jetour (about 450 pages, about 3.5 seconds each) and about 7 minutes for Travel Expert (117 pages), plus the time to save to the database, which has not been measured against a real server.
  - The last line of each scrape job's `pnpm scrape` step looks like `jetour: ok, 98 tours saved, 453 tour pages, 1 parse failure, 900 unmatched names` (your numbers will differ). `ok` is what matters.
  - If you did not add the `DATABASE_CA_CERT` secret, the `pnpm db:migrate` step and each `pnpm scrape` step also print the "not verified" line from 3.1. That is expected.
- [ ] **Check the tour counts.** Jetour's sitemap (its list of pages) is rebuilt from time to time, and while it is being rebuilt it lists only a few tours: a confirmation crawl on 13 November (03:45 UTC) caught it listing one tour instead of about 450. On later nights the run checks refuse a run that saves fewer than 60% of the tours of the last good run (when that run saved at least 20). **A first run has no last good run to compare with**, so it must instead save at least a fixed number of tours, `minExpectedTours` in `packages/scraper/src/operators/<id>/index.ts`: **35 for Jetour and 40 for Travel Expert** (values at commit `5bb3a72`). A first run that saves fewer fails with `below-minimum`, and none of its tours is saved.
  - Most Jetour pages have no departure dates on sale, and a page with none is skipped, not counted as a failure: the log shows it as `jetour: skipped <address>: no-departures`, and hundreds of those lines are normal for Jetour. The test crawl on 13 November read 453 Jetour pages and found 99 pages with dates, which give **98 tours**: two of those pages (`/tour/EIMz` and `/tour/EIMM`) state the same tour code, `EIMM`, so whichever comes later is skipped as a duplicate (`jetour: skipped <address>: duplicate tour code EIMM, keeping the first`) on every run (see section 6). Travel Expert's read 117 pages and 112 tours. So expect about 450 `tour pages` and roughly 100 `tours saved` for Jetour, and about 117 pages and 112 tours for Travel Expert. The numbers move as dates go on and off sale.
  - A partial sitemap that still yields 35 or more Jetour tours would pass, so look at `tour pages` too. If Jetour shows far fewer than about 450 `tour pages`, or either job ends `failed (below-minimum)`, `failed (no-tours, below-minimum)` or `failed (discover-error)` (all the reasons are listed below), run the workflow again an hour or two later and tell the assistant what you saw. Do not turn on the schedule (3.5) until both operators have had one full run.
- [ ] Afterwards, in Supabase → **SQL Editor**, run:

  ```sql
  select operator_id, run_date, ok, pages_fetched, tours_saved, parse_failures, reasons,
         started_at at time zone 'Asia/Hong_Kong' as started_hk,
         finished_at at time zone 'Asia/Hong_Kong' as finished_hk
  from scrape_runs
  order by id desc
  limit 10;
  ```

  Expected: one row for `jetour` and one for `texpert`, each with `ok = true` and `reasons` empty (`{}`).
- [ ] **If a job fails**, open it, click the failed step, and send the assistant:
  - which job and step failed (`migrate`, or `scrape (jetour)` / `scrape (texpert)`, and the step name);
  - the last 30 or so lines of that step's log, including the error message. Each page that failed is listed with a reason (`parse failure <address>: <reason>`). The last line the scraper prints (pnpm adds its own error lines after it) reads `<operator>: failed (<reasons>), 0 tours saved, …`. The reasons, in the order they are listed when several apply:
    - `discover-error`: finding the operator's tour pages ended in an error inside the scraper's own discovery code. The line just before it, `<operator>: discover failed: <message>`, says why. No tour page was fetched and nothing was saved. Any run, first or later. (A sitemap or robots.txt that cannot be read is **not** this: the scraper then prints `not crawling <site>: robots.txt unreadable (…)` or `not fetched <sitemap address>: …`, finds no tour pages, and the run ends `failed (no-tours)`, or `failed (no-tours, below-minimum)` on a first run.) `discover-error` is always the only reason.
    - `no-tours`: no tour could be read at all, including when no tour pages were found. Any run. On a first run it comes with `below-minimum`.
    - `below-minimum`: **first run only** (no successful run of that operator in `scrape_runs` yet): fewer tours than the operator's `minExpectedTours` (35 for Jetour, 40 for Travel Expert).
    - `tour-count-dropped`: **later runs only**: fewer than 60% of the tours of the last successful run, when that run saved at least 20 (exactly 60% passes).
    - `too-many-parse-failures`: any run: more than 20% of the tour pages fetched were parse failures (exactly 20% passes). Pages skipped for `no-departures`, for a duplicate tour code, or because they could not be fetched are not parse failures.

  A job can also fail without such a line, when the error comes before or during the save, for example a connection problem. Its log then ends with an error message (and usually a list of code locations under it). The messages below point to that.

  Messages that point to the connection rather than the code:
  - `DATABASE_URL is not set` (in `migrate`: `DATABASE_URL is not set: it must name the database to migrate`): the `DATABASE_URL` secret does not exist or has a different name. Check 3.3.
  - `password authentication failed` (wrong password in the string), `Tenant or user not found` (the user part must be `postgres.<project-ref>`).
  - `Connection terminated due to connection timeout`: a new connection to the database did not complete within 8 seconds, because the database host did not answer. This is what an unreachable or paused database looks like: check the address in the string and that the project is not paused in Supabase. (A wrong host name usually fails at once instead, with `getaddrinfo ENOTFOUND` and the host name.)
  - `timeout exceeded when trying to connect` (rarer): the code waited 8 seconds for one of its own connections (it keeps at most 3) to become free, because all of them were busy. It points to a database that is answering very slowly or a stuck query rather than to a wrong address; send the assistant the log.
  - `The database connection string is not a valid Postgres URL`: the `DATABASE_URL` secret is not a `postgresql://…` string. The message never shows the string.
  - `DATABASE_CA_CERT is not a PEM certificate`: the `DATABASE_CA_CERT` secret is not the whole certificate text. The job stops before connecting (exit code 2). Paste it again from the file.
  - A certificate error, for example `self-signed certificate in certificate chain`, `unable to get local issuer certificate` or `Hostname/IP does not match certificate's altnames`: the certificate in `DATABASE_CA_CERT` does not verify the server. Check that it was downloaded from this project. If it still fails, delete the `DATABASE_CA_CERT` secret (the connection then stays encrypted, but unverified) and send the assistant the error.
  - Anything else mentioning SSL or TLS.

  Do not loosen the run checks in `packages/scraper/src/check-run.ts` to make a run pass; the assistant should fix the parser or the places list instead.

### 3.5 Turn on the nightly schedule

Only after 3.4 passed for both operators.

- [ ] In `.github/workflows/nightly-scrape.yml`, change these lines near the top:

  ```yaml
    # Enabled in Task 26, once the DATABASE_URL repository secret exists.
    # schedule:
    #   - cron: '0 18 * * *'   # 18:00 UTC = 02:00 Hong Kong
  ```

  to:

  ```yaml
    schedule:
      - cron: '0 18 * * *'   # 18:00 UTC = 02:00 Hong Kong
  ```

  (`schedule:` lines up with `workflow_dispatch:` below it.) Commit and push to `main`, for example `git add .github/workflows/nightly-scrape.yml`, `git commit -m "ci: run the nightly scrape on a schedule"`, `git push` (this needs the one-time `git remote add origin …` step in 3.0, and the `git status` check there before you commit). Or ask the assistant to make this change.
- [ ] Expected: GitHub → Actions → nightly-scrape now shows the schedule, and the next morning there is a run that started shortly after 02:00 Hong Kong time. GitHub often starts scheduled runs some minutes late; that is normal.

### 3.6 Deploy the site on Vercel

- [ ] Sign in at vercel.com (the free **Hobby** plan) → **Add New…** → **Project** → import this GitHub repository.
- [ ] On the import screen:
  - **Root Directory**: `apps/web`.
  - **Framework Preset**: Next.js (it should be picked automatically).
  - **Install Command** and **Build Command**: leave them at their defaults at first. The repository is a pnpm workspace (`pnpm-lock.yaml` and `pnpm-workspace.yaml` at the top level, `packageManager: pnpm@10.34.9` in the top-level `package.json`), and `pnpm install` run inside `apps/web` installs the whole workspace. The build is `next build`, the same build the GitHub CI workflow runs (`pnpm --filter @hktours/web build` in `.github/workflows/ci.yml`). That CI build passed on GitHub for commit `93ebd55`; for the latest commit, see the repository's **Actions** tab (3.0). Not confirmed: whether Vercel's default Install Command is enough for this workspace. If the build log shows `npm install` or `yarn` instead of `pnpm install`, or fails with `Cannot find module '@hktours/core'` (or `@hktours/db`), the default is not enough: set Install Command to `pnpm install --frozen-lockfile` and redeploy.
  - **Environment Variables**: add `DATABASE_URL` with the pooler string from 3.1, for **Production** and **Preview**. If you downloaded the certificate in 3.1, also add `DATABASE_CA_CERT` with the certificate text, pasted whole, for the same two. Do **not** add `DEV_LOCALE` here.
  - Click **Deploy**.
- [ ] After the project exists, in the project's **Settings**:
  - **Build and Deployment** → Root Directory section: **"Include files outside the root directory in the Build Step"** must be **on**. The website uses the code in `packages/core` and `packages/db` directly from source (`transpilePackages` in `apps/web/next.config.ts`), so the build needs files outside `apps/web`. It is normally on by default; check it.
  - **Build and Deployment** → **Node.js Version**: choose **20.x** if it is offered. If it is not (Node 20 reached end of life in April 2026), choose **22.x**. The code uses nothing newer than Node 20 and has only been tested on Node 20; nothing in it is known to need changes for 22, but that has not been tried.
  - **Functions** → **Function Region**: **Singapore (sin1)**, next to the database.
  - **Environment Variables**: if you want to see the developer English text, add `DEV_LOCALE` = `en` for **Preview** or **Development** only, never **Production**. (The code ignores it in Production anyway, but do not rely on that.)
  - After changing any setting or variable, go to **Deployments** → the latest one → **Redeploy**, because settings apply only to new builds.
- [ ] Expected: the deployment finishes, and opening the production address shows the search page in Traditional Chinese with tours from 捷旅 and 專業旅運 (if 3.4 saved data). If the page shows `暫時未能載入資料，請稍後再試。`, the site could not read the database: check `DATABASE_URL` and `DATABASE_CA_CERT` in Vercel and send the assistant the error from the deployment's **Logs** tab (not the string). The messages listed in 3.4 mean the same here.
  - If the Logs say `DATABASE_CA_CERT is not a PEM certificate`, the field probably lost the certificate's line breaks. Enter the value again as one line with the two characters `\n` in place of each line break; on a Mac or Linux, `awk '{printf "%s\\n", $0}' '<certificate file>'` prints it in that form, ready to copy. Then redeploy.
  - Without `DATABASE_CA_CERT`, the Logs show the "not verified" line from 3.1 once each time the site starts up. That is expected.
- [ ] Optional safeguard: in Supabase → SQL Editor, run `ALTER ROLE postgres SET statement_timeout = '20s';` (`postgres` is the part of the pooler user name before the dot). It makes the database itself stop any single statement after 20 seconds; the code already gives up on its side after 20 seconds. It applies to new connections, including your own SQL Editor sessions.

### 3.7 Add the example settings file (any time)

`apps/web/.env.example` is a template for anyone who runs the website on their own computer. The assistant could not create it, because its tools are not allowed to write files whose names start with `.env`. It holds no secrets.

- [ ] Create `apps/web/.env.example` with exactly this content:

  ```
  # Copy this file to .env.local (git-ignored) and fill it in. Never commit a real connection string.

  # Postgres connection string. On Supabase: the connection pooler string, transaction mode.
  DATABASE_URL=

  # Optional, recommended for a hosted database: its CA certificate (PEM text; \n may stand for each line break).
  DATABASE_CA_CERT=

  # DEV_LOCALE=en  (developer English; ignored in production)
  ```

- [ ] Commit it: `git add apps/web/.env.example`, `git commit -m "docs: example settings file for the website"`, `git push` (after the one-time step in 3.0; before committing, `git status` must list `apps/web/.env.example` and no other `.env` file under "Changes to be committed"). `.gitignore` ignores every other `.env…` file but lets this one name through (`!.env.example`), so `git add` accepts it. Never put a real connection string in it: the repository is public.

---

## 4. Look at the site

Do this on the live site, with `docs/design/mockup.html` (the approved mockup) open in another browser tab. No part of the site has been looked at in a real browser yet: every check of the pages was done by automated tests, and every comparison with the mockup was left to you. To check the phone layout, use the browser's developer tools (device toolbar) at 375 px wide.

### What it does

- [ ] Typing `大阪` in the search box suggests `日本 → 關西` (with `包括 大阪、京都、奈良、神戶`), then `日本 → 全部地區`. Choosing `日本 → 關西` lists tours where a Kansai city is the first, a middle or the last stop. (With only Jetour and Travel Expert there may be few or no Japan tours; try a destination they sell, such as `長沙` or `哈爾濱`.)
- [ ] A country with only one region shows once, as `<country> → 全部地區` (for example typing `巴黎` gives just `法國 → 全部地區`), and its cards read `法國`, not `法國 · 法國`.
- [ ] `按國家選擇` (country, then region) reaches the same result as the search box.
- [ ] The filters `出發日期`, `日數`, `價錢`, `旅行社` and all four sort orders (`價錢 低→高`, `日數 短→長`, `出發日期 早→遲`, `目的地`) change the list, change the page address, and are still set after a reload.
- [ ] The `旅行社` filter lists only operators that have had a successful scrape: after 3.4, 捷旅 and 專業旅運. 東瀛遊 and 大航假期 are not offered, as they have no tours.
- [ ] Every card shows: the operator tag, `country · region` (with `+N` when the tour covers more regions), the route, the length, the lowest price with `起`, the 7-day price comparison when there is history (none on the first night), date chips with `+N 個出發日`, the `更新：…` time, `前往<operator>網站 ↗`, and the `加入行程 ＋` button. Nothing else: no photos, no descriptions. Jetour and Travel Expert pages do not state nights, so lengths read `8日` rather than `8日7夜`.
- [ ] Clicking a card opens the operator's page in a new tab; `加入行程 ＋` does not, and opens `選擇出發日期` instead.
- [ ] A chain of three legs can be built on `連續行程`: after a tour ending on the 22nd with a rest of 1–3 days, the next departures offered are the 24th to the 26th (the rest is counted in full free days). The totals add up. Copying the page address into a private window shows the same chain.
- [ ] The `排除` (exclude a country) filter on the chain page shows `排除：無` at first and works when used.
- [ ] A tour whose start is neither Hong Kong nor Shenzhen shows its start note (for example `澳門出發`). To find one, in Supabase → SQL Editor: `select operator_id, code, start_label from tours where start_kind = 'other' limit 5;`. If it returns no rows, write that down.
- [ ] The whole site is in Traditional Chinese and there is no language switcher. (That `DEV_LOCALE=en` in Production would still not show English is proven by an automated test; do not try it.)
- [ ] The footer line `本網站與各旅行社並無任何關連。價錢及出發日期以旅行社網站為準。` is on every page (`/` and `/chain`).

### How it looks, against the mockup

- [ ] Background snow `#fffcff`, text charcoal `#50514f`, navigation bar charcoal with snow text.
- [ ] Search box border, selected filters, prices, links and the rest-days selector are cerulean `#247ba0`.
- [ ] Card borders, date chips and the chain strip panel are ash grey `#cbd4c2`; route arrows, unselected filter outlines and the rest-days line are khaki `#c3b299`.
- [ ] Operator tags: 東瀛遊 red, 捷旅 orange, 專業旅運 purple, 大航假期 green, and none is close to the site's blue. (Only orange and purple will appear on cards.)
- [ ] At 375 px wide: one card per row, nothing scrolls sideways, the chain strip wraps.

These were decided by the assistant without you and need your eye:

- [ ] **`加入行程 ＋` sits in its own row under the card**, not as text at the right of the card's footer as in the mockup's second screen. Keep it, or ask for the mockup's placement.
- [ ] **The footer has a top border and margin** that the mockup does not have, and its text is faint. Keep or remove.
- [ ] **The highlighted row in the search suggestions** has a cerulean label on a light blue background at a contrast of 4.14:1, slightly under the usual 4.5:1 guideline for text. Darkening it would mean a darker shade than the palette's cerulean. Keep or darken.
- [ ] **The muted grey text** (region labels, hints) is `#6c6d67`, darker than the mockup's `#7b7c76`, so that it meets the 4.5:1 contrast guideline. Keep or go back to the mockup's grey.
- [ ] **Chain page differences from the mockup:** the mockup's window `12/23 – 12/25` (after a 12/22 end, rest 1–3) uses the older rest definition; the site shows `12/24 – 12/26`. The chain page has the same destination search and country panels as the search page instead of the mockup's `目的地：全部` pill. Not in the mockup: the `移除最後一程` button, the notice when legs are dropped, and the empty, full and error messages.
- [ ] **Filter pills:** a pill whose filter is set is filled cerulean. (The mockup shows `日數：4–6日` set but outlined.) The filter pop-ups float over the page.

---

## 5. Operations after launch

- [ ] The morning after the first scheduled run, the `scrape_runs` query in 3.4 shows new `ok = true` rows with `started_hk` between 02:00 and 05:00, and cards read `更新：今日 …`.
- [ ] `select count(*) from price_snapshots;` grows each night. After nine nights, `select max(n) from (select tour_id, count(*) as n from price_snapshots group by tour_id) as per_tour;` is at most 8 (one price per tour per night, eight nights kept).
- [ ] Review the place names that matched nothing, about once a week at first:

  ```sql
  select operator_id, name, example_tour_code, seen_count, last_seen
  from unmatched_places
  order by seen_count desc
  limit 30;
  ```

  Most entries are attraction names, meal stops or slogans, which is expected (Jetour's headings name many attractions). Look for real towns or cities that are missing, and send the list to the assistant, who adds them to `packages/core/src/places/data.json`. Also look here for real stops the route rules removed (see the route rules in section 1).
- [ ] When a nightly run fails, GitHub emails you. Open the run and send the assistant the failed step's log, as in 3.4. The site keeps showing that operator's last good data, and its `更新：` time stays at the last good run.
- [ ] GitHub switches off scheduled workflows in a public repository after 60 days without any commit. If the nightly runs stop, GitHub → Actions → nightly-scrape shows a button to enable it again.
- [ ] Supabase pauses free projects that have been inactive for a while. The nightly scrape should keep it active; if the dashboard says the project is paused, restore it there.

---

## 6. Known limits and open judgement calls

Things you should know before sharing the link. Nothing here needs action unless you decide it does.

### Data accuracy

- The expected values for the saved pages (section 1) were checked only by the assistant, not by you.
- **Name collisions.** Some places share an exact name with a place elsewhere: `塔林` (Tallinn, or the Shaolin Pagoda Forest in Henan), `黃金海岸` (Gold Coast, or a beach near Quanzhou), `昆卡` (Spain or Ecuador). The first two are handled only by the collision list in the third route rule; a new collision of this kind will show the wrong country until it is added to that list. Short two-character city names are a standing risk of false matches; the ones found so far are fenced off.
- **Connection cities can still appear as stops** when the heading names them without 轉機, 中轉, 轉乘 or 過境 next to them: for example `巴黎` or `阿姆斯特丹` on Jetour's Latin America tours (`巴黎 ~ 利馬`, or `途經巴黎 轉機` where a space separates the city from 轉機), `伊斯坦堡` on some Balkan tours, `成都/西安` as a flight home, or a station such as `深圳北站` or `廣州南`.
- **The unmatched list fills with attraction names for Jetour** (10 to 15 per tour), because its day headings list attractions. That makes real missing places harder to spot in section 5's review.
- **How Travel Expert marks a sold-out date is unconfirmed.** No sold-out date was seen in the saved pages. The scraper skips a date whose remaining places are 0 or whose type says full or sold out; if Travel Expert marks it some other way, a full date would be shown as available.
- **The Travel Expert route** for TDZC05R ends with 衡陽, the station on the way home (section 1).
- Travel Expert's prices exclude a service fee (HK$80 to HK$160 on the saved pages) paid locally.
- Some real places seen in Travel Expert tours are not yet in the places list (for example 百色, 羅平, 曲靖, 彌勒, 金門). Tours whose headings name only places in brackets (`【…】`) cannot be read and are counted as parse failures (one Travel Expert tour in the last practice run).
- Hong Kong meeting points written without `香港` (for example a street in 尖沙咀) would be shown as a non-Hong Kong start. None of the current Jetour or Travel Expert pages does this.
- **Jetour's sitemap is incomplete while the site rebuilds it** (see 3.4). If a rebuild overlaps a nightly run, that run is refused (`tour-count-dropped`; on the very first run, `below-minimum`) and the previous night's Jetour data stays, so Jetour's tours are a day older than usual. A first run during a rebuild that still yields at least 35 tours would pass; that is why 3.4 asks you to check the page count. When the rebuilds happen is not known: one was seen at about **midday Hong Kong time** (03:49–04:10 UTC, that is 11:49–12:10 in Hong Kong), and an earlier sitemap's newest entries were stamped around 22:00 UTC (06:00 in Hong Kong). The nightly run starts at 02:00 Hong Kong time (18:00 UTC). A run that lands inside a rebuild fails its checks and keeps the previous data.
- **Two Jetour pages give the same tour code**, a quirk of Jetour's own data: `/tour/EIMz` and `/tour/EIMM` both state the code `EIMM`. The scraper keeps only the first page it reads with a given code and skips the other (`duplicate tour code EIMM, keeping the first`) on every run, which is why 99 Jetour pages with dates gave 98 tours in the 13 November crawl. If the two pages are different tours, one of them never appears on the site; you may want to open both and compare.
- The `旅行社` filter offers only operators with at least one successful run (`last_good_run_at` set in the `operators` table). An address that already selects another operator (an old or hand-made link with, for example, `op=egl`) still shows that operator in the filter, so the choice can be seen and removed; it gives no results.

### Legal

- **Travel Expert's approval rests on the site staying personal and non-commercial.** Its terms allow use of site content only for personal, non-commercial purposes, claim database rights, and also say the website is for personal use only. A public comparison site that shows its dates and prices is arguably still covered by those words, and the English text ("without indicating Texpert as the content author") can be read more than one way. That judgement is yours. If the site ever becomes commercial (advertising, referral income, paid features, selling the data), Travel Expert's terms must be read again first.
- **Jetour's approval was given under the rule you delegated** (no clause against automated access; robots.txt allows everything), not by you reading `docs/operators/jetour.md`.
- **Nothing has been reviewed by a lawyer.**
- **Vercel's free Hobby plan is for non-commercial use only.** Ads or referral income would mean moving to a paid plan first.
- The saved test pages in the public repository are trimmed copies containing only the parts the scrapers read. Eight Travel Expert day-heading lines are kept whole (up to about 150 characters, some with promotional wording); you may ask for them to be trimmed by hand.

### Accessibility

- The highlighted suggestion row's label is at 4.14:1 contrast, under the 4.5:1 guideline (section 4).
- The footer text is faint.
- The muted grey was darkened to `#6c6d67` to meet the guideline, which differs slightly from the mockup.
- Keyboard and screen-reader behaviour is covered by automated tests only; nobody has used the site with a screen reader. Known small gap: pressing Escape while a filter pill has focus does not close its pop-up.

### Maintenance

- **Node 20 is past its end of life** (April 2026). The project targets Node 20 (`.nvmrc` is `20`, and the CI and nightly workflows use it) only because that is what the machine it was built on had. Moving to Node 22 or 24 is a small follow-up the assistant can do.
- The connection to Postgres (the `pg` driver) was first exercised in 3.4; all earlier tests used an in-memory database. A fault in that path shows up in the first run, not in the tests.
- **The database connection is always encrypted (TLS)** unless the database is on the same computer (`localhost`, `127.0.0.1`, `::1` or a local socket). SSL settings in `DATABASE_URL` are removed and cannot turn this off. With `DATABASE_CA_CERT` set, the server's certificate is checked against it; without it, the connection is encrypted but the server's identity is not verified. This was tested against the database driver's own handling of these settings only, with no real database; 3.4 is its first real test. Because TLS is always on, turning on a Supabase option to accept only SSL connections (if your project offers one, probably in the same SSL section) should not stop the site or the scraper from connecting; the assistant could not try it.
- The places list (`packages/core/src/places/data.json`) is kept by hand and grows from the unmatched review.
- Each night's save for an operator is one database transaction with several statements per tour. Its speed against the real database is unknown until 3.4.
- A future database change (migration) that takes longer than 20 seconds would be cut off by the code's 20-second limit and would need to be run differently.
- The only alerting is GitHub's email for a failed run.
- **`apps/web/.env.example` does not exist yet**, because the assistant's session is not permitted to write `.env` files. Creating it is the item in 3.7.
