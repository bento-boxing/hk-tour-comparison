# Task 2: Core types, scraped-tour schema, price parser

**Goal:** one definition of "a tour" shared by the scraper, the database layer and the website, plus validation of what scrapers produce.

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/schema.ts`
- Test: `packages/core/src/schema.test.ts`
- Modify: `packages/core/src/index.ts` (re-export everything from both files)
- Add dependency: `zod` in `packages/core`

**Interfaces — Produces (`types.ts`):**

```ts
export const OPERATOR_IDS = ['egl', 'jetour', 'texpert', 'bigline'] as const;
export type OperatorId = (typeof OPERATOR_IDS)[number];
export type IsoDate = string; // 'YYYY-MM-DD'

export interface ScrapedDeparture { date: IsoDate; priceHkd: number | null }

/** What an operator parser returns. Raw facts, not yet matched to places. */
export interface ScrapedTour {
  operatorId: OperatorId;
  code: string;            // operator's own tour code, non-empty
  url: string;             // operator's page for this tour, https
  title: string;
  days: number;            // integer 1..60
  nights: number | null;
  dayHeadings: string[];   // one per itinerary day, in order, heading text only
  startPoint: string | null; // raw text if the operator states it
  endPoint: string | null;
  fromPriceHkd: number | null; // operator's displayed "from" price, if any
  departures: ScrapedDeparture[]; // not sold out; may include past dates
}

export interface Stop { countryId: string; regionId: string; cityId: string | null }
export type StartKind = 'hk' | 'sz' | 'other';
export interface TourPoint { kind: StartKind; label: string | null } // label only when 'other'

/** A tour ready to save. */
export interface NormalisedTour {
  operatorId: OperatorId; code: string; url: string; title: string;
  days: number; nights: number | null;
  stops: Stop[];                 // at least one
  start: TourPoint; end: TourPoint;
  fromPriceHkd: number;          // lowest known price
  departures: ScrapedDeparture[]; // at least one, sorted by date, unique dates
}

export const tourKey = (operatorId: OperatorId, code: string) => `${operatorId}:${code}`;
```

**Produces (`schema.ts`):**

```ts
export const scrapedTourSchema: z.ZodType<ScrapedTour>;
export function parsePriceHkd(text: string): number | null;
export function isIsoDate(s: string): boolean; // real calendar date in YYYY-MM-DD
```

## Steps

- [ ] **Step 1: Write the failing tests** in `schema.test.ts`:

```ts
const valid: ScrapedTour = {
  operatorId: 'jetour', code: 'THB', url: 'https://www.jetour.com.hk/tour/THB',
  title: '曼谷芭堤雅5天', days: 5, nights: 4,
  dayHeadings: ['香港 → 曼谷', '曼谷 → 芭堤雅'],
  startPoint: null, endPoint: null, fromPriceHkd: 3999,
  departures: [{ date: '2026-12-22', priceHkd: 4299 }],
};

it('accepts a valid tour', () => { expect(scrapedTourSchema.safeParse(valid).success).toBe(true); });

it.each([
  ['empty code', { code: '' }],
  ['unknown operator', { operatorId: 'wingon' }],
  ['non-https url', { url: 'http://x.com/a' }],
  ['zero days', { days: 0 }],
  ['61 days', { days: 61 }],
  ['fractional days', { days: 4.5 }],
  ['bad date', { departures: [{ date: '2026-02-30', priceHkd: 1 }] }],
  ['date wrong shape', { departures: [{ date: '22/12/2026', priceHkd: 1 }] }],
  ['price under 100', { fromPriceHkd: 50 }],
  ['fractional price', { fromPriceHkd: 3999.5 }],
])('rejects %s', (_n, patch) => {
  expect(scrapedTourSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
});

it('accepts empty departures and empty dayHeadings (rejected later, in normalise)', () => {
  expect(scrapedTourSchema.safeParse({ ...valid, departures: [], dayHeadings: [] }).success).toBe(true);
});

it.each([
  ['HK$7,999起', 7999], ['$7999+', 7999], ['7,999 元', 7999], ['HKD 12,500', 12500],
  ['港幣 8999 起', 8999], [' HK$ 3,980 ', 3980],
  ['', null], ['待定', null], ['0', null], ['HK$99', null], ['HK$1,234.50', 1234],
])('parsePriceHkd(%j) → %j', (text, expected) => { expect(parsePriceHkd(text)).toBe(expected); });

it('isIsoDate', () => {
  expect(isIsoDate('2028-02-29')).toBe(true);
  expect(isIsoDate('2027-02-29')).toBe(false);
  expect(isIsoDate('2026-1-5')).toBe(false);
});
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/src/schema.test.ts` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `types.ts` and `schema.ts`.** Prices (both `fromPriceHkd` and departure `priceHkd`) must be integers from 100 to 2,000,000 or null. `parsePriceHkd` takes the first run of digits-with-commas in the text, drops anything after a decimal point, and returns null below 100.

- [ ] **Step 4: Run the test** — Expected: PASS. Run `pnpm typecheck` — exits 0.

- [ ] **Step 5: Commit** — `git commit -am "feat(core): tour types, scraped-tour schema, price parser"`
