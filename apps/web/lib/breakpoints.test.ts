import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHONE_COLUMN_FROM, PHONE_COLUMN_PX, PHONE_MEDIA, WIDE_FROM, WIDE_MEDIA } from './breakpoints';

// Task 74: one phone breakpoint for the whole site. A media query cannot read a custom property, so every stylesheet
// writes the number itself; this test fails when any of them, or any script, writes a width that is not one of the
// site's few: the phone layout below WIDE_FROM, the phone column from PHONE_COLUMN_FROM, and the narrow phones' and
// the wide table's own steps.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'out', 'coverage']);
function files(dir: string, test: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : files(join(dir, entry.name), test);
    return test(entry.name) ? [join(dir, entry.name)] : [];
  });
}

/** Every width a stylesheet may test, by feature: the breakpoint (and its column), and the steps inside each layout. */
const ALLOWED: Readonly<Record<string, readonly number[]>> = {
  // The phone layout; and the narrowest phones (399px: the header's sides; 359px: 320px phones).
  'max-width': [WIDE_FROM - 1, 399, 359],
  // The wide layout; the phone column from 640px; the wide rows' aligned table from 1280px.
  'min-width': [WIDE_FROM, PHONE_COLUMN_FROM, 1280],
  // A phone on its side with a short screen (the header's links, no bottom bar).
  'max-height': [500],
};

it('the numbers', () => {
  expect([WIDE_FROM, PHONE_MEDIA, WIDE_MEDIA, PHONE_COLUMN_FROM, PHONE_COLUMN_PX])
    .toEqual([1024, '(max-width: 1023px)', '(min-width: 1024px)', 640, 720]);
});

it('every stylesheet\'s media queries test only the site\'s widths: one phone breakpoint everywhere', () => {
  const sheets = files(WEB, name => name.endsWith('.css'));
  expect(sheets.length).toBeGreaterThan(20);
  const found: string[] = [];
  let phone = 0;
  for (const file of sheets) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const query of css.matchAll(/@media([^{]*)\{/g)) {
      for (const m of query[1].matchAll(/\(\s*((?:min|max)-(?:width|height))\s*:\s*([\d.]+)(\w*)\s*\)/g)) {
        const [, feature, value, unit] = m;
        if (unit !== 'px' || !(ALLOWED[feature] ?? []).includes(Number(value))) found.push(`${relative(WEB, file)}: @media${query[1].trim()}`);
        if (feature === 'max-width' && Number(value) === WIDE_FROM - 1) phone++;
      }
      // The phone column's range is always closed by the breakpoint.
      if (/min-width:\s*640px/.test(query[1]) && /max-width/.test(query[1]) && !query[1].includes(`max-width: ${WIDE_FROM - 1}px`)) {
        found.push(`${relative(WEB, file)}: @media${query[1].trim()}`);
      }
    }
  }
  expect(found).toEqual([]);
  // The walk does see the phone rules (about forty blocks).
  expect(phone).toBeGreaterThan(30);
});

it('no script writes a media query of its own: they use lib/breakpoints.ts', () => {
  const scripts = files(WEB, name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .filter(file => relative(WEB, file) !== join('lib', 'breakpoints.ts') && !relative(WEB, file).startsWith('next-env'));
  const found = scripts.flatMap(file => {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    return [...src.matchAll(/\((?:min|max)-width:\s*\d+px\)/g)].map(m => `${relative(WEB, file)}: ${m[0]}`);
  });
  expect(found).toEqual([]);
});

/** The rules inside one stylesheet's `@media (min-width: 640px) and (max-width: 1023px)` block(s), whitespace collapsed. */
function columnRules(path: string): string {
  const css = readFileSync(join(WEB, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const head = `@media (min-width: ${PHONE_COLUMN_FROM}px) and (max-width: ${WIDE_FROM - 1}px) {`;
  const out: string[] = [];
  for (let at = css.indexOf(head); at >= 0; at = css.indexOf(head, at + 1)) {
    let depth = 0;
    for (let i = at + head.length - 1; i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}' && --depth === 0) { out.push(css.slice(at + head.length, i)); break; }
    }
  }
  return out.join(' ');
}

it('from 640px up to the wide layout: the phone layout in a centred 720px column, the tabs together, the sheets as panels', () => {
  expect(columnRules('app/_site/site-frame.module.css')).toContain(`.wrap { max-width: ${PHONE_COLUMN_PX}px; }`);
  expect(columnRules('components/Footer.module.css')).toContain(`.footer { max-width: ${PHONE_COLUMN_PX}px; }`);
  expect(columnRules('components/TabBar.module.css')).toContain('.list { max-width: 480px; margin: 0 auto; }');
  for (const [path, cls] of [['components/FilterSheet.module.css', 'sheet'], ['components/DestinationScreen.module.css', 'screen']]) {
    expect(columnRules(path)).toContain(`.${cls} { max-width: 640px; margin: 0 auto;`);
    expect(columnRules(path)).toContain(`.${cls}::backdrop { background: var(--scrim); }`);
  }
  expect(columnRules('components/DestinationSearch.module.css')).toContain('.inlineList { right: calc(50% - 320px); left: calc(50% - 320px); }');
  // Operators: two columns from 640px (one under it), four from 1280px.
  expect(readFileSync(join(WEB, 'app/_site/operators-page.module.css'), 'utf8'))
    .toContain('@media (min-width: 640px) { .operators { grid-template-columns: repeat(2, minmax(0, 1fr)); } }');
});

it('a phone on its side with a short screen keeps the header with its links and no bottom bar, at any phone width', () => {
  const nav = readFileSync(join(WEB, 'components/NavBar.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  expect(nav).toContain(`@media ${PHONE_MEDIA} and (orientation: landscape) and (max-height: 500px) {`);
  // From 640px the links share the name's row.
  expect(nav).toContain('@media (min-width: 640px) and (max-width: 1023px) and (orientation: landscape) and (max-height: 500px) { .inner { column-gap: 18px; } .links { order: 2; flex-basis: auto; } .tools { order: 3; } }');
  const tabs = readFileSync(join(WEB, 'components/TabBar.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  expect(tabs).toContain(`@media ${PHONE_MEDIA} and (orientation: landscape) and (max-height: 500px) { .bar, .spacer { display: none; } }`);
});
