# Task 11: Saving a night's scrape

**Goal:** write one operator's good run to the database in a single transaction, record failed runs without touching data, and keep only a rolling week of price snapshots.

**Files:**
- Create: `packages/db/src/save-run.ts`
- Test: `packages/db/src/save-run.test.ts`
- Modify: `packages/db/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `Db`, `createTestDb` (Task 10); `NormalisedTour`, `OperatorId`, `IsoDate` (Task 2); `addDays` (Task 6); `SNAPSHOT_KEEP_NIGHTS` (Task 7).
- Produces:

```ts
export interface RunStats { startedAt: Date; finishedAt: Date; pagesFetched: number; parseFailures: number }
export interface UnmatchedName { name: string; tourCode: string }

export interface GoodRun {
  operatorId: OperatorId; runDate: IsoDate;
  tours: NormalisedTour[]; unmatched: UnmatchedName[]; stats: RunStats;
}
export async function saveOperatorRun(db: Db, run: GoodRun): Promise<void>;

export interface FailedRun { operatorId: OperatorId; runDate: IsoDate; stats: RunStats; reasons: string[] }
export async function recordFailedRun(db: Db, run: FailedRun): Promise<void>;

/** tours_saved of the most recent ok run for this operator, or null if there is none. */
export async function previousGoodTourCount(db: Db, operatorId: OperatorId): Promise<number | null>;
```

## What `saveOperatorRun` does, in one transaction

1. For each tour: upsert on `(operator_id, code)`. On insert, `first_seen = runDate`. Always set `last_seen = runDate`, `active = true`, and overwrite url, title, days, nights, from price, start/end.
2. Replace that tour's `tour_stops` (delete, then insert with `position` 0, 1, 2…).
3. Replace that tour's `departures`.
4. Upsert `price_snapshots (tour_id, runDate, from_price_hkd)`.
5. Set `active = false` for every tour of this operator whose code is not in this run. Tours of other operators are untouched.
6. Delete this operator's `price_snapshots` dated before `runDate − 7` (so 8 nights are kept: `runDate − 7` … `runDate`).
7. Upsert `unmatched_places`: new name → `seen_count 1`; existing → `seen_count + 1`, `last_seen = runDate`, example code updated.
8. Insert a `scrape_runs` row with `ok = true`, `tours_saved = tours.length`, `reasons = '{}'`.
9. Set `operators.last_good_run_at = stats.finishedAt`.

`recordFailedRun` inserts only a `scrape_runs` row with `ok = false`, `tours_saved = 0` and the reasons. Nothing else changes.

## Steps

- [ ] **Step 1: Write the failing tests** in `save-run.test.ts`. Use a helper `tour(code, patch?)` returning a `NormalisedTour` for `jetour` with stops `[大阪, 京都]`, one departure `2026-12-18` at 7999, `fromPriceHkd` 7999, and a helper `run(runDate, tours)`.

```ts
it('inserts tours with stops, departures and a snapshot', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));
  // tours: 1 row, active, first_seen = last_seen = '2026-11-12'
  // tour_stops: positions [0,1], city ids [osaka, kyoto]
  // departures: [{date:'2026-12-18', price_hkd:7999}]
  // price_snapshots: [{date:'2026-11-12', price_hkd:7999}]
});
it('updates an existing tour and keeps first_seen', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));
  await saveOperatorRun(db, run('2026-11-13', [tour('A', { fromPriceHkd: 7499, departures: [{ date: '2026-12-20', priceHkd: 7499 }] })]));
  // still 1 tour; first_seen '2026-11-12', last_seen '2026-11-13', from_price_hkd 7499
  // departures replaced: only 2026-12-20
  // snapshots: two rows, 7999 then 7499
});
it('deactivates tours missing from tonight, for this operator only', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A'), tour('B')]));
  await saveOperatorRun(db, { ...run('2026-11-12', [tour('X')]), operatorId: 'egl' });
  await saveOperatorRun(db, run('2026-11-13', [tour('A')]));
  // jetour A active, jetour B inactive, egl X still active
});
it('reactivates a tour that comes back', async () => { /* A, then none of A (B only), then A again → A active */ });
it('keeps exactly 8 nights of snapshots', async () => {
  // save tour A on ten consecutive nights 2026-11-03 … 2026-11-12
  // snapshot dates for A: 2026-11-05 … 2026-11-12 (8 rows)
});
it('counts unmatched names across runs', async () => {
  // run 1 unmatched [{name:'亞特蘭提斯', tourCode:'A'}], run 2 the same with tourCode 'B'
  // one row: seen_count 2, example_tour_code 'B', last_seen = run 2 date
});
it('records the run and the operator freshness', async () => {
  // scrape_runs: ok true, tours_saved 1; operators.last_good_run_at equals stats.finishedAt
  // previousGoodTourCount(db,'jetour') → 1; for 'egl' → null
});
it('a failed run changes no data', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));
  await recordFailedRun(db, { operatorId: 'jetour', runDate: '2026-11-13', stats, reasons: ['no-tours'] });
  // tour A still active with last_seen '2026-11-12'; last_good_run_at unchanged
  // scrape_runs has an ok=false row with reasons ['no-tours']
  // previousGoodTourCount(db,'jetour') still 1
});
it('rolls back everything if one tour fails to save', async () => {
  // second tour has days: 0 (violates the check) → rejects; no tours, no scrape_runs row
});
```

Write every commented assertion in full.

- [ ] **Step 2: Run** `pnpm vitest run packages/db/src/save-run.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `save-run.ts`.**
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): save operator run with rolling price snapshots"`
