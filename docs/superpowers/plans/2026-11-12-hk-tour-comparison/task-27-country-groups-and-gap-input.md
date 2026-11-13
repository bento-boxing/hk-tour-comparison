# Task 27: Countries grouped by part of the world; rest days typed as numbers

**Goal:** two changes the owner asked for on 2026-11-13 after using the live site.

1. In the destination panel, the list of countries is shown under headings by part of the world instead of as one flat list.
2. On the chaining page, the rest-days control is two number fields the visitor types into, replacing the drop-down menus.

Public text stays Traditional Chinese only; developer English goes in the English dictionary as for every other string. Colours come from `apps/web/lib/theme.css` only (the owner's palette); no new colours.

**Files (expected; follow what the code actually has):**
- Modify: `packages/core/src/places/data.json`, `packages/core/src/places/index.ts`, `packages/core/src/types.ts` (and the schema that validates the places data, if one does)
- Modify: `apps/web/components/DestinationPanels.tsx` (+ its CSS module and tests), `apps/web/components/GapSelector.tsx` (+ CSS module and tests), `apps/web/lib/dict.*`
- Test: beside each file changed, in the style already there

## Part 1: country groups

Every country gets exactly one group. The groups, in this display order, with their public labels:

| id | Label (zh-Hant) | Developer English | Contains |
|---|---|---|---|
| `china` | 中國內地及港澳台 | Mainland China, Hong Kong, Macau, Taiwan | 中國, 香港, 澳門, 台灣 (whichever exist in the data) |
| `northeast-asia` | 日本及韓國 | Japan and Korea | 日本, 韓國 (and 蒙古, 北韓 if present) |
| `southeast-asia` | 東南亞 | South East Asia | 泰國, 越南, 新加坡, 馬來西亞, 印尼, 菲律賓, 柬埔寨, 老撾, 緬甸, 汶萊, 東帝汶 |
| `south-central-asia` | 南亞及中亞 | South and Central Asia | 印度, 尼泊爾, 不丹, 斯里蘭卡, 馬爾代夫, 孟加拉, 巴基斯坦, the five 「…斯坦」 Central Asian countries |
| `middle-east` | 中東 | Middle East | 土耳其, 阿聯酋, 以色列, 約旦, 沙特阿拉伯, 伊朗, 卡塔爾, 阿曼 and the like; the Caucasus (格魯吉亞, 亞美尼亞, 阿塞拜疆) goes here too |
| `europe` | 歐洲 | Europe | all European countries, including 俄羅斯, 冰島 and 格陵蘭 |
| `americas` | 美洲 | Americas | North, Central and South America and the Caribbean |
| `africa` | 非洲 | Africa | all African countries, including 埃及 and 摩洛哥 |
| `oceania` | 大洋洲 | Oceania | 澳洲, 新西蘭, Pacific islands |
| `polar` | 南北極 | Polar | 南極 and similar entries that are not a country, only if the data has any |

- Store the group on each country in `data.json` (a `group` field holding the id) and keep the group list (id, label, order) in one place in core. Egypt is Africa and Turkey is Middle East for this purpose: the grouping is for finding a country quickly, not a political statement.
- A test must fail if any country has no group, a group id not in the list, or if a group in the list is empty (an empty group is removed from the list, not shown).
- Export from core: the ordered groups, each with its countries in the order the flat list uses today.
- `DestinationPanels`: the country column shows each group's label as a heading (not selectable, not a link) followed by that group's countries. A group none of whose countries has any tour available is not shown, by the same rule the flat list uses today for hiding or showing countries; do not change which countries appear, only how they are arranged. Choosing a country, the region column, 全部地區, keyboard use and the address parameters all behave exactly as now.
- Headings are real headings or `role="group"` with `aria-label`, so a screen reader announces them. At 375 px wide the panel must not scroll sideways.
- The search bar and its suggestions (`國家 → 地區`) are not changed.
- The exclude-country filter on the chaining page uses the same grouped arrangement if it lists countries through the same component; if it is a separate list, group it the same way.

## Part 2: rest days as typed numbers

Today `GapSelector` offers the minimum and maximum rest days through drop-down menus. Replace them with two number fields, so the visitor types the numbers directly and a phone shows its number pad.

- Two fields, minimum and maximum, labelled as now. Each is `<input type="text" inputmode="numeric" pattern="[0-9]*">` (this is what brings up the number pad on phones without the spinner arrows and without accepting `e`, `-` or `.`), with an accessible label.
- Allowed values: whole numbers from 0 to the largest gap `decodeChain` / the chain URL code accepts today (find that limit in `packages/core/src/chain-url.ts`; do not change it). Default stays 1–3.
- Behaviour:
  - Non-digits cannot be entered (strip them on input). An empty field while typing is allowed and changes nothing.
  - The value is applied when the field loses focus or the visitor presses Enter (not on every keystroke, so typing `1` on the way to `10` does not reload the list). IME composition must not trigger it (the code base already handles `keyCode 229` elsewhere; follow that).
  - On apply: a number above the limit becomes the limit; an empty field goes back to the value it had. If minimum would exceed maximum, the *other* field is moved to match the one just edited (edit min to 5 with max 3 → 5–5; edit max to 0 with min 1 → 0–0).
  - Applying updates the page address exactly as the drop-downs do now (`gap=min-max`), so shared links, reload and the back button keep working. An address with an out-of-range or malformed `gap` is handled as it is today.
- Keep the visual style of the mockup's gap selector (cerulean, the khaki gap line); the fields are narrow (room for two digits) and at least 44 px tall for touch.

## Steps

- [ ] Write the failing tests: group coverage in core; grouped rendering and unchanged selection behaviour in `DestinationPanels`; every rule in "Behaviour" above for `GapSelector` (each rule its own test, including Enter, blur, clamp, min-over-max both ways, empty field, non-digits, composition).
- [ ] Run them; expected: fail.
- [ ] Implement.
- [ ] `pnpm test` and `pnpm typecheck`; expected: all pass.
- [ ] Commit: `feat(web): countries grouped by part of the world; rest days typed as numbers`.

**Done when:** all tests pass, no existing address parameter or selection behaviour has changed, and the report lists the group assigned to every country so the owner can check it.
