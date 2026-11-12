# Task 6: Chain date maths

**Goal:** the calendar arithmetic behind chaining: when a tour ends, and which departure dates fall inside a gap.

**Files:**
- Create: `packages/core/src/chain.ts`
- Test: `packages/core/src/chain.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces — Produces:**

```ts
export const DEFAULT_GAP = { min: 1, max: 3 } as const;
export const MAX_GAP_DAYS = 30;

export function addDays(date: IsoDate, n: number): IsoDate;      // n may be negative
export function daysBetween(a: IsoDate, b: IsoDate): number;      // b - a in days
/** Last day of the tour: departure + days - 1. */
export function tourEndDate(departure: IsoDate, days: number): IsoDate;
/** Gap = number of full free days between a tour's end date and the next departure. */
export function gapWindow(endDate: IsoDate, gapMin: number, gapMax: number): { from: IsoDate; to: IsoDate };
/** Free days between two legs; negative if they overlap. */
export function gapBetween(prevEnd: IsoDate, nextDeparture: IsoDate): number;
/** Clamp to integers 0..MAX_GAP_DAYS and swap if min > max. Non-numbers → DEFAULT_GAP. */
export function sanitiseGap(min: unknown, max: unknown): { min: number; max: number };
export function todayInHongKong(now?: Date): IsoDate;
```

`gapWindow` returns `from = end + gapMin + 1`, `to = end + gapMax + 1`. All maths is done on UTC midnight; no function reads the machine's timezone except `todayInHongKong`, which uses the `Asia/Hong_Kong` zone.

## Steps

- [ ] **Step 1: Write the failing tests** in `chain.test.ts`:

```ts
it.each([
  ['2026-12-18', 5, '2026-12-22'],
  ['2026-12-30', 5, '2027-01-03'],   // year boundary
  ['2028-02-27', 5, '2028-03-02'],   // leap year
  ['2027-02-27', 5, '2027-03-03'],   // non-leap year
  ['2026-12-18', 1, '2026-12-18'],   // one-day tour ends the day it starts
])('tourEndDate(%s, %i) → %s', (dep, days, end) => { expect(tourEndDate(dep, days)).toBe(end); });

it.each([
  ['2026-12-22', 1, 3, '2026-12-24', '2026-12-26'],  // the spec's example
  ['2026-12-22', 0, 0, '2026-12-23', '2026-12-23'],  // leave next morning
  ['2026-12-30', 1, 3, '2027-01-01', '2027-01-03'],
  ['2026-12-22', 2, 2, '2026-12-25', '2026-12-25'],
])('gapWindow(%s, %i, %i)', (end, min, max, from, to) => {
  expect(gapWindow(end, min, max)).toEqual({ from, to });
});

it('gapBetween', () => {
  expect(gapBetween('2026-12-22', '2026-12-24')).toBe(1);
  expect(gapBetween('2026-12-22', '2026-12-23')).toBe(0);
  expect(gapBetween('2026-12-22', '2026-12-22')).toBe(-1);
});

it('addDays and daysBetween', () => {
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
});

it.each([
  [1, 3, 1, 3], [5, 1, 1, 5], [-2, 3, 0, 3], [0, 99, 0, 30], [1.7, 3.2, 1, 3],
  ['a', 3, 1, 3], [undefined, undefined, 1, 3], [NaN, 2, 1, 3],
])('sanitiseGap(%j, %j) → %i–%i', (a, b, min, max) => {
  expect(sanitiseGap(a, b)).toEqual({ min, max });
});

it('todayInHongKong uses Hong Kong time', () => {
  expect(todayInHongKong(new Date('2026-11-12T17:30:00Z'))).toBe('2026-11-13'); // 01:30 HKT next day
  expect(todayInHongKong(new Date('2026-11-12T15:59:00Z'))).toBe('2026-11-12');
});
```

Fractional gap values are floored before clamping. If either argument is not a finite number, the whole result is `DEFAULT_GAP`.

- [ ] **Step 2: Run** `pnpm vitest run packages/core/src/chain.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `chain.ts`.**
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): chain date maths"`
