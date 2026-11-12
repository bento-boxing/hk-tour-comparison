# Task 19: Command line, places coverage and the nightly schedule

**Goal:** one command that scrapes one operator, a dry-run mode used to grow the places list, and a GitHub Actions schedule that runs every approved operator each night between 02:00 and 05:00 Hong Kong time.

**Files:**
- Create: `packages/scraper/src/operators/index.ts`, `packages/scraper/src/cli.ts`, `packages/scraper/src/dry-run-db.ts`
- Test: `packages/scraper/src/cli.test.ts`
- Create: `packages/db/src/migrate-cli.ts`
- Create: `.github/workflows/nightly-scrape.yml`
- Modify: root `package.json` (scripts `scrape`, `db:migrate`), `packages/core/src/places/data.json`

**Interfaces:**
- Consumes: the operator scrapers that exist (Tasks 15–18); `runOperator`, `createFetcher` (Task 13); `createPgDb`, `migrate`, `createTestDb` (Task 10); `places`, `todayInHongKong`.
- Produces:

```ts
// operators/index.ts — contains only approved, implemented operators
export const SCRAPERS: Partial<Record<OperatorId, OperatorScraper>>;

// cli.ts
export interface CliArgs { operator: OperatorId; dryRun: boolean; limit: number | null }
export function parseArgs(argv: string[]): CliArgs | { error: string };
/** Returns the process exit code: 0 ok, 1 run failed its checks, 2 bad usage or missing configuration. */
export async function runCli(argv: string[], env: Record<string, string | undefined>, deps?: Partial<CliDeps>): Promise<number>;
```

Usage: `pnpm scrape --operator <id> [--dry-run] [--limit N]`.

- Requires `DATABASE_URL` unless `--dry-run`. No other configuration.
- `--limit N` fetches only the first N discovered URLs. It is allowed **only together with `--dry-run`**, because a limited real run would deactivate every tour it did not reach.
- `--dry-run` runs the whole pipeline against a throwaway in-memory database (`createTestDb`), then prints: tours saved, parse failures, and every unmatched place name with its count, most frequent first. Nothing is written to the real database.

`pnpm db:migrate` runs `migrate` against `DATABASE_URL` and prints the migrations applied.

## Workflow (`nightly-scrape.yml`)

```yaml
name: nightly-scrape
on:
  schedule:
    - cron: '0 18 * * *'   # 18:00 UTC = 02:00 Hong Kong
  workflow_dispatch:
concurrency:
  group: nightly-scrape
  cancel-in-progress: false
jobs:
  migrate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps: [checkout, pnpm + node setup, install, "pnpm db:migrate"]
  scrape:
    needs: migrate
    runs-on: ubuntu-latest
    timeout-minutes: 170     # must be finished by 05:00 Hong Kong
    strategy:
      fail-fast: false       # one operator failing must not stop the others
      matrix:
        operator: [<every key of SCRAPERS>]
    steps: [checkout, pnpm + node setup, install, "pnpm scrape --operator ${{ matrix.operator }}"]
```

Both jobs get only `DATABASE_URL` from the repository secret of that name. Write the steps out in full. A job killed by the timeout has saved nothing (saving is one transaction at the end), so last night's data stays. A failed job makes GitHub email the owner.

## Steps

- [ ] **Step 1: Write the failing tests** in `cli.test.ts`:

```ts
it.each([
  [['--operator', 'jetour'], { operator: 'jetour', dryRun: false, limit: null }],
  [['--operator', 'egl', '--dry-run', '--limit', '20'], { operator: 'egl', dryRun: true, limit: 20 }],
])('parseArgs(%j)', (argv, expected) => { expect(parseArgs(argv)).toEqual(expected); });

it.each([
  [[]], [['--operator']], [['--operator', 'wingon']], [['--operator', 'jetour', '--limit', '0']],
  [['--operator', 'jetour', '--limit', 'x']], [['--operator', 'jetour', '--limit', '20']], // limit without dry-run
  [['--operator', 'jetour', '--bogus']],
])('parseArgs(%j) is an error', argv => { expect(parseArgs(argv)).toHaveProperty('error'); });

it('exits 2 when DATABASE_URL is missing for a real run', async () => {
  expect(await runCli(['--operator', 'jetour'], {})).toBe(2);
});
it('exits 2 for an operator with no scraper registered', async () => { /* inject deps.scrapers = {} */ });
it('exits 0 on a good run and 1 on a failed run', async () => {
  // inject deps: a fake scraper, fake fetcher and createTestDb → good pages → 0; all pages unparseable → 1
});
it('dry-run prints unmatched names and writes nothing to the real database', async () => {
  // inject a real-db spy that throws if queried; output contains the unmatched name and its count
});
it('dry-run with --limit fetches only that many pages', async () => { /* fake fetcher counts calls */ });
```

`CliDeps` is `{ scrapers, makeFetcher, makeDb, makeDryRunDb, print, now }`; define it so each test above can inject fakes. Write the commented tests in full.

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `operators/index.ts`, `dry-run-db.ts`, `cli.ts`, `migrate-cli.ts`, and the two root scripts.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(scraper): CLI with dry-run"`

- [ ] **Step 6: Places coverage pass.** For each registered operator, run `pnpm scrape --operator <id> --dry-run` once (a full crawl at 3 seconds per page; expect up to about 70 minutes per operator). From the printed unmatched names, add every real place to `packages/core/src/places/data.json` under the right country and region, with aliases for alternate spellings; add new countries and regions as needed. Names that are not places (hotel names, activities) are left out. Do not re-crawl to check: re-run the operator's fixture tests and `pnpm test`.

  **Target:** in each operator's dry-run summary, parse failures are under 10% of tour pages fetched. If an operator is above that after the places list is extended, the cause is in its parser or its headings; record it in `docs/operators/<id>.md` and stop for the owner.

- [ ] **Step 7: Commit** — `git commit -am "feat(core): extend places list from operator dry runs"`

- [ ] **Step 8: Write `.github/workflows/nightly-scrape.yml`** as specified. Validate the YAML parses (`node -e` with a YAML parser, or `actionlint` if available).

- [ ] **Step 9: Commit** — `git commit -am "ci: nightly scrape schedule"`

The schedule cannot run until the `DATABASE_URL` secret exists (Task 26). Until then the scheduled run fails at `migrate`; if the repository is already on GitHub, leave the `schedule:` block commented out and uncomment it in Task 26.
