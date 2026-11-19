import { it, expect, vi } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ReactElement } from 'react';
import { LOCALES, type Locale } from '../lib/i18n';
import { LOCALE_SEGMENT, localeHref, siteUrl } from '../lib/locale-path';
import sitemap from './sitemap';

// The route files are thin: each passes its language to the shared page, layout or metadata, which are
// stood in for here.
vi.mock('./_site/search-page', () => ({
  SearchPage: () => null,
  searchPageMetadata: (locale: Locale) => ({ page: 'search', locale }),
}));
vi.mock('./_site/chain-page', () => ({
  ChainPage: () => null,
  chainPageMetadata: (locale: Locale) => ({ page: 'chain', locale }),
}));
vi.mock('./_site/site-frame', () => ({
  SiteFrame: () => null,
  siteFrameMetadata: (locale: Locale) => ({ frame: true, locale }),
}));

/** The folder under app/ that holds each language's pages: a route group for the unprefixed Traditional Chinese. */
const ROOT: Record<Locale, string> = { 'zh-Hant': '(zh-hant)', 'zh-Hans': 'zh-hans', en: 'en' };

/** Every page path in a language's folder ('/', '/chain'), from its page.tsx files. */
function pagePaths(locale: Locale): string[] {
  const root = join(__dirname, ROOT[locale]);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name === 'page.tsx') found.push(`/${relative(root, dir).split(sep).join('/')}`.replace(/\/$/, '') || '/');
    }
  };
  walk(root);
  return found.sort();
}

it('each language has its own folder, named by its address prefix, with a root layout', () => {
  expect(LOCALES.map(l => ROOT[l])).toEqual(['(zh-hant)', ...(['zh-Hans', 'en'] as const).map(l => LOCALE_SEGMENT[l])]);
  for (const locale of LOCALES) expect(existsSync(join(__dirname, ROOT[locale], 'layout.tsx')), locale).toBe(true);
  // No page or layout outside them: every address belongs to exactly one language.
  const top = readdirSync(__dirname, { withFileTypes: true });
  expect(top.filter(e => e.isDirectory()).map(e => e.name).sort()).toEqual(['(zh-hant)', '_site', 'en', 'zh-hans']);
  expect(top.some(e => e.name.startsWith('page.') || e.name.startsWith('layout.') || e.name.startsWith('not-found.'))).toBe(false);
});

it('every page exists in all three languages, at the same path', () => {
  expect(pagePaths('zh-Hant')).toEqual(['/', '/chain']);
  for (const locale of LOCALES) expect(pagePaths(locale), locale).toEqual(pagePaths('zh-Hant'));
});

it('the sitemap lists every page in every language', () => {
  const listed = sitemap().map(entry => entry.url).sort();
  const expected = LOCALES.flatMap(locale => pagePaths(locale).map(path => siteUrl(localeHref(locale, path)))).sort();
  expect(listed).toEqual(expected);
});

type RouteModule = {
  default: (props: Record<string, unknown>) => ReactElement<Record<string, unknown>> | Promise<ReactElement<Record<string, unknown>>>;
  generateMetadata: () => unknown;
};

const routes = (await Promise.all([
  ['zh-Hant', import('./(zh-hant)/layout'), import('./(zh-hant)/page'), import('./(zh-hant)/chain/page')],
  ['zh-Hans', import('./zh-hans/layout'), import('./zh-hans/page'), import('./zh-hans/chain/page')],
  ['en', import('./en/layout'), import('./en/page'), import('./en/chain/page')],
].map(async ([locale, ...modules]) => [locale, ...(await Promise.all(modules))]))) as [Locale, RouteModule, RouteModule, RouteModule][];

it.each(routes)('%s: the layout, the search page and the chaining page all pass that language, and their metadata is that language\'s', async (locale, layout, search, chain) => {
  const searchParams = Promise.resolve({ dest: 'japan' });
  const children = 'page';
  const { SiteFrame } = await import('./_site/site-frame');
  const { SearchPage } = await import('./_site/search-page');
  const { ChainPage } = await import('./_site/chain-page');
  const frame = await layout.default({ children });
  expect(frame.type).toBe(SiteFrame);
  expect(frame.props).toEqual({ locale, children });
  const searchPage = await search.default({ searchParams });
  expect(searchPage.type).toBe(SearchPage);
  expect(searchPage.props).toEqual({ locale, searchParams });
  const chainPage = await chain.default({ searchParams });
  expect(chainPage.type).toBe(ChainPage);
  expect(chainPage.props).toEqual({ locale, searchParams });
  expect(layout.generateMetadata()).toEqual({ frame: true, locale });
  expect(search.generateMetadata()).toEqual({ page: 'search', locale });
  expect(chain.generateMetadata()).toEqual({ page: 'chain', locale });
});
