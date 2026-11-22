import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every colour in the website comes from a theme token (lib/theme.css), so both themes stay complete. This test
// walks every .css, .ts and .tsx file under apps/web and fails on any colour written literally.

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'out', 'coverage']);

/** The deliberate exceptions, by path from apps/web, each with its reason. */
const EXCEPTIONS: Record<string, string> = {
  'lib/theme.css': 'the tokens themselves',
  'lib/contrast.ts': 'ON_OPERATOR: the two operator-tag text colours, pinned to --on-operator-light/-dark by theme.test.ts',
};

/** Every CSS named colour (CSS Color 4), lower case. transparent and currentColor are keywords, allowed. */
const NAMED_COLOURS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
  'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
  'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
  'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
  'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
  'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
  'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
  'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
  'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
  'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
  'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
  'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
  'whitesmoke yellow yellowgreen'
).split(' ');

const HEX = /#[0-9a-f]{3,8}\b/i;
const FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;
const NAMED = new RegExp(`(?<![\\w-])(?:${NAMED_COLOURS.join('|')})(?![\\w-])`, 'i');
/** In TS/TSX: a property or JSX attribute that takes a colour, with a quoted value (style={{ color: 'red' }}, fill="red"). */
const COLOUR_PROP = /(?:\b(?:color|background(?:Color)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|fill|stroke|stopColor|floodColor|lightingColor|boxShadow|textShadow|caretColor|accentColor|textDecorationColor|columnRuleColor)|['"]--[\w-]+['"])\s*[:=]\s*\{?\s*(['"`])([^'"`]*)\1/g;
/** In TS/TSX: a string that is exactly a colour name ('teal'). */
const QUOTED_NAME = new RegExp(`(['"\`])\\s*(?:${NAMED_COLOURS.join('|')})\\s*\\1`, 'i');

/** The colour literals in one file's text, one string per finding ('line: text'). */
export function findColourLiterals(path: string, source: string): string[] {
  const found: string[] = [];
  const isCss = path.endsWith('.css');
  // Comments out (block comments everywhere; line comments in TS), keeping line numbers.
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  let text = source.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (!isCss) text = text.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)));
  // CSS: selectors and at-rule preludes (everything before a '{') out, so only declarations remain.
  const declarations = isCss ? text.replace(/[^{};]*\{/g, m => `${blank(m.slice(0, -1))}{`) : text;
  const original = source.split('\n');
  declarations.split('\n').forEach((line, i) => {
    const at = `${path}:${i + 1}: ${original[i].trim()}`;
    if (HEX.test(line) || FUNCTION.test(line)) { found.push(at); return; }
    if (isCss) {
      // Values only: the part of each declaration after its property name.
      const values = line.split(/[{};]/).map(part => (part.includes(':') ? part.slice(part.indexOf(':') + 1) : '')).join(' ');
      if (NAMED.test(values)) found.push(at);
    } else {
      const props = [...line.matchAll(COLOUR_PROP)].map(m => m[2]);
      if (props.some(value => NAMED.test(value)) || QUOTED_NAME.test(line)) found.push(at);
    }
  });
  return found;
}

/** Every .css, .ts and .tsx file under apps/web that is not a test, a declaration file or build output. */
function sourceFiles(dir = WEB): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(path);
    if (!/\.(css|tsx?)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name) || entry.name.endsWith('.d.ts')) return [];
    return [relative(WEB, path).split(sep).join('/')];
  });
}

it('no file under apps/web writes a colour literally: every colour is a theme token', () => {
  const found = sourceFiles()
    .filter(path => !(path in EXCEPTIONS))
    .flatMap(path => findColourLiterals(path, readFileSync(join(WEB, path), 'utf8')));
  expect(found).toEqual([]);
});

it('walks every folder: nested CSS modules, lib components, and the exceptions exist', () => {
  const files = sourceFiles();
  for (const path of ['app/_site/chain-page.module.css', 'app/en/chain/page.tsx', 'lib/i18n-client.tsx', 'components/TourCard.tsx', 'lib/theme.css']) {
    expect(files, path).toContain(path);
  }
  for (const path of Object.keys(EXCEPTIONS)) expect(files, path).toContain(path);
  expect(files.some(f => f.includes('node_modules') || f.includes('.test.'))).toBe(false);
});

/**
 * Custom properties a stylesheet may read without theme.css defining them: each is set where it is used. --c is the
 * operator colour (set inline by the row, the chain strip's legs and the operator checkboxes); --tip-shift by the
 * row's date tooltip; --mark-* by whoever colours the mark; --band-*, --search-*, --toggle-* by the gold band for
 * the controls on it (each read with a fallback); --col-* by the row for its own grid tracks; --notice-h (not a
 * colour) by the filter bar, the language notice's height, which its phone bar sticks below (read with a fallback).
 */
const LOCAL_PROPERTIES = /^--(c|tip-shift|mark-primary|mark-accent|band-focus|search-[a-z]+|toggle-[a-z]+|col-[a-z]+|notice-h)$/;

it('every custom property a stylesheet reads is a theme token or set where it is used: no old colour name is left', () => {
  const tokens = new Set([...readFileSync(join(WEB, 'lib/theme.css'), 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const unknown = sourceFiles()
    .filter(path => path.endsWith('.css'))
    .flatMap(path => [...readFileSync(join(WEB, path), 'utf8').matchAll(/var\((--[\w-]+)/g)]
      .map(m => m[1])
      .filter(name => !tokens.has(name) && !LOCAL_PROPERTIES.test(name))
      .map(name => `${path}: ${name}`));
  expect(unknown).toEqual([]);
  // The guard does read the stylesheets: the tokens the rows use are found there.
  expect(tokens.has('--gold') && tokens.has('--ink')).toBe(true);
});

describe('it catches', () => {
  // The review's four cases (each passed the old check), then the other forms.
  it.each([
    ['app/_site/chain-page.module.css', '.title { color: #fff; }'],
    ['components/TourCard.module.css', '.op { color: teal; }'],
    ['components/TourCard.tsx', '      <span style={{ color: \'red\' }}>x</span>'],
    ['lib/i18n-client.tsx', 'const c = \'rgb(1,2,3)\';'],
    ['a.module.css', '.a { background: rgba(80, 81, 79, 0.12); }'],
    ['a.module.css', '.a { border: 1px solid WhiteSmoke; }'],
    ['a.module.css', '.a { box-shadow: 0 0 0 2px rebeccapurple; }'],
    ['a.module.css', '.a { color: oklch(70% 0.1 200); }'],
    ['a.module.css', '.a { color: color(display-p3 1 0 0); }'],
    ['a.module.css', '.a { color: hsl(0 0% 0%); }'],
    ['a.module.css', '.a { --x: navy; }'],
    ['a.module.css', '@media (hover: hover) { .a { outline-color: gold } }'],
    ['a.tsx', '<path fill="#247ba0" />'],
    ['a.tsx', '<circle fill="tomato" />'],
    ['a.tsx', 'const s = { backgroundColor: "black" };'],
    ['a.tsx', 'const s = { \'--c\': \'red\' } as CSSProperties;'],
    ['a.tsx', 'const FALLBACK = \'silver\';'],
    ['a.ts', 'export const c = `hsla(0, 0%, 0%, 0.5)`;'],
  ])('%s: %s', (path, text) => {
    expect(findColourLiterals(path, text)).toHaveLength(1);
  });
});

describe('and lets through', () => {
  it.each([
    ['a.module.css', '.a { white-space: nowrap; color: var(--ink); background: transparent; fill: currentColor; }'],
    ['a.module.css', '.a { color: inherit; border-color: initial; }'],
    ['a.module.css', '.d:focus-visible .tip { outline: 2px solid var(--page); }'],
    ['a.module.css', '.red:hover, #main .tan { color: var(--ink); }'],
    ['a.module.css', '/* the mockup\'s #7b7c76, darkened */ .a { color: var(--text-muted); }'],
    ['a.module.css', '@media (prefers-color-scheme: dark) { :root:not([data-theme=\'light\']) { --x: var(--y); } }'],
    ['a.tsx', 'const SAFE_COLOR = /^#[0-9a-f]{6}$/i;'],
    ['a.tsx', 'const FALLBACK_COLOR = \'var(--op-fallback)\';'],
    ['a.tsx', '<path fill="none" stroke="currentColor" />'],
    ['a.tsx', '// a red herring: #fff in a comment'],
    ['a.tsx', '\'footer.disclaimer\': \'Prices on the operator\\\'s own website take precedence.\','],
    ['a.ts', 'const url = \'https://example.test/path\'; // white'],
  ])('%s: %s', (path, text) => {
    expect(findColourLiterals(path, text)).toEqual([]);
  });
});
