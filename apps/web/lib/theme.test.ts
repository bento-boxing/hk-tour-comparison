import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blend, contrast, ON_OPERATOR, operatorTextTone } from './contrast';

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
  'notice-maroon', 'notice-text', 'bar-text', 'bar-accent', 'on-operator-light', 'on-operator-dark', 'op-fallback',
  'on-latest-accent',
  'op-egl', 'op-jetour', 'op-texpert', 'op-bigline', 'op-charming', 'op-yummy', 'op-sunflower',
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

it('the owner\'s notice colour and the nav bar\'s text and accent are fixed', () => {
  expect(token('notice-maroon')).toBe('#800000');
  expect(token('notice-text')).toBe('#fffcff');
  expect(token('bar-text')).toBe('#fffcff');
  expect(token('bar-accent')).toBe('#c3b299');
});

it('the operator tag text colours are the ones the card chooses between', () => {
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

it('every operator tag gets the text colour that meets WCAG AA on it: dark text on Jetour\'s orange and Big Line\'s green', () => {
  for (const name of ['op-egl', 'op-jetour', 'op-texpert', 'op-bigline', 'op-charming', 'op-yummy', 'op-sunflower', 'op-fallback']) {
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
 * Every text/background pair the site uses, by token. `opacity` is the text's own opacity (the nav links and the
 * language buttons are drawn at 0.75). 4.5 for text; 3 for control outlines, focus rings and the route arrow
 * (a separator glyph read as part of the route, which the link's accessible name spells out with commas).
 */
const PAIRS: { what: string; fg: string; bg: string; min: number; opacity?: number }[] = [
  { what: 'body text on the page', fg: 'charcoal', bg: 'snow', min: 4.5 },
  { what: 'text on cards, popovers and fields', fg: 'charcoal', bg: 'surface', min: 4.5 },
  { what: 'text on panels (chain strip, empty results)', fg: 'charcoal', bg: 'panel', min: 4.5 },
  { what: 'text on a highlighted row or hovered control', fg: 'charcoal', bg: 'hit', min: 4.5 },
  { what: 'departure date chips', fg: 'charcoal', bg: 'ash', min: 4.5 },
  { what: 'muted text on cards', fg: 'text-muted', bg: 'surface', min: 4.5 },
  { what: 'muted text on the page (count line, pager)', fg: 'text-muted', bg: 'snow', min: 4.5 },
  { what: 'muted text on panels', fg: 'text-muted', bg: 'panel', min: 4.5 },
  { what: 'muted text on a highlighted row', fg: 'text-muted', bg: 'hit', min: 4.5 },
  { what: 'faint text on cards (updated, unchanged price)', fg: 'text-faint', bg: 'surface', min: 4.5 },
  { what: 'faint text on the page (footer)', fg: 'text-faint', bg: 'snow', min: 4.5 },
  { what: 'accent text on cards (price, go-to, add)', fg: 'cerulean', bg: 'surface', min: 4.5 },
  { what: 'accent text on the page', fg: 'cerulean', bg: 'snow', min: 4.5 },
  { what: 'accent text on panels (clear-all, remove)', fg: 'cerulean', bg: 'panel', min: 4.5 },
  { what: 'accent text on a highlighted row', fg: 'cerulean', bg: 'hit', min: 4.5 },
  { what: 'text on an accent fill (chosen pill, apply)', fg: 'snow', bg: 'cerulean', min: 4.5 },
  { what: 'price went down', fg: 'price-down', bg: 'surface', min: 4.5 },
  { what: 'price went up', fg: 'price-up', bg: 'surface', min: 4.5 },
  { what: 'price tooltip (page colours reversed)', fg: 'snow', bg: 'charcoal', min: 4.5 },
  { what: 'nav bar: site name, current link', fg: 'bar-text', bg: 'bar-bg', min: 4.5 },
  { what: 'nav bar: other links and language buttons at 75%', fg: 'bar-text', bg: 'bar-bg', min: 4.5, opacity: 0.75 },
  { what: 'language notice', fg: 'notice-text', bg: 'notice-maroon', min: 4.5 },
  // Cards opened this session (TourCard): on the two tints a card's muted and faint text, accent, price-down and
  // arrow use the --marked-* tokens (TourCard.module.css sets them on .card[data-opened]); every text it shows.
  ...(['opened-bg', 'latest-bg'] as const).flatMap(bg => [
    { what: `card text on ${bg}`, fg: 'charcoal', bg, min: 4.5 },
    { what: `muted and faint text on ${bg}`, fg: 'marked-muted', bg, min: 4.5 },
    { what: `accent text on ${bg}`, fg: 'marked-accent', bg, min: 4.5 },
    { what: `price down on ${bg}`, fg: 'marked-down', bg, min: 4.5 },
    { what: `price up on ${bg}`, fg: 'price-up', bg, min: 4.5 },
    { what: `route arrow on ${bg}`, fg: 'marked-line', bg, min: 3 },
    { what: `add button outline and date focus ring on ${bg}`, fg: 'marked-accent', bg, min: 3 },
  ]),
  { what: 'cue on an earlier-opened card (已瀏覽)', fg: 'charcoal', bg: 'ash', min: 4.5 },
  { what: 'cue on the most recent card (最近瀏覽)', fg: 'on-latest-accent', bg: 'latest-accent', min: 4.5 },
  { what: 'the most recent card\'s ring against the page', fg: 'latest-accent', bg: 'snow', min: 3 },
  // The card's focus ring: outside the border box, with a page-coloured band (--snow) inside it and the page outside.
  { what: 'card focus ring against its band and the page', fg: 'cerulean', bg: 'snow', min: 3 },
  { what: 'card focus ring of an opened card against its band and the page', fg: 'marked-accent', bg: 'snow', min: 3 },
  { what: 'date focus ring against the card', fg: 'cerulean', bg: 'surface', min: 3 },
  { what: 'control outlines (pills, fields, pager) on the page', fg: 'line-control', bg: 'snow', min: 3 },
  { what: 'control outlines in popovers', fg: 'line-control', bg: 'surface', min: 3 },
  { what: 'route arrow on cards', fg: 'line-control', bg: 'surface', min: 3 },
  { what: 'accent outlines and focus rings on the page', fg: 'cerulean', bg: 'snow', min: 3 },
  { what: 'accent outlines and focus rings on cards', fg: 'cerulean', bg: 'surface', min: 3 },
  { what: 'nav focus ring and current-page underline', fg: 'bar-accent', bg: 'bar-bg', min: 3 },
];

describe.each(Object.entries(themes))('%s theme: WCAG AA for every pair used', (_name, theme) => {
  it.each(PAIRS)('$what (--$fg on --$bg) ≥ $min', ({ fg, bg, min, opacity }) => {
    const back = hex(theme, bg);
    const front = opacity === undefined ? hex(theme, fg) : blend(hex(theme, fg), back, opacity);
    expect(contrast(front, back)).toBeGreaterThanOrEqual(min);
  });
});

it('reports the lowest ratio per theme (for the record; each pair is checked above)', () => {
  for (const theme of Object.values(themes)) {
    const lowest = Math.min(...PAIRS.filter(p => p.min === 4.5).map(({ fg, bg, opacity }) => {
      const back = hex(theme, bg);
      return contrast(opacity === undefined ? hex(theme, fg) : blend(hex(theme, fg), back, opacity), back);
    }));
    expect(lowest).toBeGreaterThanOrEqual(4.5);
  }
});

it('opened cards are clearly greyed: "opened earlier" differs from a normal card, "most recent" has a ring that stands out', () => {
  for (const theme of Object.values(themes)) {
    expect(contrast(hex(theme, 'opened-bg'), hex(theme, 'surface'))).toBeGreaterThanOrEqual(1.15);
    expect(contrast(hex(theme, 'latest-bg'), hex(theme, 'surface'))).toBeGreaterThanOrEqual(1.15);
    expect(contrast(hex(theme, 'latest-accent'), hex(theme, 'snow'))).toBeGreaterThanOrEqual(3);
  }
});

// The guard against colour literals outside theme.css is lib/colour-literals.test.ts.
