import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrast, luminance, ON_OPERATOR, operatorTextTone } from './contrast';

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'theme.css'), 'utf8');

/** The declarations of the first rule whose selector is exactly `selector` (inside an at-rule or not). */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} not found in theme.css`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[m[1].slice(2)] = m[2].trim();
  return tokens;
}

const light = block(':root');
const darkChosen = block(":root[data-theme='dark']");
const darkSystem = block(":root:not([data-theme='light'])");
const dark = { ...light, ...darkChosen };
const themes = { light, dark } as const;

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (theme: Record<string, string>, name: string): string => {
  const value = theme[name];
  if (!value || !HEX.test(value)) throw new Error(`--${name} is not a #rrggbb colour (${value})`);
  return value;
};

/** The light value of a token (the first in theme.css), as the older tests read it. */
const token = (name: string) => hex(light, name);

/** Colour tokens that are the same in both themes on purpose (each says why in theme.css). */
const SAME_IN_BOTH = [
  'notice-maroon', 'notice-text', 'on-operator-light', 'on-operator-dark', 'op-fallback',
  'op-egl', 'op-jetour', 'op-texpert', 'op-bigline', 'op-charming', 'op-yummy', 'op-sunflower', 'op-taste',
];

it('the dark theme is declared once for a visitor who chose it and once for one whose system is dark, identically', () => {
  expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{/);
  expect(darkSystem).toEqual(darkChosen);
  expect(css).toMatch(/:root \{[^}]*color-scheme: light;/);
  expect(css).toMatch(/:root\[data-theme='dark'\] \{[^}]*color-scheme: dark;/);
  expect(css).toMatch(/:root:not\(\[data-theme='light'\]\) \{[^}]*color-scheme: dark;/);
});

it('every colour token has a dark value, except the few that are the same in both themes', () => {
  const colourTokens = Object.keys(light).filter(name => HEX.test(light[name]) || /^rgba?\(/.test(light[name]));
  expect(colourTokens.length).toBeGreaterThan(20);
  for (const name of colourTokens) {
    if (SAME_IN_BOTH.includes(name)) expect(darkChosen[name], name).toBeUndefined();
    else expect(darkChosen[name], name).toBeDefined();
  }
  // Nothing in the dark block that the light block lacks.
  for (const name of Object.keys(darkChosen)) expect(light[name], name).toBeDefined();
});

it('the theme switch shows one button per theme through two display tokens', () => {
  expect([light['when-light'], light['when-dark']]).toEqual(['inline-flex', 'none']);
  expect([darkChosen['when-light'], darkChosen['when-dark']]).toEqual(['none', 'inline-flex']);
});

it('the colours the owner chose (task 47): ink and gold in light, the warm charcoal with gold in dark', () => {
  const pick = (theme: Record<string, string>, names: string[]) => Object.fromEntries(names.map(n => [n, hex(theme, n).toLowerCase()]));
  expect(pick(light, ['ink', 'gold', 'page', 'surface', 'text-muted', 'line', 'chip', 'header-bg', 'viewed-bg', 'latest-bg'])).toEqual({
    ink: '#14213d', gold: '#f5b82e', page: '#faf9f4', surface: '#ffffff', 'text-muted': '#555c70', line: '#e0ded3',
    chip: '#eef0f6', 'header-bg': '#14213d', 'viewed-bg': '#e8ecf5', 'latest-bg': '#fdf3d3',
  });
  expect(pick(dark, ['ink', 'gold', 'on-gold', 'page', 'surface', 'text-muted', 'line', 'header-bg', 'viewed-bg', 'latest-bg'])).toEqual({
    ink: '#ecebe6', gold: '#f0b429', 'on-gold': '#17181c', page: '#1e1f1d', surface: '#282927', 'text-muted': '#a9aaa3',
    line: '#3a3b37', 'header-bg': '#141513', 'viewed-bg': '#383934', 'latest-bg': '#3a3220',
  });
  expect(token('notice-maroon')).toBe('#800000');
  expect(token('notice-text')).toBe('#fffcff');
});

/** How far a #rrggbb colour is from grey: its largest channel minus its smallest. */
const tint = (colour: string) => {
  const c = [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16));
  return Math.max(...c) - Math.min(...c);
};

it('the greys stay grey: only what is meant to be ink or gold carries those colours, and dark is not navy', () => {
  // Backgrounds, panels, hover and lines in both themes, and the dark header: neutral (a warm hint at most).
  for (const [name, theme] of Object.entries(themes)) {
    for (const t of ['page', 'surface', 'panel', 'hit', 'line', 'line-control']) expect(tint(hex(theme, t)), `${name} ${t}`).toBeLessThanOrEqual(16);
  }
  expect(tint(hex(dark, 'header-bg'))).toBeLessThanOrEqual(8);
  expect(tint(hex(dark, 'ink'))).toBeLessThanOrEqual(8);
  // The dark viewed tint is a lighter charcoal: neutral or slightly warm, never slate blue.
  expect(tint(hex(dark, 'viewed-bg'))).toBeLessThanOrEqual(8);
  // The light header and text are the ink (blue-black), on purpose.
  expect(hex(light, 'header-bg')).toBe(hex(light, 'ink'));
});

it('the operator tag text colours are the ones the row chooses between', () => {
  expect(token('on-operator-light')).toBe(ON_OPERATOR.light);
  expect(token('on-operator-dark')).toBe(ON_OPERATOR.dark);
});

it('the Charming Holidays tag (white text on its colour, as in the operators table) meets WCAG AA (4.5:1)', () => {
  expect(token('op-charming')).toBe('#b5179e');
  expect(contrast('#ffffff', token('op-charming'))).toBeGreaterThanOrEqual(4.5);
});

it('the Yummy Holiday tag (white text on its colour, as in the operators table) meets WCAG AA (4.5:1)', () => {
  expect(token('op-yummy')).toBe('#7a6a00');
  expect(contrast('#ffffff', token('op-yummy'))).toBeGreaterThanOrEqual(4.5);
});

it('the Sunflower Travel tag (white text on its colour, as in the operators table) meets WCAG AA (4.5:1)', () => {
  expect(token('op-sunflower')).toBe('#3949ab');
  expect(contrast('#ffffff', token('op-sunflower'))).toBeGreaterThanOrEqual(4.5);
});

it('the Taste Travel tag (white text on its colour, as in the operators table) meets WCAG AA (4.5:1)', () => {
  expect(token('op-taste')).toBe('#007a7a');
  expect(contrast('#ffffff', token('op-taste'))).toBeGreaterThanOrEqual(4.5);
  expect(operatorTextTone(token('op-taste'))).toBe('light');
});

it('every operator tag gets the text colour that meets WCAG AA on it: dark text on Jetour\'s orange and Big Line\'s green', () => {
  for (const name of ['op-egl', 'op-jetour', 'op-texpert', 'op-bigline', 'op-charming', 'op-yummy', 'op-sunflower', 'op-taste', 'op-fallback']) {
    const tone = operatorTextTone(token(name));
    expect(contrast(ON_OPERATOR[tone], token(name)), name).toBeGreaterThanOrEqual(4.5);
  }
  expect(operatorTextTone(token('op-jetour'))).toBe('dark');
  expect(operatorTextTone(token('op-bigline'))).toBe('dark');
  expect(operatorTextTone(token('op-egl'))).toBe('light');
});

it('the language notice (snow text on the owner\'s #800000) meets WCAG AA (4.5:1)', () => {
  expect(contrast(token('notice-text'), token('notice-maroon'))).toBeCloseTo(10.75, 1);
});

/**
 * Every text/background pair the site uses, by token. 4.5 for text; 3 for control outlines and focus rings (WCAG
 * 1.4.11). Left out on purpose: the most recent row's gold ring and the gold button's edge, which mark something the
 * text on them already says (上次打開, 去旅行社網站), and the decorative --line between rows.
 */
const PAIRS: { what: string; fg: string; bg: string; min: number }[] = [
  ...(['page', 'surface', 'panel', 'hit', 'viewed-bg', 'latest-bg'] as const).flatMap(bg => [
    { what: `text on ${bg}`, fg: 'ink', bg, min: 4.5 },
    { what: `muted text on ${bg}`, fg: 'text-muted', bg, min: 4.5 },
  ]),
  { what: 'departure date chips', fg: 'ink', bg: 'chip', min: 4.5 },
  { what: 'the weekday on a date chip', fg: 'chip-muted', bg: 'chip', min: 4.5 },
  { what: 'the weekday on a date chip of an opened row (the surface colour)', fg: 'chip-muted', bg: 'surface', min: 4.5 },
  ...(['surface', 'viewed-bg', 'latest-bg'] as const).map(bg => (
    { what: `the old-data tag (資料為 …), text and outline, on ${bg}`, fg: 'stale', bg, min: 4.5 })),
  { what: 'text on gold: the band, the gold button, the 上次打開 tag', fg: 'on-gold', bg: 'gold', min: 4.5 },
  { what: 'the band\'s search box: its text', fg: 'on-gold', bg: 'band-field-bg', min: 4.5 },
  { what: 'the band\'s search box: its placeholder', fg: 'band-field-muted', bg: 'band-field-bg', min: 4.5 },
  { what: 'the header, and the band\'s 按國家選擇 button', fg: 'header-text', bg: 'header-bg', min: 4.5 },
  { what: 'a chosen control (set filter, current page, rows per page) and the 已看過 tag', fg: 'on-selected', bg: 'selected-bg', min: 4.5 },
  { what: 'price went down', fg: 'price-down', bg: 'surface', min: 4.5 },
  { what: 'price went up', fg: 'price-up', bg: 'surface', min: 4.5 },
  { what: 'price went down, on the most recent row', fg: 'price-down', bg: 'latest-bg', min: 4.5 },
  { what: 'price went up, on the most recent row', fg: 'price-up', bg: 'latest-bg', min: 4.5 },
  { what: 'price went down, on a viewed row', fg: 'price-down', bg: 'viewed-bg', min: 4.5 },
  { what: 'price went up, on a viewed row', fg: 'price-up', bg: 'viewed-bg', min: 4.5 },
  { what: 'a date\'s price tooltip (page colours reversed)', fg: 'page', bg: 'ink', min: 4.5 },
  { what: 'language notice', fg: 'notice-text', bg: 'notice-maroon', min: 4.5 },
  ...(['page', 'surface', 'panel', 'viewed-bg', 'latest-bg'] as const).flatMap(bg => [
    { what: `control outlines (filters, fields, pager, 加入行程) on ${bg}`, fg: 'line-control', bg, min: 3 },
    { what: `strong outlines (sort control, 再看一次, next page, search box) on ${bg}`, fg: 'ink', bg, min: 3 },
    { what: `focus rings on ${bg}`, fg: 'focus', bg, min: 3 },
  ]),
  { what: 'the band\'s search box outline and focus rings on the gold', fg: 'on-gold', bg: 'gold', min: 3 },
  { what: 'the band\'s search box outline against the box', fg: 'on-gold', bg: 'band-field-bg', min: 3 },
  { what: 'the header\'s current-page underline and focus rings', fg: 'header-accent', bg: 'header-bg', min: 3 },
  { what: 'a chosen control\'s fill against the surface', fg: 'selected-bg', bg: 'surface', min: 3 },
];

describe.each(Object.entries(themes))('%s theme: WCAG AA for every pair used', (_name, theme) => {
  it.each(PAIRS)('$what (--$fg on --$bg) ≥ $min', ({ fg, bg, min }) => {
    expect(contrast(hex(theme, fg), hex(theme, bg))).toBeGreaterThanOrEqual(min);
  });
});

it('reports the lowest ratio per theme (for the record; each pair is checked above)', () => {
  const lowest = Object.fromEntries(Object.entries(themes).map(([name, theme]) => [name, Math.min(
    ...PAIRS.filter(p => p.min === 4.5).map(({ fg, bg }) => contrast(hex(theme, fg), hex(theme, bg))),
  )]));
  expect(lowest.light).toBeGreaterThanOrEqual(4.5);
  expect(lowest.dark).toBeGreaterThanOrEqual(4.5);
});

it('opened rows are tinted, visibly: each tint differs from a normal row, and from each other', () => {
  for (const theme of Object.values(themes)) {
    expect(contrast(hex(theme, 'latest-bg'), hex(theme, 'surface'))).toBeGreaterThanOrEqual(1.08);
    expect(contrast(hex(theme, 'viewed-bg'), hex(theme, 'surface'))).toBeGreaterThanOrEqual(1.08);
    expect(hex(theme, 'viewed-bg')).not.toBe(hex(theme, 'latest-bg'));
    // An opened row's chips turn to the surface colour, so they still stand out from the tint.
    expect(contrast(hex(theme, 'surface'), hex(theme, 'viewed-bg'))).toBeGreaterThanOrEqual(1.08);
  }
  const rgb = (colour: string) => [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16));
  // Light: the viewed tint is the ink's hue (cool), as drawn.
  const [lr, , lb] = rgb(hex(light, 'viewed-bg'));
  expect(lb).toBeGreaterThan(lr);
  // Dark: a lighter charcoal, neutral or slightly warm (blue never above red), never slate blue; lighter than the
  // surface; told apart from the gold row by its hue as well as its lightness (the gold row is clearly tinted).
  const [dr, , db] = rgb(hex(dark, 'viewed-bg'));
  expect(db).toBeLessThanOrEqual(dr);
  expect(luminance(hex(dark, 'viewed-bg'))).toBeGreaterThan(luminance(hex(dark, 'surface')));
  expect(contrast(hex(dark, 'viewed-bg'), hex(dark, 'surface'))).toBeGreaterThanOrEqual(1.2);
  expect(contrast(hex(dark, 'viewed-bg'), hex(dark, 'latest-bg'))).toBeGreaterThanOrEqual(1.05);
  expect(tint(hex(dark, 'latest-bg')) - tint(hex(dark, 'viewed-bg'))).toBeGreaterThanOrEqual(16);
});

// The guard against colour literals outside theme.css is lib/colour-literals.test.ts.
