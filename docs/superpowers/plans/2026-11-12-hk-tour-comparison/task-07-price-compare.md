# Task 7: 7-day price comparison

**Goal:** decide what the card says about today's price against a week ago.

**Files:**
- Create: `packages/core/src/price.ts`
- Test: `packages/core/src/price.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `addDays` (Task 6).
- Produces:

```ts
export interface PriceSnapshot { date: IsoDate; priceHkd: number }
export type PriceChange =
  | { kind: 'lower'; diffHkd: number; sinceDate: IsoDate }   // diffHkd is positive
  | { kind: 'higher'; diffHkd: number; sinceDate: IsoDate }
  | { kind: 'same'; sinceDate: IsoDate };

export const SNAPSHOT_KEEP_NIGHTS = 8;
/** currentPriceHkd is tonight's from-price. Returns null when there is nothing to compare with. */
export function comparePrice(currentPriceHkd: number, snapshots: PriceSnapshot[], today: IsoDate): PriceChange | null;
```

## Rules

- The baseline is the snapshot dated exactly `today − 7`.
- If there is none, the baseline is the **oldest** snapshot dated from `today − 7` up to `today − 1`.
- Snapshots dated `today`, in the future, or older than `today − 7` are ignored.
- No baseline → `null`.

## Steps

- [ ] **Step 1: Write the failing tests** in `price.test.ts`, with `today = '2026-11-12'`:

```ts
const s = (date: string, priceHkd: number) => ({ date, priceHkd });

it('lower than 7 days ago', () => {
  expect(comparePrice(7999, [s('2026-11-05', 8499), s('2026-11-11', 7999)], today))
    .toEqual({ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' });
});
it('higher than 7 days ago', () => {
  expect(comparePrice(9880, [s('2026-11-05', 9580)], today))
    .toEqual({ kind: 'higher', diffHkd: 300, sinceDate: '2026-11-05' });
});
it('same', () => {
  expect(comparePrice(8499, [s('2026-11-05', 8499)], today)).toEqual({ kind: 'same', sinceDate: '2026-11-05' });
});
it('falls back to the oldest snapshot inside the week for a newer tour', () => {
  expect(comparePrice(5000, [s('2026-11-10', 5200), s('2026-11-09', 5400), s('2026-11-11', 5100)], today))
    .toEqual({ kind: 'lower', diffHkd: 400, sinceDate: '2026-11-09' });
});
it('ignores today, future and too-old snapshots', () => {
  expect(comparePrice(5000, [s('2026-11-12', 4000), s('2026-11-13', 4000), s('2026-11-04', 4000)], today)).toBeNull();
});
it('null with no snapshots', () => { expect(comparePrice(5000, [], today)).toBeNull(); });
it('does not depend on snapshot order', () => {
  expect(comparePrice(5000, [s('2026-11-11', 5100), s('2026-11-05', 6000)], today)!.sinceDate).toBe('2026-11-05');
});
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `comparePrice`.**
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): 7-day price comparison"`
