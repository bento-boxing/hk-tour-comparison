import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { places } from '@hktours/core';
import { placeName } from './place-names';
import { EN_COUNTRY_EM, EN_REGION_EM } from './english-name-widths';
import { COMMA_PX, COUNTRY_PX, PHONE_COL_EM, REGION_PX, phoneCell, phoneFitCss } from './directory-cells';

const SCRIPT = 'apps/web/scripts/measure-english-names.mjs';
/** Every region the directory can list: not an area, in a country with more than one region. */
const listable = places.data.regions.filter(r => !r.members && places.regionsOf(r.countryId).length > 1);
const regionNames = new Set(listable.map(r => placeName(r, 'en')));
const countryNames = new Set(places.data.countries.map(c => placeName(c, 'en')));

it('the measured English names are all still places: a stale entry fails (run the measuring script again)', () => {
  expect(Object.keys(EN_REGION_EM).filter(name => !regionNames.has(name)), `stale: run ${SCRIPT}`).toEqual([]);
  expect(Object.keys(EN_COUNTRY_EM).filter(name => !countryNames.has(name)), `stale: run ${SCRIPT}`).toEqual([]);
  expect(Object.keys(EN_REGION_EM).length).toBeGreaterThan(60);
  expect(Object.keys(EN_COUNTRY_EM).length).toBeGreaterThan(90);
});

/** English names with no measurement yet: each is listed as a to-do in the test summary, never a failure. */
const unmeasured = [
  ...[...regionNames].filter(name => !Object.hasOwn(EN_REGION_EM, name)).map(name => `region ${name}`),
  ...[...countryNames].filter(name => !Object.hasOwn(EN_COUNTRY_EM, name)).map(name => `country ${name}`),
];
for (const name of unmeasured) it.todo(`measure the English ${name} (it takes a whole row on phones until ${SCRIPT} is run)`);

it('an English name not measured yet is only a notice (a to-do above), and takes the whole row on phones (never too narrow)', () => {
  expect(phoneCell('region', 'en', 'A Region Added Tomorrow', 1)).toEqual({ long: true });
  expect(phoneCell('plain', 'en', 'A Country Added Tomorrow', 1)).toEqual({ long: true });
  expect(phoneCell('region', 'en', 'constructor', 1)).toEqual({ long: true }); // not a table entry, whatever the object has
});

it('each measured width is a plausible width for its name (about half an em per letter, never far off)', () => {
  for (const [table, name] of [[EN_REGION_EM, 'region'], [EN_COUNTRY_EM, 'country']] as const) {
    for (const [place, em] of Object.entries(table)) expect(em / place.length, `${name} ${place}`).toBeGreaterThan(0.3);
    for (const [place, em] of Object.entries(table)) expect(em / place.length, `${name} ${place}`).toBeLessThan(0.9);
  }
});

const long = (...a: Parameters<typeof phoneCell>) => phoneCell(...a).long;
/** What a marked cell needs, in px at the normal text size. */
const needPx = (fit: string | undefined) => {
  const [kind, , need] = fit!.split('-');
  return (Number(need) / 1000) * (kind === 'region' ? REGION_PX : COUNTRY_PX);
};

it('a cell can take the whole row on phones only when its name and count need more than its column\'s least width, with 12px to spare', () => {
  // Chinese regions: three columns at 375px; a five-character name fits with up to three digits, not four.
  expect(long('region', 'zh-Hant', '首爾及京畿', 169)).toBe(false);
  expect(long('region', 'zh-Hant', '首爾及京畿', 1169)).toBe(true);
  expect(long('region', 'zh-Hans', '广东', 1752)).toBe(false);
  // Chinese countries without regions: the count is under the name; the longest name fits, with any count.
  expect(long('plain', 'zh-Hant', '巴布亞新畿內亞', 9999)).toBe(false);
  // English regions: two columns from 320px for the ordinary names.
  expect(long('region', 'en', 'Bangkok & Central Thailand', 144)).toBe(true);
  expect(long('region', 'en', 'Inner Mongolia', 14)).toBe(false);
  expect(long('region', 'en', 'Inner Mongolia', 1234)).toBe(true);
  expect(long('region', 'en', 'Guangdong', 1752)).toBe(false);
  expect(long('plain', 'en', 'Bosnia and Herzegovina', 1)).toBe(true);
  expect(long('plain', 'en', 'Hong Kong', 9999)).toBe(false);
  // The mark is what the cell needs: "Northern Taiwan 61" needs 148.2px (the column is at least 148).
  const taiwan = phoneCell('region', 'en', 'Northern Taiwan', 61);
  expect(taiwan.fit).toMatch(/^region-en-\d+$/);
  expect(needPx(taiwan.fit)).toBeCloseTo(148.2, 0);
  expect(phoneCell('region', 'en', 'Inner Mongolia', 14).fit).toBeUndefined();
  // Most English names are ordinary.
  const longRegions = listable.filter(r => long('region', 'en', placeName(r, 'en'), 99));
  expect(longRegions.length / listable.length).toBeLessThan(0.35);
  const longCountries = places.data.countries.filter(c => long('plain', 'en', placeName(c, 'en'), 99));
  expect(longCountries.length / places.data.countries.length).toBeLessThan(0.2);
});

it('a count of 1,000 or more needs its thousands comma too (4.134px at the counts\' 13px), as the page writes it', () => {
  // A region's count is beside its name: each digit 8.5px, each comma 4.134px (the widest measured, 4.1333px, rounded
  // up at the third decimal only).
  expect(COMMA_PX).toBe(4.134);
  const need = (...a: Parameters<typeof phoneCell>) => needPx(phoneCell(...a).fit);
  expect(need('region', 'en', 'Northern Taiwan', 1061) - need('region', 'en', 'Northern Taiwan', 61)).toBeCloseTo(2 * 8.5 + 4.134, 1);
  expect(need('region', 'en', 'Northern Taiwan', 1000) - need('region', 'en', 'Northern Taiwan', 999)).toBeCloseTo(8.5 + 4.134, 1);
  expect(need('region', 'en', 'Northern Taiwan', 1000061) - need('region', 'en', 'Northern Taiwan', 61)).toBeCloseTo(5 * 8.5 + 2 * 4.134, 1);
  // "首爾及京畿 1,888": 70 + 5 + 34 + 4.134 + 12 = 125.134px.
  expect(need('region', 'zh-Hant', '首爾及京畿', 1888)).toBeCloseTo(125.134, 1);
  // A country without regions has its count under its name: the comma counts where the count is the wider line.
  expect(need('plain', 'en', 'Bosnia and Herzegovina', 1888)).toBeCloseTo(need('plain', 'en', 'Bosnia and Herzegovina', 888), 1);
});

/** The rules phoneFitCss makes, read back: per mark, the grid widths (ems of its font) where the cell is let in. */
function letIn(css: string): Map<string, [number, number][]> {
  const out = new Map<string, [number, number][]>();
  for (const line of css.split('\n')) {
    const m = /^@container \(min-width: ([\d.]+)em\) and \(max-width: ([\d.]+)em\) \{ \.LONG\[data-fit=([\w-]+)\] \{ grid-column: auto; \} \}$/.exec(line);
    expect(m, line).not.toBeNull();
    out.set(m![3], [...(out.get(m![3]) ?? []), [Number(m![1]), Number(m![2])]]);
  }
  return out;
}

it('on phones the container queries let a marked cell into its column wherever the column is wide enough, and nowhere else', () => {
  // Every listed English region and every country, Chinese and English, with one to four digits.
  const cells = [
    ...listable.flatMap(r => (['en', 'zh-Hant'] as const).map(l => ['region', l, placeName(r, l)] as const)),
    ...places.data.countries.flatMap(c => (['en', 'zh-Hant'] as const).map(l => ['plain', l, placeName(c, l)] as const)),
  ].flatMap(([kind, l, name]) => [5, 55, 555, 5555].map(n => phoneCell(kind, l, name, n)));
  const marks = cells.flatMap(c => (c.fit ? [c.fit] : []));
  expect(marks.length).toBeGreaterThan(100);
  const rules = letIn(phoneFitCss(marks, 'LONG'));
  let fits = 0, full = 0;
  for (const fit of new Set(marks)) {
    const [kind, lang] = fit.split('-') as ['region' | 'plain', 'zh' | 'en'];
    const font = kind === 'region' ? REGION_PX : COUNTRY_PX;
    const least = PHONE_COL_EM[kind][lang] * font;
    // The browser may lay the least width out rounded to its unit (Firefox: 1/60px; 114.002px as 114): a grid at a
    // column count's boundary may have either count.
    const rounded = Math.round(least * 60) / 60;
    // Every grid width a phone has at the normal text size (320-639px, less 24px of margins), and wider ones as
    // with smaller text, up to the widest the queries cover; in half px.
    for (let halves = 592; halves <= 1920; halves++) {
      const grid = halves / 2;
      const counts = [least, rounded].map(l => Math.floor(grid / l + 1e-9));
      const roomy = counts.every(n => n >= 2 && grid / n >= needPx(fit));
      const nearBoundary = [least, rounded].some(l => Math.abs(grid / l - Math.round(grid / l)) * l < 0.2);
      const em = grid / font;
      const queried = (rules.get(fit) ?? []).some(([from, to]) => em >= from && em <= to);
      const where = `${fit} in a ${grid}px grid (${counts.join(' or ')} columns)`;
      // Never let in where the column is too narrow, whichever way the browser rounds; let in wherever it is wide
      // enough, except within 0.2px under a column count's boundary.
      if (queried) expect(roomy, where).toBe(true);
      else if (!nearBoundary) expect(roomy, where).toBe(false);
      if (queried) fits++; else full++;
    }
  }
  expect(fits).toBeGreaterThan(2000);
  expect(full).toBeGreaterThan(2000);
  // Chinese regions: a five-character name with four digits (125.134px) needs two columns of a 342px grid, which Firefox
  // lays out as three of 114px: not let in there, but in a 341px grid (two of 170.5px).
  const seoul = phoneCell('region', 'zh-Hant', '首爾及京畿', 1888).fit!;
  const inAt = (grid: number) => (rules.get(seoul) ?? []).some(([from, to]) => grid / REGION_PX >= from && grid / REGION_PX <= to);
  expect([341, 342, 343].map(inAt)).toEqual([true, false, false]);
  // Bangkok & Central Thailand never fits a column on a phone; Northern Taiwan 61 from a 375px phone, not at 320.
  const at = (fit: string | undefined, phone: number) => (rules.get(fit!) ?? []).some(([from, to]) => {
    const em = (phone - 24) / REGION_PX;
    return em >= from && em <= to;
  });
  const bangkok = phoneCell('region', 'en', 'Bangkok & Central Thailand', 144).fit;
  for (let phone = 320; phone < 640; phone++) expect(at(bangkok, phone), `${phone}`).toBe(false);
  const taiwan = phoneCell('region', 'en', 'Northern Taiwan', 61).fit;
  expect([320, 360, 375, 414, 480].map(phone => at(taiwan, phone))).toEqual([false, true, true, true, true]);
});

it('the stylesheet sizes the phones\' columns in ems of each grid\'s font, the same as the decision assumes, and makes each grid a query container', () => {
  const css = readFileSync(join(__dirname, '../app/_site/tours-page.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const phone = css.slice(css.indexOf('@media (max-width: 639px)'));
  expect(phone).toMatch(new RegExp(`\\.regions \\{ font-size: ${REGION_PX}px; \\}`));
  expect(css).toMatch(new RegExp(`\\.plain \\{[^}]*font-size: ${COUNTRY_PX}px;`));
  expect(phone).toContain(`.page { --col-region: ${PHONE_COL_EM.region.zh}em; --col-plain: ${PHONE_COL_EM.plain.zh}em; }`);
  expect(phone).toContain(`.page:lang(en) { --col-region: ${PHONE_COL_EM.region.en}em; --col-plain: ${PHONE_COL_EM.plain.en}em; }`);
  expect(phone).toContain('.regions, .plain { container-type: inline-size; }');
  // No gap between the columns (the decision counts none).
  expect(css).not.toMatch(/\.(regions|plain) \{[^}]*(column-)?gap/);
});
