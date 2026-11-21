import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every internal link and navigation the site makes carries the page's language, and only lib/locale-path.ts's
// localeHref adds a language prefix. This test reads the source of every .ts and .tsx file under app/,
// components/ and lib/ (tests aside), comments removed, and fails on:
//   1. an href (JSX attribute `href=` / `href = …`, or object property `href: …`) that is not built by
//      localeHref(…) (in JSX, one whole call: href={localeHref(…)}), unless it is one of the external links below;
//   2. navigation:
//      - useRouter() kept under any name but `router` (`const nav = useRouter()`, `const { push } = useRouter()`,
//        `useRouter().push(…)`), so that every navigation is a visible `router.push/replace(…)`;
//      - a router.push / router.replace, redirect() or permanentRedirect() whose address is not one whole
//        localeHref(…) call (nothing added after it), and importing redirect or permanentRedirect from
//        next/navigation under another name;
//      - window.open(…), history.pushState / replaceState(…), `location = …`, `location.href = …`,
//        location.assign / replace(…);
//      - a form `action` or `formAction` that is not a server action (a bare function name) or localeHref(…);
//   3. localeHref given a language other than the page's own (`t.locale` or `locale`), outside the files that
//      are meant to link to every language (listed below);
//   4. a language prefix written anywhere else ('/en', "/zh-hans", `/en${…}`, LOCALE_SEGMENT).
// How strong it is: it reads text, not what runs, and stops the easy mistakes, not a determined evasion. It does
// NOT catch, for example: a language built in pieces ('/' + 'en'); localeHref(t.locale, …) where that `t` was made
// for another language; an address spread into a link from a helper (<Link {...linkTo('/chain')}>); a string
// address held in a variable and passed as a form action; links made with DOM APIs. The page and component
// tests check the links themselves, in each language.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDERS = ['app', 'components', 'lib'];

/** Links that deliberately leave the page's language or the site, by file, exactly as written. */
const EXTERNAL_HREFS: Record<string, string[]> = {
  'components/Footer.tsx': ['href={`mailto:${contactEmail}`}'], // the contact address
  'components/TourCard.tsx': ['href: tour.url'], // the operator's own page
  'app/_site/about-page.tsx': ['href={`mailto:${contactEmail}`}'], // the contact address
};
/** Files whose localeHref calls are meant for every language: the switch, the 404 page and the sitemap/metadata. */
const ANY_LANGUAGE = new Set(['components/LanguageSwitch.tsx', 'app/global-not-found.tsx', 'app/sitemap.ts', 'lib/site-metadata.ts']);
const PREFIX_HOME = 'lib/locale-path.ts';

function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(relative(WEB, path).split(sep).join('/'));
    }
  };
  for (const folder of FOLDERS) walk(join(WEB, folder));
  return found.sort();
}

/** The code without comments, and without the route type names Next.js generates (PageProps<'/en'>). */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
    .replace(/\b(PageProps|LayoutProps)<'[^']*'>/g, '$1');
}

/**
 * True when the code at `at` is a whole `localeHref(…)` call followed by one of `ends` (after any spaces): the address
 * is that call's result, not something more added to it (`localeHref(l, '/') + text`). Parentheses inside the call
 * are balanced; quoted strings are skipped, so a ')' inside one does not count.
 */
function wholeLocaleHref(src: string, at: number, ends: string): boolean {
  if (!src.startsWith('localeHref(', at)) return false;
  let depth = 0;
  for (let i = at + 'localeHref'.length; i < src.length; i++) {
    const c = src[i];
    if (c === '\'' || c === '"' || c === '`') {
      const close = src.indexOf(c, i + 1);
      if (close === -1) return false;
      i = close;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) {
      const next = src.slice(i + 1).match(/^\s*(\S)/);
      return next !== null && ends.includes(next[1]);
    }
  }
  return false;
}

/** Everything wrong with one file's code (`path` is from apps/web). */
export function problems(path: string, text: string): string[] {
  const src = code(text);
  const found: string[] = [];
  const external = EXTERNAL_HREFS[path] ?? [];

  // 1. hrefs: JSX attributes (href=…, href = …) and object properties (href: …). Not hrefLang, nor names like hrefFor.
  for (const m of src.matchAll(/\bhref\s*([=:])(?!=)\s*(\S+)/g)) {
    const whole = m[1] === '=' ? `href=${m[2]}` : `href: ${m[2]}`;
    const value = m.index + m[0].length - m[2].length;
    if (m[2].startsWith('{localeHref(') && wholeLocaleHref(src, value + 1, '}')) continue;
    if (m[2].startsWith('localeHref(')) continue; // an object property: href: localeHref(…)
    if (m[1] === ':' && /^string\b/.test(m[2])) continue; // a type annotation (href: string)
    if (external.some(e => e.startsWith(whole) || whole.startsWith(e))) continue;
    found.push(`${path}: ${whole}`);
  }
  // 2. navigations.
  for (const m of src.matchAll(/(.{0,20})\buseRouter\(\)/g)) {
    if (!/\bconst router = $/.test(m[1])) found.push(`${path}: ${m[0].trim()} (keep it as \`const router = useRouter()\`)`);
  }
  // The address must be one whole localeHref(…) call: the call's end, or its options after a comma, comes next.
  for (const m of src.matchAll(/\b(router\.(?:push|replace)|redirect|permanentRedirect)\s*\(\s*/g)) {
    if (!wholeLocaleHref(src, m.index + m[0].length, '),')) found.push(`${path}: ${m[0]}${src.slice(m.index + m[0].length, m.index + m[0].length + 40).split('\n')[0]}`);
  }
  const navigation = new RegExp([
    /\bimport\s*\{[^}]*\b(redirect|permanentRedirect)\s+as\b[^}]*\}\s*from\s*['"]next\/navigation['"]/,
    /\bwindow\.open\s*\(/,
    /\bhistory\.(pushState|replaceState)\s*\(/,
    /\blocation(\.href)?\s*=(?!=)/,
    /\blocation\.(assign|replace)\s*\(/,
  ].map(r => r.source).join('|'), 'g');
  for (const m of src.matchAll(navigation)) found.push(`${path}: ${m[0]}`);
  for (const m of src.matchAll(/\b(action|formAction)\s*=\s*(\S+)/g)) {
    if (/^\{[A-Za-z_$][\w$]*\}/.test(m[2]) || m[2].startsWith('{localeHref(')) continue; // a server action, or a localised address
    found.push(`${path}: ${m[1]}=${m[2]}`);
  }
  // 3. the language a link is made in.
  if (path !== PREFIX_HOME && !ANY_LANGUAGE.has(path)) {
    for (const m of src.matchAll(/\blocaleHref\(\s*([^,]+),/g)) {
      if (m[1] !== 't.locale' && m[1] !== 'locale') found.push(`${path}: localeHref(${m[1]},`);
    }
  }
  // 4. language prefixes written by hand.
  if (path !== PREFIX_HOME) {
    for (const m of src.matchAll(/['"`]\/(en|zh-hans|zh-hant)(?=[/?#'"`$]|$)|\bLOCALE_SEGMENT\b/gim)) found.push(`${path}: ${m[0]}`);
  }
  return found;
}

it('every internal link and navigation in the site goes through localeHref, in the page\'s language', () => {
  const files = sourceFiles();
  // The walk sees the files that make links, so an empty or wrong walk cannot pass.
  for (const path of ['components/NavBar.tsx', 'components/Pager.tsx', 'app/_site/chain-page.tsx', 'app/en/page.tsx', 'lib/chain-href.ts',
    'components/SavedConnected.tsx', 'app/_site/saved-page.tsx', 'app/en/saved/page.tsx', 'lib/saved-list.ts']) {
    expect(files, path).toContain(path);
  }
  expect(files.flatMap(path => problems(path, readFileSync(join(WEB, path), 'utf8')))).toEqual([]);
});

it('the listed exceptions are still there (a stale entry would hide nothing, but would mislead)', () => {
  for (const [path, hrefs] of Object.entries(EXTERNAL_HREFS)) {
    const src = readFileSync(join(WEB, path), 'utf8');
    for (const href of hrefs) expect(src, `${path}: ${href}`).toContain(href);
  }
  for (const path of ANY_LANGUAGE) expect(readFileSync(join(WEB, path), 'utf8'), path).toContain('localeHref(');
});

describe('it catches', () => {
  it.each([
    ['components/X.tsx', '<Link href="/chain">x</Link>'],
    ['components/X.tsx', '<Link href={\'/\'}>x</Link>'],
    ['components/X.tsx', '<a href={chainHref(chain)}>x</a>'],
    ['components/X.tsx', '<Link href={`/chain?${query}`}>x</Link>'],
    ['components/X.tsx', 'const props = { href: chainStartHref(key, date) };'],
    ['components/X.tsx', 'router.push(chainPageHref(address), { scroll: false });'],
    ['components/X.tsx', 'router.replace(`${pathname}?${query}`);'],
    ['components/X.tsx', 'router.push(href);'],
    ['app/x/page.tsx', 'redirect(\'/chain\');'],
    ['app/x/page.tsx', 'permanentRedirect(next);'],
    ['components/X.tsx', 'window.location.href = \'/chain\';'],
    ['components/X.tsx', '<form action="/chain">'],
    ['components/X.tsx', '<Link href={localeHref(\'en\', \'/\')}>x</Link>'],
    ['components/X.tsx', 'const home = `/en${path}`;'],
    ['components/X.tsx', 'const home = \'/zh-hans\' + path;'],
    ['components/X.tsx', 'const prefix = LOCALE_SEGMENT[locale];'],
    // The review's cheap misses (fix round 1).
    ['components/X.tsx', '<Link href = "/chain">x</Link>'],
    ['components/X.tsx', '<Link href ={chainHref(chain)}>x</Link>'],
    ['components/X.tsx', 'const nav = useRouter(); nav.push(chainPageHref(a));'],
    ['components/X.tsx', 'const { push } = useRouter(); push("/chain");'],
    ['components/X.tsx', 'useRouter().push("/chain");'],
    ['components/X.tsx', '<form action={"/chain"}>'],
    ['components/X.tsx', '<form action={`/chain?${q}`}>'],
    ['components/X.tsx', '<button formAction="/chain">x</button>'],
    ['components/X.tsx', 'window.open("/chain");'],
    ['components/X.tsx', 'history.pushState(null, "", "/chain");'],
    ['components/X.tsx', 'window.history.replaceState(null, "", next);'],
    ['components/X.tsx', 'window.location = "/chain";'],
    ['components/X.tsx', 'location.assign("/chain");'],
    ['components/X.tsx', 'location.replace(next);'],
    ['app/x/page.tsx', 'import { redirect as go } from \'next/navigation\';'],
    ['app/x/page.tsx', 'import { notFound, permanentRedirect as move } from \'next/navigation\';'],
    ['app/x/page.tsx', 'permanentRedirect(`/tours/${id}`);'],
    ['app/x/page.tsx', 'permanentRedirect(localeHref(\'en\', moved));'],
    // Something added to a localised address (fix round 1).
    ['app/x/page.tsx', 'permanentRedirect(localeHref(t.locale, \'/\') + text);'],
    ['app/x/page.tsx', 'redirect(localeHref(locale, path) + `?${query}`);'],
    ['components/X.tsx', 'router.push(localeHref(locale, \'/\') + x);'],
    ['components/X.tsx', 'router.replace(localeHref(t.locale, a) + b, { scroll: false });'],
    ['components/X.tsx', '<Link href={localeHref(t.locale, \'/\') + q}>x</Link>'],
    // The saved page (task 50): its address built without the language, or the language added by hand.
    ['components/X.tsx', '<Link href={savedHref(keys)}>x</Link>'],
    ['components/X.tsx', 'router.replace(savedHref(own), { scroll: false });'],
    ['components/X.tsx', 'router.replace(`/en${savedHref(own)}`);'],
    ['components/X.tsx', '<Link href={localeHref(\'zh-Hans\', savedHref(keys))}>x</Link>'],
  ])('%s: %s', (path, line) => {
    expect(problems(path, line)).not.toEqual([]);
  });

  it.each([
    ['components/X.tsx', '<Link href={localeHref(t.locale, \'/\')}>x</Link>'],
    ['components/X.tsx', 'router.push(localeHref(locale, chainPageHref(address)), { scroll: false });'],
    ['components/X.tsx', '// a comment about /en and href="/chain"'],
    ['app/en/page.tsx', 'export default function Page({ searchParams }: PageProps<\'/en\'>) {'],
    ['components/X.tsx', '<a hrefLang={HREFLANG[locale]}>'],
    ['components/X.tsx', 'hrefFor?: (page: number) => string;'],
    ['lib/x.ts', 'export function siteUrl(href: string): string {'],
    ['components/X.tsx', 'const url = \'https://example.test/en\';'],
    ['components/X.tsx', 'const router = useRouter();'],
    ['components/X.tsx', '<form action={setTheme} className={styles.form}>'],
    ['components/X.tsx', 'if (location == null) return;'],
    ['lib/x.ts', 'return href === \'/\' ? SITE_URL : `${SITE_URL}${href}`;'],
    ['app/x/page.tsx', 'import { permanentRedirect } from \'next/navigation\';'],
    ['app/x/page.tsx', 'if (moved !== null) permanentRedirect(localeHref(t.locale, moved));'],
    ['components/X.tsx', 'router.push(localeHref(t.locale, f(a, \')\')), { scroll: false });'],
    ['components/X.tsx', 'router.push(\n  localeHref(locale, searchHref(next)),\n);'],
    ['components/X.tsx', 'router.replace(localeHref(t.locale, savedHref(own)), { scroll: false });'],
    ['components/X.tsx', '<Link href={localeHref(t.locale, savedHref(keys))}>x</Link>'],
  ])('and lets pass %s: %s', (path, line) => {
    expect(problems(path, line)).toEqual([]);
  });
});
