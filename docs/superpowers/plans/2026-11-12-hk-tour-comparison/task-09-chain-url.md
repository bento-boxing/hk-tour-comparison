# Task 9: The chain in the page address

**Goal:** store a chain in URL query parameters so it survives a reload and can be shared, and read it back safely from any input.

**Files:**
- Create: `packages/core/src/chain-url.ts`
- Test: `packages/core/src/chain-url.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `OPERATOR_IDS`, `isIsoDate` (Task 2); `sanitiseGap`, `DEFAULT_GAP` (Task 6).
- Produces:

```ts
export interface ChainLegRef { tourKey: string; departure: IsoDate } // tourKey 'egl:HTBKOK06'
export interface ChainState { legs: ChainLegRef[]; gap: { min: number; max: number } }

export const MAX_CHAIN_LEGS = 8;
/** Returns e.g. { legs: 'egl:HTBKOK06@2026-12-18,jetour:THB@2026-12-24', gap: '1-3' }. Omits `legs` when empty. */
export function encodeChain(state: ChainState): { legs?: string; gap: string };
export function decodeChain(params: { legs?: string | null; gap?: string | null }): ChainState;
```

Format: legs joined by `,`; each leg is `<operatorId>:<code>@<YYYY-MM-DD>`; gap is `<min>-<max>`. The gap applies to the next leg being chosen; gaps between existing legs are derived from their dates.

## Decode rules

- A leg is valid when: the operator id is known, the code is 1–40 characters of `A–Z a–z 0–9 _ -`, and the date passes `isIsoDate`.
- Decoding stops at the first invalid leg; that leg and everything after it are dropped.
- At most `MAX_CHAIN_LEGS` legs are kept.
- Gap goes through `sanitiseGap`; a missing or malformed gap gives `DEFAULT_GAP`.
- `decodeChain` never throws.

Decoding does not check that tours exist or that dates are in order; Task 25 does that against the database.

## Steps

- [ ] **Step 1: Write the failing tests** in `chain-url.test.ts`:

```ts
const state = {
  legs: [{ tourKey: 'egl:HTBKOK06', departure: '2026-12-18' }, { tourKey: 'jetour:THB', departure: '2026-12-24' }],
  gap: { min: 1, max: 3 },
};
it('encodes', () => {
  expect(encodeChain(state)).toEqual({ legs: 'egl:HTBKOK06@2026-12-18,jetour:THB@2026-12-24', gap: '1-3' });
});
it('round-trips', () => { expect(decodeChain(encodeChain(state))).toEqual(state); });
it('omits legs when empty', () => { expect(encodeChain({ legs: [], gap: { min: 0, max: 2 } })).toEqual({ gap: '0-2' }); });
it('decodes nothing into an empty chain with the default gap', () => {
  expect(decodeChain({})).toEqual({ legs: [], gap: { min: 1, max: 3 } });
  expect(decodeChain({ legs: null, gap: null })).toEqual({ legs: [], gap: { min: 1, max: 3 } });
});
it.each([
  ['unknown operator', 'wingon:X1@2026-12-18'],
  ['bad date', 'egl:X1@2026-02-30'],
  ['no date', 'egl:X1'],
  ['empty code', 'egl:@2026-12-18'],
  ['script injection', 'egl:<script>@2026-12-18'],
  ['garbage', '%%%'],
])('drops an invalid leg (%s)', (_n, legs) => { expect(decodeChain({ legs }).legs).toEqual([]); });
it('keeps legs before the first invalid one and drops the rest', () => {
  expect(decodeChain({ legs: 'egl:A@2026-12-18,bad,jetour:B@2026-12-30' }).legs)
    .toEqual([{ tourKey: 'egl:A', departure: '2026-12-18' }]);
});
it.each([['5-1', 1, 5], ['-2-3', 1, 3], ['abc', 1, 3], ['0-99', 0, 30], ['2', 1, 3], ['', 1, 3]])(
  'gap %j → %i–%i', (gap, min, max) => { expect(decodeChain({ gap }).gap).toEqual({ min, max }); });
it('caps the number of legs', () => {
  const many = Array.from({ length: 12 }, (_, i) => `egl:T${i}@2027-01-${String(i + 1).padStart(2, '0')}`).join(',');
  expect(decodeChain({ legs: many }).legs.length).toBe(8);
});
```

`'-2-3'` and `'2'` are malformed (they do not match `^\d+-\d+$`), so they give the default gap.

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `chain-url.ts`.**
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): chain URL encoding"`
