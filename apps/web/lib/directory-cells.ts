import type { Locale } from './i18n';
import { EN_COUNTRY_EM, EN_REGION_EM } from './english-name-widths';

// The destinations directory's cells on phones (app/_site/tours-page.module.css, below 640px): does a region, or a
// country without regions, fit its column, or must it take the whole row? Its column's width depends on the phone's
// width and the text size, so the server only works out what the cell needs, in ems of its grid's font (from the
// name's measured width and the count's digits); container queries on the grid, in the same ems, then let it into
// a column wherever the column is wide enough. The answer holds at any text size: the column widths, the cell's
// needs and the queries all grow with the text.
//
// Every length here is in px at the browser's normal text size, unless named in ems.

/** The phones' type: a region's name, a country's name, a count. */
export const REGION_PX = 14;
export const COUNTRY_PX = 19;
/** The widest tabular digit at the counts' 13px in the fonts measured (8.43px), rounded up; and the units after it. */
const DIGIT_PX = 8.5;
const UNIT_PX: Readonly<Record<Locale, number>> = { 'zh-Hant': 17, 'zh-Hans': 17, en: 37 }; // ' 團', ' tours'
/** A region's name to its count; the least clear space after a cell's text, before the next column. */
const REGION_GAP_PX = 5;
const CLEAR_PX = 12;

type Kind = 'region' | 'plain';
type Lang = 'zh' | 'en';
const FONT_PX: Readonly<Record<Kind, number>> = { region: REGION_PX, plain: COUNTRY_PX };

/**
 * Each column's least width on phones, in ems of its grid's font: the stylesheet's --col-region and --col-plain below
 * 640px (directory-cells.test.ts checks they are the same). The grids repeat as many columns as fit, with no gap, so a
 * grid W wide has floor(W / least) columns of W / that each. Chinese regions: three columns on a 375px phone (114px);
 * English regions and every country without regions: two on a 320px one ((320 - 2 × 12) / 2 = 148px; Chinese 146px).
 */
export const PHONE_COL_EM: Readonly<Record<Kind, Readonly<Record<Lang, number>>>> = {
  region: { zh: 8.143, en: 10.571 },
  plain: { zh: 7.685, en: 7.789 },
};

/** A name's width in ems of its own font: Chinese characters are 1em each; English names are measured (or unknown). */
function nameEm(kind: Kind, locale: Locale, name: string): number | undefined {
  if (locale !== 'en') return [...name].length;
  const table = kind === 'region' ? EN_REGION_EM : EN_COUNTRY_EM;
  return Object.hasOwn(table, name) ? table[name] : undefined;
}

/** A cell on phones: whether it can take the whole row, and if so its mark for phoneFitCss. */
export interface PhoneCell {
  /** Its name and count, with CLEAR_PX to spare, are wider than its column's least width: .long, the whole row. */
  long: boolean;
  /** Where some columns are wide enough for it: `<kind>-<zh|en>-<what it needs, in thousandths of an em>`. */
  fit?: string;
}

/**
 * A region, or a country without regions, on phones. A region's count sits beside its name; a country's under it. An
 * English name not measured yet (scripts/measure-english-names.mjs) always takes the whole row (no mark).
 */
export function phoneCell(kind: Kind, locale: Locale, name: string, tours: number): PhoneCell {
  const em = nameEm(kind, locale, name);
  if (em === undefined) return { long: true };
  const lang: Lang = locale === 'en' ? 'en' : 'zh';
  const digits = String(Math.max(0, Math.trunc(tours))).length;
  const text = kind === 'region'
    ? em * REGION_PX + REGION_GAP_PX + digits * DIGIT_PX
    : Math.max(em * COUNTRY_PX, digits * DIGIT_PX + UNIT_PX[locale]);
  // In thousandths of an em of the grid's font, rounded up: never less than the cell needs.
  const need = Math.ceil(((text + CLEAR_PX) / FONT_PX[kind]) * 1000 - 1e-6);
  return need > milli(PHONE_COL_EM[kind][lang]) ? { long: true, fit: `${kind}-${lang}-${need}` } : { long: false };
}

const milli = (em: number) => Math.round(em * 1000);

/**
 * The widest grid the queries cover: a 639px phone's (615px) with the text down to 64% of the normal size. Where a
 * grid is wider in ems than this (smaller text still), a marked cell keeps the whole row: never too narrow.
 */
const WIDEST_GRID_PX = 960;

/**
 * The container queries that let marked cells into a column (inside the page, after the stylesheet). A grid of
 * least column L (ems) is k columns wide while it is at least k × L and less than (k + 1) × L ems wide; a cell needing N
 * ems fits there once the grid is at least k × N ems wide. One rule per mark and per column count where that happens
 * (2 and up: in one column a cell takes the row anyway). The query's ems are the grid's own font size (the query
 * container's), as the cell's needs are. `longClass` is the stylesheet's .long.
 */
export function phoneFitCss(marks: Iterable<string>, longClass: string): string {
  const rules: string[] = [];
  for (const mark of [...new Set(marks)].sort()) {
    const m = /^(region|plain)-(zh|en)-(\d+)$/.exec(mark);
    if (!m) continue;
    const [, kind, lang, needText] = m as unknown as [string, Kind, Lang, string];
    const need = Number(needText), col = milli(PHONE_COL_EM[kind][lang]);
    for (let k = 2; k * col * FONT_PX[kind] <= WIDEST_GRID_PX * 1000; k++) {
      // From k × N; to just under (k + 1) × L, by 0.01em: browsers round the least width to their layout unit (Firefox
      // 1/60px: 8.143em of 14px is 114.002px, laid out as 114, so a 342px grid already has three columns), and
      // 0.01em is more than that rounding over k + 1 columns.
      const from = k * need, to = (k + 1) * col * 10 - 100;
      if (from * 10 <= to) rules.push(`@container (min-width: ${(from / 1000).toFixed(3)}em) and (max-width: ${(to / 10000).toFixed(4)}em) { .${longClass}[data-fit=${mark}] { grid-column: auto; } }`);
    }
  }
  return rules.join('\n');
}
