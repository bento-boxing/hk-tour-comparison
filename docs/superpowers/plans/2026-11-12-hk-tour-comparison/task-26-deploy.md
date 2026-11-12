# Task 26: Hosting, secrets, first run and final check

**Goal:** the site live on Vercel reading from Supabase, the nightly scrape running by itself, and a final check against the spec and the mockup.

Most steps here are **owner steps**: they need the owner's accounts and must not be done by an agent with stored credentials. An agent can prepare files and walk the owner through each step.

**Files:**
- Create: `README.md`, `apps/web/.env.example`, `docs/launch-checklist.md`
- Modify: `.github/workflows/nightly-scrape.yml` (enable the schedule if it was left commented out)

## Steps

- [ ] **Step 1: Write `README.md`** — what the project is (two sentences), the statement that it is not affiliated with any operator and stores facts and links only, how to run tests (`pnpm test`), how to run a dry-run scrape, the environment variables (`DATABASE_URL`, `DEV_LOCALE`), and a contact route for operators who want their listings removed (a GitHub issue; no personal email address).

- [ ] **Step 2: Write `apps/web/.env.example`** with `DATABASE_URL=` and `# DEV_LOCALE=en  (developer English; ignored in production)`. Confirm `.env*` is git-ignored and `.env.example` is explicitly allowed.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "docs: README and env example"`

- [ ] **Step 4 — Owner: create the Supabase project.** Free plan, region Singapore (the closest region Supabase offers to Hong Kong). Copy the **connection pooler** connection string (transaction mode), which is the one that works from serverless functions and GitHub Actions. Keep it out of the repository and out of chat.

- [ ] **Step 5 — Owner: create the tables.** In a terminal: `DATABASE_URL='<string>' pnpm db:migrate`. Expected output: `applied 0001_init.sql`. In the Supabase table viewer, confirm `operators` has four rows.

- [ ] **Step 6 — Owner: add the GitHub secret.** Repository → Settings → Secrets and variables → Actions → new secret `DATABASE_URL`.

- [ ] **Step 7 — Owner: first scrape by hand.** GitHub → Actions → `nightly-scrape` → Run workflow. Expected: `migrate` passes, then one `scrape` job per operator, each finishing in under 170 minutes. Afterwards, in Supabase: `select operator_id, ok, tours_saved, parse_failures, reasons from scrape_runs order by id desc;` shows one `ok = true` row per operator.

  If an operator's job fails, read its log: each failed page is listed with a reason. Do not loosen the checks in `check-run.ts` to make it pass; fix the parser or the places list.

- [ ] **Step 8: Enable the schedule** if the `schedule:` block in `nightly-scrape.yml` was commented out, and commit. Confirm in GitHub → Settings → Notifications that failed-workflow emails are on.

- [ ] **Step 9 — Owner: deploy the site.** Vercel → Add New Project → import the repository; root directory `apps/web`; framework Next.js. Environment variable `DATABASE_URL` for Production and Preview. Function region `sin1` (Singapore), next to the database. Do **not** set `DEV_LOCALE` in Production. Deploy.

- [ ] **Step 10: Write `docs/launch-checklist.md`** containing the checks below, then go through it on the live site with the mockup open beside it. Record pass or fail for each.

  **Spec**
  - [ ] Typing 大阪 suggests `日本 → 關西`; choosing it lists tours where a Kansai city is a first, middle or last stop.
  - [ ] Country then region panels reach the same result.
  - [ ] Departure date, length, price and operator filters and all four sort orders work and survive a reload.
  - [ ] Every card shows operator, region, route, length, lowest price, the 7-day comparison where there is history, date chips and last-updated time; nothing else. No photos, no descriptions.
  - [ ] Clicking a card opens the operator's page in a new tab; 加入行程 does not.
  - [ ] A chain of three legs can be built; windows follow the gap definition; totals add up; the address can be opened in a private window and shows the same chain.
  - [ ] The exclusion filter on the chain page is off by default and works when used.
  - [ ] A tour whose start is neither Hong Kong nor Shenzhen shows its start note. (Find one with `select operator_id, code, start_label from tours where start_kind = 'other' limit 5;` — if there are none, record that.)
  - [ ] The whole site is in Traditional Chinese; there is no language switcher; adding `DEV_LOCALE=en` to Production in Vercel would still not show English (verified by the Task 20 test, not by trying it).
  - [ ] The footer disclaimer is on every page.

  **Mockup**
  - [ ] Background snow, text charcoal, nav bar charcoal with snow text.
  - [ ] Search input border, selected filters, prices, links and the gap selector are cerulean.
  - [ ] Card borders, date chips and the chain strip panel are ash grey; route arrows, unselected filter outlines and the gap line are khaki.
  - [ ] Operator tags are red, orange, purple and green, and no operator colour is close to the site's blue.
  - [ ] Layout holds at 375px wide: one card per row, nothing scrolls sideways, the chain strip wraps.

  **Operations**
  - [ ] The morning after the first scheduled run, `scrape_runs` has new `ok = true` rows dated in the 02:00–05:00 Hong Kong window, and cards read `更新：今日 …`.
  - [ ] `select count(*) from price_snapshots` grows nightly, and after nine nights no tour has more than 8 rows.
  - [ ] `select operator_id, name, seen_count from unmatched_places order by seen_count desc limit 30;` has been reviewed and real places added to `data.json`.

- [ ] **Step 11: Commit the checklist with results** — `git add -A && git commit -m "docs: launch checklist"`. Any failed item becomes a follow-up task; do not mark this task done with failures unrecorded.

## Before sharing the link publicly — owner

- The terms-of-use findings in `docs/operators/*.md` are approved (Task 14).
- This has not been reviewed by a lawyer. The spec says so, and that remains true.
- Vercel's free plan is for non-commercial use; adding ads or referral income means changing plan first.
