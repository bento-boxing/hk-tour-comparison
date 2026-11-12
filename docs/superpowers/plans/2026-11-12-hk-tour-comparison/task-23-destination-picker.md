# Task 23: Destination search bar and country/region panels

**Goal:** the two ways a visitor chooses a destination, both ending in a country + region selection.

Open `docs/design/mockup.html`: the search bar is `.search` with its `.sugg` dropdown (2px cerulean border on the input, 8px radius; dropdown rows 14px, the highlighted row on `--hit` with the label in cerulean, and a muted `包括 …` hint).

**Files:**
- Create: `apps/web/components/DestinationSearch.tsx`, `DestinationSearch.module.css`, `DestinationPanels.tsx`, `DestinationPanels.module.css`
- Test: `apps/web/components/DestinationSearch.test.tsx`, `DestinationPanels.test.tsx`
- Modify: both dictionaries

**Interfaces:**
- Consumes: `suggestRegions`, `Suggestion`, `Destination`, `ALL_REGIONS_LABEL` (Task 8); `PlacesIndex` (Task 3); `t` (Task 20).
- Produces (both are client components):

```ts
export interface DestinationSearchProps {
  places: PlacesIndex; t: T;
  value: Destination | null;
  onSelect: (dest: Destination | null) => void;
}
export function DestinationSearch(props: DestinationSearchProps): JSX.Element;

export interface DestinationPanelsProps {
  places: PlacesIndex; t: T;
  value: Destination | null;
  onSelect: (dest: Destination) => void;
  /** Country ids never offered. Default ['hongkong']. */
  hiddenCountryIds?: string[];
}
export function DestinationPanels(props: DestinationPanelsProps): JSX.Element;

export function destinationLabel(dest: Destination, places: PlacesIndex): string; // '日本 → 關西' / '日本 → 全部地區'
```

## Search bar behaviour

- A text input with placeholder `輸入國家、地區或城市`, implemented as an accessible combobox (`role="combobox"`, a `listbox` of `option`s, `aria-activedescendant`).
- On each keystroke, show `suggestRegions(query, places)` (at most 8). Each option shows the label `Country → Region`. Beneath or beside it, a muted hint `包括 大阪、京都、奈良、神戶`: the first four cities of that region, with the matched city (`via`) moved to the front. Country-wide options have no hint.
- A non-empty query with no suggestions shows one non-selectable row: `沒有相符地區`.
- An empty or whitespace-only query shows no dropdown.
- Arrow down/up move the highlight (wrapping); Enter selects the highlighted option, or the first when none is highlighted; Escape closes the dropdown and keeps the text; clicking an option selects it.
- Selecting calls `onSelect(suggestion.destination)`, closes the dropdown and sets the input text to the label.
- When `value` is set from outside (for example from the panels), the input shows `destinationLabel(value)`. A clear button (`清除`, shown when `value` is set) calls `onSelect(null)` and empties the input.
- Typing never changes the selection by itself; only choosing an option does.

## Panels behaviour

- A button `按國家選擇` opens the panel. Step one lists every country in the places list except the hidden ones. Choosing a country shows step two: `全部地區` first, then that country's regions, with a `← 返回` button back to step one.
- Choosing a region or `全部地區` calls `onSelect` and closes the panel.
- A country with exactly one region skips step two and selects that region.
- The currently selected country and region are marked with `aria-current="true"`.

## Dictionary keys

| Key | zh-Hant | en |
|---|---|---|
| `dest.placeholder` | 輸入國家、地區或城市 | Type a country, region or city |
| `dest.none` | 沒有相符地區 | No matching region |
| `dest.includes` | 包括 {cities} | Includes {cities} |
| `dest.clear` | 清除 | Clear |
| `dest.byCountry` | 按國家選擇 | Browse by country |
| `dest.allRegions` | 全部地區 | All regions |
| `dest.back` | ← 返回 | ← Back |

The `全部地區` shown in panels and in `destinationLabel` must be the same text `suggestRegions` uses (`ALL_REGIONS_LABEL`).

## Steps

- [ ] **Step 1: Write the failing tests.**

```ts
// DestinationSearch.test.tsx
it('typing a city suggests its region as Country → Region', async () => {
  render(<DestinationSearch places={places} t={tZh} value={null} onSelect={onSelect} />);
  await user.type(screen.getByRole('combobox'), '大阪');
  const option = screen.getAllByRole('option')[0];
  expect(option).toHaveTextContent('日本 → 關西');
  expect(option).toHaveTextContent(/包括 大阪/);
});
it('selecting an option reports the destination and fills the input', async () => {
  // type 大阪, click the first option → onSelect({countryId:'japan', regionId:'japan-kansai'}); input value '日本 → 關西'
});
it('typing a country offers all regions first', async () => { /* 日本 → first option '日本 → 全部地區', no hint */ });
it('Enter selects the first suggestion; arrows move the highlight', async () => {
  // type 日本, ArrowDown twice, Enter → onSelect called with the second option's destination
});
it('shows the no-match message and selects nothing on Enter', async () => {
  // type 亞特蘭提斯 → '沒有相符地區'; Enter → onSelect not called
});
it('shows no dropdown for whitespace', async () => { /* type three spaces → no listbox */ });
it('Escape closes the dropdown and keeps the text', async () => {});
it('typing alone does not change the selection', async () => { /* type 大阪 → onSelect not called */ });
it('shows an outside value and can clear it', async () => {
  // value kansai → input '日本 → 關西'; click 清除 → onSelect(null)
});
it('distinguishes same-named cities in two countries', async () => {
  // with the tiny two-country index: type 聖城 → options '甲國 → 甲區' and '乙國 → 乙區'
});

// DestinationPanels.test.tsx
it('lists countries but not Hong Kong', async () => { /* open → 日本, 韓國 present; 香港 absent */ });
it('choosing a country then a region selects it', async () => { /* 日本 → 關西 → onSelect kansai */ });
it('offers all regions first', async () => { /* 日本 → 全部地區 → onSelect({countryId:'japan', regionId:null}) */ });
it('a single-region country selects straight away', async () => { /* 新加坡 → onSelect singapore region */ });
it('back returns to the country list', async () => {});
it('marks the current selection', async () => {});
```

Write every commented test in full.

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** both components and add the dictionary keys.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Look at it** next to the mockup: input border, dropdown shadow, highlighted row colour, hint text.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(web): destination search bar and country/region panels"`
