# Task 22: Tour card and departure picker

**Goal:** the card every tour is shown as, matching the mockup, and the small date list that opens from its 加入行程 button.

Open `docs/design/mockup.html`. The card is `.card` and its children (`.top`, `.op`, `.reg`, `.route`, `.meta`, `.days`, `.price`, `.delta`, `.dates`, `.d`, `.foot`). Copy its measurements: white surface, 1px ash border, 5px left border in the operator's colour, 10px radius, 14px/16px padding, 9px gap between rows; route 17px bold with khaki arrows; price 22px extra-bold in cerulean with a 12px muted `起`; date chips 12px on ash with 4px radius.

**Files:**
- Create: `apps/web/components/TourCard.tsx`, `TourCard.module.css`, `DeparturePicker.tsx`, `DeparturePicker.module.css`
- Create: `apps/web/lib/card-text.ts`
- Test: `apps/web/components/TourCard.test.tsx`, `DeparturePicker.test.tsx`, `apps/web/lib/card-text.test.ts`
- Modify: both dictionaries

**Interfaces:**
- Consumes: `TourCardData`, `OperatorInfo` (Task 21); `PlacesIndex`, `tourRegions` (Tasks 3, 8); `formatPrice`, `formatChipDate`, `formatLength`, `formatUpdated`, `t` (Task 20); `daysBetween` (Task 6).
- Produces:

```ts
// card-text.ts — pure, no React
export function routeNames(stops: Stop[], places: PlacesIndex): string[];            // city nameZh, or region nameZh when cityId is null
export function regionLabel(stops: Stop[], places: PlacesIndex): string;             // '日本 · 關西', or '日本 · 關西 +1' when more regions follow
export function priceChangeText(change: PriceChange | null, today: IsoDate, t): { text: string; tone: 'down' | 'up' | 'same' } | null;
export function startNote(start: TourPoint, end: TourPoint, t): string | null;

// TourCard.tsx
export interface TourCardProps {
  tour: TourCardData; operator: OperatorInfo; places: PlacesIndex; today: IsoDate; t: T;
  /** When given, the 加入行程 button is shown and calls this with the chosen date. */
  onAdd?: (departure: IsoDate) => void;
  footNote?: string;   // replaces the 'updated' text in the footer, e.g. '休息 1–2 日後出發'
}
export function TourCard(props: TourCardProps): JSX.Element;
export const MAX_DATE_CHIPS = 4;

// DeparturePicker.tsx
export interface DeparturePickerProps {
  departures: ScrapedDeparture[]; fallbackPriceHkd: number; today: IsoDate; t: T;
  onPick: (date: IsoDate) => void; onClose: () => void;
}
export function DeparturePicker(props: DeparturePickerProps): JSX.Element;
```

## Card behaviour

- The card is an `<article>`. Its content (everything except the add button) is inside one `<a href={tour.url} target="_blank" rel="noopener noreferrer">`. The add button is a sibling of that link, never inside it.
- Top row: operator tag (operator `nameZh`, background the operator colour, white text) and `regionLabel`.
- Headline: `routeNames` joined by `→` arrows.
- Length: `formatLength`.
- Price: `formatPrice(tour.windowPriceHkd)` followed by `起`.
- Price change line: shown only when `tour.windowPriceHkd === tour.fromPriceHkd` and `priceChange` is not null.
  - lower: `↓ HK$500　比7日前` (tone down, `--price-down`)
  - higher: `↑ HK$300　比7日前` (tone up, `--price-up`)
  - same: `— 與7日前相同` (faint)
  - the number of days is `daysBetween(change.sinceDate, today)`, so a newer tour reads `比3日前` / `與3日前相同`.
- Date chips: the first `MAX_DATE_CHIPS` of `tour.departures` via `formatChipDate`, then `+N 個出發日` when more exist.
- Start note (`startNote`): nothing when start and end are both `hk` or `sz`. `{label}出發` when start is `other`. `{label}解散` when only the end is `other`. Both when both are `other` and the labels differ: `{start}出發 · {end}解散`. Shown as a small khaki-bordered pill under the route.
- Footer left: `footNote` if given, otherwise `formatUpdated(tour.lastUpdated, today)`. Footer right: `前往{operator}網站 ↗` in cerulean.
- Add button (only with `onAdd`): label `加入行程 ＋`. Clicking opens the `DeparturePicker` anchored to the card. It must not navigate to the operator.

## Picker behaviour

- A small panel with the title `選擇出發日期`, listing every departure as a button: the date as `2026年12月18日（五）` and its price (`formatPrice`), using `fallbackPriceHkd` followed by `起` when the departure's own price is null.
- Clicking a date calls `onPick(date)`. Escape or clicking outside calls `onClose`. Focus moves to the first date when it opens.
- With exactly one departure the picker still opens (the visitor should see the date they are choosing).

## Dictionary keys

| Key | zh-Hant | en |
|---|---|---|
| `card.from` | 起 | from |
| `card.lower` | ↓ {amount}　比{days}日前 | ↓ {amount} vs {days}d ago |
| `card.higher` | ↑ {amount}　比{days}日前 | ↑ {amount} vs {days}d ago |
| `card.same` | — 與{days}日前相同 | — same as {days}d ago |
| `card.moreDates` | +{n} 個出發日 | +{n} more dates |
| `card.goTo` | 前往{operator}網站 ↗ | Open {operator} ↗ |
| `card.add` | 加入行程 ＋ | Add to chain ＋ |
| `card.startsAt` | {place}出發 | Starts at {place} |
| `card.endsAt` | {place}解散 | Ends at {place} |
| `card.moreRegions` | +{n} | +{n} |
| `picker.title` | 選擇出發日期 | Choose a departure date |
| `picker.close` | 關閉 | Close |

## Steps

- [ ] **Step 1: Write the failing tests.** Fixture `tour`: key `egl:KIX5`, stops 大阪 京都 奈良 神戶 (all 關西), days 5, nights 4, `fromPriceHkd` and `windowPriceHkd` 7999, six departures from `2026-12-18`, `priceChange` lower 500 since `2026-11-05`, `lastUpdated` `2026-11-11T19:10:00Z`, url `https://www.egltours.com/website/itinerary/KIX5`, start and end `hk`. `today = '2026-11-12'`.

```ts
// card-text.test.ts
it('routeNames uses the region name for a region-only stop', () => { /* [北海道 region-only, 札幌] → ['北海道', '札幌'] */ });
it('regionLabel', () => {
  expect(regionLabel(kansaiStops, places)).toBe('日本 · 關西');
  expect(regionLabel([...kansaiStops, tokyoStop, seoulStop], places)).toBe('日本 · 關西 +2');
});
it.each([
  [{ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' }, '↓ HK$500　比7日前', 'down'],
  [{ kind: 'higher', diffHkd: 300, sinceDate: '2026-11-05' }, '↑ HK$300　比7日前', 'up'],
  [{ kind: 'same', sinceDate: '2026-11-05' }, '— 與7日前相同', 'same'],
  [{ kind: 'lower', diffHkd: 200, sinceDate: '2026-11-09' }, '↓ HK$200　比3日前', 'down'],
])('priceChangeText(%j)', (change, text, tone) => {
  expect(priceChangeText(change as PriceChange, '2026-11-12', tZh)).toEqual({ text, tone });
});
it('priceChangeText(null) is null', () => { expect(priceChangeText(null, '2026-11-12', tZh)).toBeNull(); });
it.each([
  [{ kind: 'hk', label: null }, { kind: 'hk', label: null }, null],
  [{ kind: 'sz', label: null }, { kind: 'sz', label: null }, null],
  [{ kind: 'hk', label: null }, { kind: 'sz', label: null }, null],
  [{ kind: 'other', label: '澳門外港碼頭' }, { kind: 'hk', label: null }, '澳門外港碼頭出發'],
  [{ kind: 'hk', label: null }, { kind: 'other', label: '澳門' }, '澳門解散'],
  [{ kind: 'other', label: '澳門' }, { kind: 'other', label: '珠海' }, '澳門出發 · 珠海解散'],
  [{ kind: 'other', label: '澳門' }, { kind: 'other', label: '澳門' }, '澳門出發'],
])('startNote', (start, end, expected) => { expect(startNote(start as TourPoint, end as TourPoint, tZh)).toBe(expected); });

// TourCard.test.tsx
it('shows the facts from the mockup', () => {
  render(<TourCard {...props} />);
  expect(screen.getByText('東瀛遊')).toBeInTheDocument();
  expect(screen.getByText('日本 · 關西')).toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent('大阪→京都→奈良→神戶');
  expect(screen.getByText('5日4夜')).toBeInTheDocument();
  expect(screen.getByText(/HK\$7,999/)).toBeInTheDocument();
  expect(screen.getByText('↓ HK$500　比7日前')).toBeInTheDocument();
  expect(screen.getByText('更新：今日 03:10')).toBeInTheDocument();
});
it('shows four date chips and counts the rest', () => {
  render(<TourCard {...props} />);
  expect(screen.getByText('12/18')).toBeInTheDocument();
  expect(screen.getByText('+2 個出發日')).toBeInTheDocument();
});
it('links to the operator in a new tab', () => {
  render(<TourCard {...props} />);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', 'https://www.egltours.com/website/itinerary/KIX5');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
});
it('uses the operator colour for the tag and the left border', () => { /* style contains #d62839 */ });
it('has no add button without onAdd', () => { render(<TourCard {...props} />); expect(screen.queryByRole('button')).toBeNull(); });
it('the add button is outside the link and opens the picker', async () => {
  const onAdd = vi.fn();
  render(<TourCard {...props} onAdd={onAdd} />);
  const button = screen.getByRole('button', { name: '加入行程 ＋' });
  expect(screen.getByRole('link').contains(button)).toBe(false);
  await user.click(button);
  expect(screen.getByText('選擇出發日期')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
  expect(onAdd).toHaveBeenCalledWith('2026-12-18');
});
it('hides the price change when the window price differs from the from-price', () => {
  render(<TourCard {...props} tour={{ ...tour, windowPriceHkd: 8999 }} />);
  expect(screen.queryByText(/比7日前/)).toBeNull();
  expect(screen.getByText(/HK\$8,999/)).toBeInTheDocument();
});
it('shows the start note only for a non-HK, non-Shenzhen start', () => {
  render(<TourCard {...props} tour={{ ...tour, start: { kind: 'other', label: '澳門外港碼頭' } }} />);
  expect(screen.getByText('澳門外港碼頭出發')).toBeInTheDocument();
});
it('shows a footNote in place of the updated time', () => {
  render(<TourCard {...props} footNote="休息 1–2 日後出發" />);
  expect(screen.getByText('休息 1–2 日後出發')).toBeInTheDocument();
  expect(screen.queryByText(/更新/)).toBeNull();
});
it('renders no image and no description', () => { const { container } = render(<TourCard {...props} />); expect(container.querySelector('img')).toBeNull(); });

// DeparturePicker.test.tsx
it('lists every departure with weekday and price', () => { /* '2026年12月18日（五）' and 'HK$7,999' */ });
it('shows the fallback price with 起 when a date has no price', () => {});
it('calls onPick with the ISO date', async () => {});
it('closes on Escape', async () => {});
it('focuses the first date on open', () => {});
```

Write the commented tests in full. `2026-12-18` is a Friday.

- [ ] **Step 2: Run** `pnpm --filter @hktours/web test` — Expected: FAIL.
- [ ] **Step 3: Implement** `card-text.ts`, `TourCard`, `DeparturePicker` and their CSS, and add the dictionary keys.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Look at it.** Temporarily render three cards with made-up data on `/` next to the mockup open in another window. Check: left border colour, tag, route arrows in khaki, cerulean price, ash date chips, footer. Remove the temporary data afterwards.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(web): tour card and departure picker"`
