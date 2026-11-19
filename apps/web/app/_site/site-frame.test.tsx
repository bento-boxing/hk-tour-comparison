import { it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { useT } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import { SiteFrame, siteFrameMetadata } from './site-frame';
import styles from './site-frame.module.css';

// `value` is a leftover language cookie from before the language moved into the address: it must be ignored.
const cookie = vi.hoisted(() => ({ value: undefined as string | undefined, theme: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === 'locale' ? cookie.value : name === 'theme' ? cookie.theme : undefined;
      return value === undefined ? undefined : { name, value };
    },
  }),
}));
const address = vi.hoisted(() => ({ pathname: '/', search: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => address.pathname, useSearchParams: () => new URLSearchParams(address.search) }));
vi.mock('../../lib/theme-action', () => ({ setTheme: vi.fn() }));

beforeEach(() => { cookie.value = undefined; cookie.theme = undefined; address.pathname = '/'; address.search = ''; });

/** A client component inside the layout: it sees the provider's locale. */
function ClientText() {
  return <p data-testid="client">{useT()('nav.search')}</p>;
}

async function renderLayout(locale: Locale = 'zh-Hant'): Promise<string> {
  return renderToStaticMarkup(await SiteFrame({ locale, children: <ClientText /> }));
}

it.each([
  ['zh-Hant', 'zh-Hant-HK', '搜尋旅行團', '本網站與各旅行社並無任何關連。'],
  ['zh-Hans', 'zh-Hans', '搜索旅行团', '本网站与各旅行社没有任何关联。'],
  ['en', 'en', 'Find tours', 'This site is not affiliated with any tour operator.'],
] as const)('%s: <html lang="%s">, and the server text and client text share the language', async (locale, lang, clientText, disclaimer) => {
  const html = await renderLayout(locale);
  expect(html).toMatch(new RegExp(`^<html lang="${lang}"`));
  expect(html).toContain(`<p data-testid="client">${clientText}</p>`); // client: the provider
  expect(html).toContain(disclaimer); // server: the footer
});

it.each([
  ['zh-Hant', 'en'],
  ['zh-Hant', 'zh-Hans'],
  ['en', 'zh-Hant'],
  ['zh-Hans', 'en'],
] as const)('a page in %s ignores an old language cookie that says %s: the address alone decides', async (locale, oldCookie) => {
  cookie.value = oldCookie;
  const html = await renderLayout(locale);
  expect(html).toMatch(new RegExp(`^<html lang="${{ 'zh-Hant': 'zh-Hant-HK', 'zh-Hans': 'zh-Hans', en: 'en' }[locale]}"`));
});

it.each([
  ['zh-Hant', '/', '/', '/chain'],
  ['zh-Hans', '/zh-hans', '/zh-hans', '/zh-hans/chain'],
  ['en', '/en/chain', '/en', '/en/chain'],
] as const)('%s at %s: the nav bar links stay in the language', async (locale, pathname, search, chain) => {
  address.pathname = pathname;
  const html = await renderLayout(locale);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const navHrefs = [...doc.querySelectorAll('nav > div > a')].map(a => a.getAttribute('href'));
  expect(navHrefs).toEqual([search, chain]);
});

it.each([
  ['zh-Hant', '集合多間香港旅行社的旅行團，可按出發日期、日數、目的地及價錢篩選。報名請到旅行社自己的網站。'],
  ['zh-Hans', '汇集多家香港旅行社的旅行团，可按出发日期、天数、目的地和价格筛选。报名请前往旅行社自己的网站。'],
  ['en', "Group tours from several Hong Kong tour operators in one place. Filter by departure date, length, destination and price, then book on the operator's own website."],
] as const)('%s: the site address as the base of every address, the site name as the title and its pattern for pages, and the description in that language', (locale, description) => {
  expect(siteFrameMetadata(locale)).toEqual({
    metadataBase: new URL('https://ganbintuen.com'),
    title: { default: '跟邊團', template: '%s | 跟邊團' },
    description,
  });
});

it('in zh-Hant there is no notice and no space kept for it', async () => {
  const html = await renderLayout();
  expect(html).not.toContain('role="note"');
  expect(html).not.toContain('data-notice-spacer');
  expect(html).not.toContain(styles.withNotice);
});

it.each([
  ['zh-Hans', '旅行团一般以粤语进行，详情请向旅行社查询。'],
  ['en', 'Tours are normally conducted in Cantonese. Check with the operator.'],
] as const)('in %s the notice comes first on every page, before the nav bar, and focus scrolling stops below it', async (locale, text) => {
  const html = await renderLayout(locale);
  const note = html.indexOf('role="note"');
  expect(note).toBeGreaterThan(-1);
  expect(html).toContain(text);
  expect(note).toBeLessThan(html.indexOf('<nav'));
  expect(html.indexOf('data-notice-spacer')).toBeLessThan(html.indexOf('<nav'));
  expect(html).toMatch(new RegExp(`^<html lang="[^"]+" class="${styles.withNotice}"`));
  const css = readFileSync(join(__dirname, 'site-frame.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(css).toMatch(/\.withNotice \{ scroll-padding-top: 5rem; \}/);
});

it.each([
  ['dark', ' data-theme="dark"'],
  ['light', ' data-theme="light"'],
])('theme cookie %j: the server renders <html%s>, so the first paint is in the chosen theme', async (value, attr) => {
  cookie.theme = value;
  const html = await renderLayout();
  expect(html).toMatch(new RegExp(`^<html lang="zh-Hant-HK"${attr}>`));
});

it.each([undefined, '', 'system', 'Dark'])('theme cookie %j: no data-theme, so the visitor\'s system setting decides (CSS media query)', async value => {
  cookie.theme = value;
  const html = await renderLayout();
  expect(html).toMatch(/^<html lang="zh-Hant-HK">/);
  expect(html).not.toContain('data-theme');
});

it('the nav bar has the theme switch beside the language switch', async () => {
  const html = await renderLayout();
  expect(html).toContain('切換至深色模式');
  expect(html).toContain('切換至淺色模式');
});
