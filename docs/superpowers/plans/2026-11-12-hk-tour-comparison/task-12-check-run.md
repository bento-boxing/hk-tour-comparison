# Task 12: Sanity checks on a run

**Goal:** decide whether tonight's results for one operator are trustworthy enough to save. A bad run keeps last night's data.

**Files:**
- Create: `packages/scraper/src/check-run.ts`
- Test: `packages/scraper/src/check-run.test.ts`

**Interfaces — Produces:**

```ts
export interface RunCheckInput {
  toursNormalised: number;         // tours that passed normaliseTour
  tourPagesFetched: number;        // pages the scraper fetched as tour pages
  parseFailures: number;           // see below
  previousGoodCount: number | null; // from previousGoodTourCount
}
export type RunFailureReason = 'no-tours' | 'tour-count-dropped' | 'too-many-parse-failures';
export function checkRun(input: RunCheckInput): { ok: boolean; reasons: RunFailureReason[] };

export const MIN_COUNT_RATIO = 0.6;        // tonight must have at least 60% of the last good count
export const MIN_PREVIOUS_FOR_RATIO = 20;  // the ratio rule applies only when the last good count was ≥ 20
export const MAX_PARSE_FAILURE_RATE = 0.2;
```

A **parse failure** is a fetched tour page where the parser returned `null`, the result failed `scrapedTourSchema`, or `normaliseTour` rejected it with `no-stops` or `no-price`. A `no-departures` rejection is **not** a failure: the tour simply has no upcoming dates.

## Rules

- `toursNormalised === 0` → `no-tours`.
- `previousGoodCount ≥ 20` and `toursNormalised < 0.6 × previousGoodCount` → `tour-count-dropped`.
- `tourPagesFetched > 0` and `parseFailures / tourPagesFetched > 0.2` → `too-many-parse-failures`.
- All applicable reasons are returned. `ok` is true only when there are none.

## Steps

- [ ] **Step 1: Write the failing tests** in `check-run.test.ts`:

```ts
it.each([
  [{ toursNormalised: 100, tourPagesFetched: 110, parseFailures: 5,  previousGoodCount: 105 }, []],
  [{ toursNormalised: 100, tourPagesFetched: 110, parseFailures: 5,  previousGoodCount: null }, []],   // first ever run
  [{ toursNormalised: 0,   tourPagesFetched: 0,   parseFailures: 0,  previousGoodCount: null }, ['no-tours']],
  [{ toursNormalised: 59,  tourPagesFetched: 60,  parseFailures: 0,  previousGoodCount: 100 }, ['tour-count-dropped']],
  [{ toursNormalised: 60,  tourPagesFetched: 60,  parseFailures: 0,  previousGoodCount: 100 }, []],    // exactly 60% passes
  [{ toursNormalised: 5,   tourPagesFetched: 5,   parseFailures: 0,  previousGoodCount: 19 },  []],    // too small to judge
  [{ toursNormalised: 80,  tourPagesFetched: 100, parseFailures: 21, previousGoodCount: 85 },  ['too-many-parse-failures']],
  [{ toursNormalised: 80,  tourPagesFetched: 100, parseFailures: 20, previousGoodCount: 85 },  []],    // exactly 20% passes
  [{ toursNormalised: 0,   tourPagesFetched: 100, parseFailures: 100, previousGoodCount: 90 },
    ['no-tours', 'tour-count-dropped', 'too-many-parse-failures']],
])('checkRun(%j) → %j', (input, reasons) => {
  expect(checkRun(input)).toEqual({ ok: reasons.length === 0, reasons });
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `checkRun`.** Reasons are returned in the order listed under Rules.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(scraper): run sanity checks"`
